var fs = require("fs");

const EventEmitter = require('events');
class MyEmitter extends EventEmitter {}
const events = new MyEmitter();
var queryPool = []
var stream = require("stream")
var badFriends = []
var badFriendsFile = __dirname + '/badfriends.json'

const querystring = require('querystring');

var Antigate = require('antigate');
var ag = new Antigate('bc557b2f0e211930e17c8736dd5751fa');

global.request = require('request');
var pony_id = config.net.vk_id;

var server;
var retry_interval  = config.net.retry_interval * 1000;
var captcha = false 
var messagePool = []

exports.docs = require("./docs.js");

var messageLoop = function (p) {
    if (messagePool.length > 0 || p) {
        if (p) {
            var param = p
        } else {
            var param = messagePool.shift();
        }

        vkQuery('messages.send', param, function(res){
            if (res.captcha_img) {
                getCaptcha(res.captcha_img, (text) => {
                    param.captcha_sid = res.captcha_sid
                    param.captcha_key = text
                    messageLoop(param)
                })
            }
            else
            {
                messageLoop()
            }
        }) 
    }
    else {
        setTimeout(()=> {
            messageLoop()
        }, 10)   
    }
}

var editChat = function (params, callback) {
    vkQuery('messages.editChat', params, function(res){
        if (callback) callback(res)
    })
}

var sendMessage = function (params, callback) {
    vkQuery('messages.send', params, function(res){
        if (callback) callback(res)
    })
}

var sendMessage2 = function (params, callback) {
    messagePool.push(params) 
    if (callback) callback('')
}

var messageEvent = function (callback) {
    updateEvent(function(data) {  
        if ((data[0] == 4) && (!(data[2]&2))) {
            if (data[7].from && data[7].fwd) {
                var fwd = splitFwd(data[7].fwd);
            }

            var msg = {
                id: data[1],
                peer_id: data[3],
                timestamp: data[4],
                subject: data[5],
                text: data[6].trim().replace(new RegExp('&quot;','g'),'"').replace(new RegExp('&quot;','g'),'"'),
                type: (data[7].from) ? 'b' : 'm',
                from: (data[7].from) ? data[7].from : data[3],
                fwd: (fwd) ? fwd : false,
                isChat: () => {
                    if (msg.type == 'b') return true
                    else return false
                }
            };

            if (config.auth.admin.includes(msg.from)) {
                msg.admin = true
                msg.op = true
            } if (ops.exists(msg.from)) {
                msg.op = true
            }

            msg.chat_id = getChatId(msg.peer_id)

            callback(msg)   
        } 
    });
};

var splitFwd = function (str) {
    var c = str.split(':').length - 1;
    if (c > 0 ){
        var e = (c == 1) ? ')' : ':';
        var res = str.substr(str.indexOf('(')+1);
        res = res.substr(0,res.indexOf(e));
    
        var arr = res.split('_');
        res = {to_id: arr[0], message_id: arr[1]}
        if (parseInt(res.to_id) == pony_id) {
            return res;
        }
    }

    return false;  
}


var updateEvent = function(callback) {
    getUpdates (function (updates) {
        if ( updates) {
            updates.forEach(function(item, i, arr) {
                if (item[7] && item[7].source_text) {
                    events.emit('topic', item);
                } else if (item[0] == 4 && item[7].source_act) {
                    var ev = {user_id: item[7].source_mid, from_id: item[7].from, chat_id: getChatId(item[3])}
                    
                    if (item[7].source_act == 'chat_invite_user') {
                        events.emit('chat_invite_user', ev);                        
                    } else if (item[7].source_act == 'chat_kick_user') {
                        events.emit('chat_kick_user', ev);                        
                    }
                } 
                
                callback(item);
            });
        }
    });
};

var getUpdates = function(callback) {
    getServer(function () {
        pollQuery (function (body) {
            callback(body.updates);
        })
    })
}

var getServer = function(callback) {
    vkQuery('messages.getLongPollServer', {}, function(res) {
        if (res) {
            server = res;
            logger.verbose('Get server OK: ')
            logger.verbose(server)
            loadBadFriends()
            callback();
        } else {
            logger.warning('getServer fail: ');
            logger.warning('Retry after ' + config.net.retry_interval + ' sec');
            setTimeout(function() { 
                getServer(callback);
            }, retry_interval)
        }
    });
}

var getCaptcha = function (url, callback) {
    logger.warning('Captcha needed!')
    ag.processFromURL(url, function(error, text, id) {
      if (error) {
      } else {
        logger.warning('Captcha code: ' + text)
        callback (text)
      }
    });
}

var vkQuery3 = function(method, pa, callback) {
    var p = pa;
    if (!p.access_token) p.access_token = access_token;
    p.v = '5.60';
    p = querystring.stringify(p);
    var url = 'https://api.vk.com/method/'+ method;
    var q = { url: url, body: p}
    request.post(q, function(error, response, body) {
        try {
            var res = JSON.parse(body);
            if (res.response) {
                logger.verbose('vkQuery OK:')
                logger.verbose(q)
                logger.verbose(res.response)
                callback(res.response);
            } else if (res.error) {
                logger.verbose('vkQuery fail 1:')
                logger.verbose(q)
                logger.verbose(res.error)
                callback(res.error)
            }
        }
        catch(e) {
            logger.warning('vkQuery fail 2:')
            logger.warning(q)
            logger.warning(body)
            callback(false)
        }
    })
}

var vkQuery2 = function(q, callback) {
    var method = q.method
    var pa = q.pa
    var p = pa;
    if (!p.access_token) p.access_token = access_token;
    p.v = '5.60';
    p = querystring.stringify(p);
    var url = 'https://api.vk.com/method/'+ method;
    var q = { url: url, body: p}
    request.post(q, function(error, response, body) {
        try {
            var res = JSON.parse(body);
            if (res.response) {
                logger.verbose('vkQuery OK:')
                logger.verbose(q)
                logger.verbose(res.response)
                callback(res.response);
            } else if (res.error) {
                logger.verbose('vkQuery fail 1:')
                logger.verbose(q)
                logger.verbose(res.error)
                callback(res.error)
            }
        }
        catch(e) {
            logger.warning('vkQuery fail 2:')
            logger.warning(q)
            logger.warning(body)
            callback(false)
        }
    })
}

var vkQuery = function(method, pa, callback) {
    queryPool.push({method: method, pa: pa, callback: callback})
}
var doQueries = () => {
    setTimeout(()=>{
        if (queryPool.length > 0) {
            var q = queryPool.shift()
            vkQuery2(q, (r)=> {
                if (!r.captcha_img) {
                    q.callback(r)
                    doQueries()
                } else {
                    getCaptcha(r.captcha_img, (c)=>{
                        q.pa.captcha_sid = r.captcha_sid
                        q.pa.captcha_key = c
                        queryPool.unshift(q)
                        doQueries()
                    })
                }
            })
        } else {
            
                doQueries()
        }
    }, 334)
}

doQueries()
var pollQuery = function(callback) {
    pollRequest(function (res) {
        callback(res);
        pollQuery(callback);
    });
};

var pollRequest = function (callback) {
    var url = `https://${server.server}?act=a_check&key=${server.key}&ts=${server.ts}&wait=25&mode=2&version=1`;
    request(url, function (error, response, res) { 

        if (!error) {
            try {
                res = JSON.parse(res);
                server.ts = res.ts
                if (!res.failed) {
                    logger.verbose('pollRequest OK:');
                    logger.verbose(res);
                    callback(res);    
                }
                else if (res.failed == 1){
                    logger.verbose('pollRequest fail 1:');
                    logger.verbose(res);
                    pollRequest(callback);
                } else {
                    logger.verbose('pollRequest fail 2:');
                    logger.verbose(res);
                    getServer(function () {
                        pollRequest(callback);
                    }) 
                }

                
            }
            catch (e) {
                logger.warning('pollRequest fail 3 ' + e);
                logger.warning('Retry after ' + config.net.retry_interval + ' sec');
                setTimeout(function() { 
                    getServer(function () {
                        pollRequest(callback);
                    }) 
                }, retry_interval)

            }
        }
        else {
            logger.warning('pollRequest fail 4: ' + error);
            logger.warning('Retry after ' + config.net.retry_interval + ' sec');
            setTimeout(function() { 
                getServer(function () {
                    pollRequest(callback);
                }) 
            }, retry_interval)    
        }
    })
};

var getUploadUrl = function (callback) {
    vkQuery('audio.getUploadServer', {}, function(res) {
        callback(res.upload_url);
    });
}

var getUserzz = function (id, callback) {
    vkQuery('users.get', {user_ids: id}, function(res) {
        if (res[0]) {
            callback(res[0]);
        } else {
            callback(false);
        }
    });
}

var getUser = function (id, callback) {
    vkQuery('users.get', {user_ids: id, fields: 'sex'}, function(res) {
        if (res[0]) {
            callback(res[0]);
        } else {
            callback(false);
        }
    });
}

var createComment = function (ownerId, postId, message, callback) {
    vkQuery('wall.createComment', {owner_id: ownerId, post_id: postId, message: message}, function(res){
        if (callback) callback(res)
    });
}

var removeChatUser = function (chatId, userId, callback) {
    if (!config.auth.admin.includes(userId.toString())) {

        vkQuery('messages.removeChatUser', {chat_id: chatId, access_token:config.net.admin_token, user_id: userId}, function(res){
            if (callback) callback(res)
        });
    } else {
        if (callback) callback(false)
    }
}

var getFriendRequests = function (callback) {
    vkQuery('friends.getRequests', {count: 1000, need_viewed: 1}, function(res) {
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

var acceptFriend = function (id, callback) {
    vkQuery('friends.add', {user_id:id}, function(res) {
        if (res == 2) {
            callback(true)
        } else {
            callback(false)
        }
    });
}

var acceptAllFriends = function (callback) {
    getFriendRequests((friends) => {
        if (friends.length > 0) {
            acceptFriends(friends, false, (res) => {
                callback(res)
            })
        } else {
            callback(false)
        }
    })
}

var acceptFriends = function (friends, co, callback) {
    if (!co) {
        var co = 0;
    }

    if (friends.length > 0) {
        var id = friends.shift()
        acceptFriend(id, (res) => {
            if (res) {
                co++
            } else {
                addBadFriend(id)
            }
            acceptFriends(friends, co, callback)
        })
    } else {
        callback(co)
    }
}

var getNotify = function (callback) {
    vkQuery('notifications.get', {count: 100}, function(res) {
        if (res) callback(res);
    });
}

var getChatUsers = function (chatId, callback) {
    vkQuery('messages.getChatUsers', {chat_id: chatId}, function(res) {
        if (res) callback(res);
    });
}

var getChatUsersFull = function (chatId, callback) {
    vkQuery('messages.getChatUsers', {chat_id: chatId, fields: 'screen_name,sex'}, function(res) {
        if (res) callback(res);
    });
}

var getChats = function (callback) {
    var chats = []
    vkQuery('messages.getDialogs', {}, function(res) {
        res.items.forEach((item) => {
            if (item.message.admin_id) chats.push(item);
        })

        if (callback) callback(chats);
    });
}

var getFollowers = function (callback) {
    var follows = []
    getNotify((res) => {
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

var uploadAudio = function(text, callback) {
    getUploadUrl (function (url) {
        var req = tts.query(text)
        req.on('response', function (res) {
            request.post({ url: url, formData: {file: res}}, function (error, response, body) {
            })
        }) 
    })
}

var friendsLoop = function(i) {
    loadBadFriends()
    var interval = i * 1000

    acceptAllFriends((res) => {
        if (res > 0) logger.verbose(res + ' friends accepted')
        else logger.verbose('Is no friend requests')
        setTimeout(()=> {
            friendsLoop(i)
        }, interval)
    })
}


var addBadFriend = function(id) {
    if (!isBadFriend(id)) {
        badFriends.push(id)
        fs.writeFileSync(badFriendsFile, JSON.stringify(badFriends))
        logger.verbose('Bad friend added')
    }
}

var isBadFriend = function(id) {
    for (var i = 0; i < badFriends.length; i++) {
        if (badFriends[i] == id) {
            return true
        } else {
            return false
        }
    }
}

var loadBadFriends = function() {
    var str = fs.readFileSync(badFriendsFile, 'utf-8');
    badFriends = JSON.parse(str)
}

var saveAudio = function (uploadData, artist, title, callback) {
    uploadData.artist = artist;
    uploadData.title = title;

    vkQuery('audio.save', uploadData, function(res) {
        if (res) callback(res);
    });
}

var createAudioAnswer = function(text, callback) {
    uploadAudio(text, callback)
    callback()

}

var getChatId = (peer_id) => {
    var res = peer_id - 2000000000;

    return res.toString();
}

friendsLoop(parseInt(config.net.friends_loop_interval))


exports.messageEvent = messageEvent;
exports.sendMessage = sendMessage;
exports.editChat = editChat;
exports.getUploadUrl = getUploadUrl;
exports.getChats = getChats;
exports.getChatUsersFull = getChatUsersFull
exports.uploadAudio = uploadAudio;
exports.saveAudio = saveAudio;
exports.getUser = getUser;
exports.messageLoop = messageLoop;
exports.getNotify = getNotify
exports.getFollowers = getFollowers
exports.getFriendRequests = getFriendRequests
exports.acceptAllFriends = acceptAllFriends
exports.friendsLoop = friendsLoop
exports.createComment = createComment
exports.acceptFriend = acceptFriend
exports.events = events
exports.loadBadFriends = loadBadFriends
exports.removeChatUser = removeChatUser
exports.getChatUsers = getChatUsers
exports.createAudioAnswer = createAudioAnswer;
exports.vkQuery = vkQuery
exports.getCaptcha = getCaptcha