var fs = require("fs");
global.logger = require('./logger.js')
var Antigate = require('antigate');
var ag = new Antigate('bc557b2f0e211930e17c8736dd5751fa');
var captcha = false 
var messagePool = []
var Query = require('./query.js')

class Api extends Query {
    messageLoop (p) {   
        if (messagePool.length > 0 || p) {
            if (p) {
                var param = p
            } else {
                var param = messagePool.shift();
            }

            this.vkQuery('messages.send', param, (res) => {
                if (res.captcha_img) {
                    this.getCaptcha(res.captcha_img, (text) => {
                        param.captcha_sid = res.captcha_sid
                        param.captcha_key = text
                        this.messageLoop(param)
                    })
                }
                else
                {
                    this.messageLoop()
                }
            }) 
        }
        else {
            setTimeout(()=> {
                messageLoop()
            }, 10)   
        }
    }

    editChat (params, callback) {
        this.vkQuery('messages.editChat', params, (res) => {
            if (callback) callback(res)
        })
    }

    sendMessage (params, callback) {
        this.vkQuery('messages.send', params, (res) => {
            if (callback) callback(res)
        })
    }

    sendMessage2 (params, callback) {
        this.messagePool.push(params) 
        if (callback) callback('')
    }

    getCaptcha (url, callback) {
        logger.warning('Captcha needed!')
        ag.processFromURL(url, (error, text, id) => {
          if (error) {
          } else {
            logger.warning('Captcha code: ' + text)
            callback (text)
          }
        });
    }

    getUploadUrl (callback) {
        this.vkQuery('audio.getUploadServer', {}, (res) => {
            callback(res.upload_url);
        });
    }

    getCurrentUser (callback) {
        this.vkQuery('users.get', {}, (res) => {
            if (res[0]) {
                callback(res[0]);
            } else {
                callback(false);
            }
        });
    }

    getUser (id, callback) {
        this.vkQuery('users.get', {user_ids: id, fields: 'sex'}, (res) => {
            if (res[0]) {
                callback(res[0]);
            } else {
                callback(false);
            }
        });
    }

    createComment (ownerId, postId, message, callback) {
        this.vkQuery('wall.createComment', {owner_id: ownerId, post_id: postId, message: message}, (res) => {
            if (callback) callback(res)
        });
    }

    removeChatUser (chatId, userId, callback) {
        if (!config.auth.admin.includes(userId.toString())) {

            this.vkQuery('messages.removeChatUser', {chat_id: chatId, access_token:config.net.admin_token, user_id: userId}, (res) => {
                if (callback) callback(res)
            });
        } else {
            if (callback) callback(false)
        }
    }

    getFriendRequests (callback) {
        this.vkQuery('friends.getRequests', {count: 1000, need_viewed: 1}, (res) => {
            if (res) {
                var friends = res.items
                var resFriends = []
                for (var i = 0; i < friends.length; i++ ) {
                    if (!isBadFriend(friends[i])) {
                        resFriends.push(friends[i])
                    }
                }

                callback(resFriends);
            }
        });
    }

    acceptFriend (id, callback) {
        this.vkQuery('friends.add', {user_id:id}, (res) => {
            if (res == 2) {
                callback(true)
            } else {
                callback(false)
            }
        });
    }

    acceptAllFriends(callback) {
        this.getFriendRequests((friends) => {
            if (friends.length > 0) {
                this.acceptFriends(friends, false, (res) => {
                    callback(res)
                })
            } else {
                callback(false)
            }
        })
    }

    acceptFriends (friends, co, callback) {
        if (!co) {
            var co = 0;
        }

        if (friends.length > 0) {
            var id = friends.shift()
            this.acceptFriend(id, (res) => {
                if (res) {
                    co++
                } else {
                    this.addBadFriend(id)
                }
                this.acceptFriends(friends, co, callback)
            })
        } else {
            callback(co)
        }
    }

    getNotify (callback) {
        this.vkQuery('notifications.get', {count: 100}, (res) => {
            if (res) callback(res);
        });
    }

    getChatUsers (chatId, callback) {
        this.vkQuery('messages.getChatUsers', {chat_id: chatId}, (res) => {
            if (res) callback(res);
        });
    }

    getChatUsersFull (chatId, callback) {
        this.vkQuery('messages.getChatUsers', {chat_id: chatId, fields: 'screen_name,sex'}, (res) => {
            if (res) callback(res);
        });
    }

    getChats (callback) {
        var chats = []
        this.vkQuery('messages.getDialogs', {}, (res) => {
            res.items.forEach((item) => {
                if (item.message.admin_id) chats.push(item);
            })

            if (callback) callback(chats);
        });
    }

    getFollowers (callback) {
        var follows = []
        this.getNotify((res) => {
            var n = res.items
            for (var i = 0; i < n.length; i++) {
                if (n[i].type == 'follow') {
                    var val = n[i].feedback.items;

                    for (var k = 0; k < val.length; k++) {
                        var id = val[k].from_id
                        if (!isBadFriend(id)) {
                            follows.push(val[k].from_id)
                        }
                    }
                }
            }
            callback(follows)
        })  
    }

    friendsLoop () {
        this.loadBadFriends()
        var interval = this.friends_loop_interval * 1000
        acceptAllFriends((res) => {
            if (res > 0) logger.verbose(res + ' friends accepted')
            else logger.verbose('Is no friend requests')
            setTimeout(() => {
                this.friendsLoop(i)
            }, interval)
        })
    }

    addBadFriend (id) {
        if (!isBadFriend(id)) {
            badFriends.push(id)
            fs.writeFileSync(badFriendsFile, JSON.stringify(badFriends))
            logger.verbose('Bad friend added')
        }
    }

    isBadFriend (id) {
        for (var i = 0; i < badFriends.length; i++) {
            if (badFriends[i] == id) {
                return true
            } else {
                return false
            }
        }
    }

    loadBadFriends () {
        var str = fs.readFileSync(badFriendsFile, 'utf-8');
        badFriends = JSON.parse(str)
    }

    getChatId (peer_id) {
        var res = peer_id - 2000000000;

        return res.toString();
    }
}

module.exports = Api
