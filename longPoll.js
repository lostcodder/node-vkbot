const EventEmitter = require('events');
var request = require('request');

class LongPoll extends EventEmitter {
  constructor(api) {
    super()
    this.api = api
    this.params = this.api.params
  }    

  start () {
        this.getUpdates((updates) => {
            if (updates) {
                updates.forEach((item, i, arr) => {
                    if ((item[0] == 4) && (!(item[2]&2))) {
                        var msg = this.createMessage(item)
                        if (!msg.attachments.source_act) {
                            this.emit('message', msg)
                        } else if (msg.attachments.source_act == 'chat_title_update') {
                            this.emit('topic', msg)
                        } else if (msg.attachments.source_act == 'chat_invite_user') {
                            this.emit('chat_invite_user', msg);                        
                        } else if (msg.attachments.source_act == 'chat_kick_user') {
                            this.emit('chat_kick_user', msg);                        
                        }
                    }
                })
            }
        })
    }

    createMessage(data) {
        if (data[7].from && data[7].fwd) {
            var fwd = this.splitFwd(data[7].fwd);
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
        msg.chat_id = this.getChatId(msg.peer_id)

        if (data[7]) {
            msg.attachments = data[7]
        }
        return msg  
    }

    getServer (callback) {
        this.api.vkQuery('messages.getLongPollServer', {}, (res) => {
            if (res) {
                this.server = res;
                logger.verbose('Get server OK: ')
                logger.verbose(this.server)
                callback(res);
            } else {
                logger.warning('getServer fail: ');
                logger.warning('Retry after ' + this.params.retry_interval + ' sec');
                setTimeout(() => { 
                    this.getServer(callback);
                }, this.params.retry_interval * 1000)
            }
        });
    }

    splitFwd (str) {
        var c = str.split(':').length - 1;
        if (c > 0 ){
            var e = (c == 1) ? ')' : ':';
            var res = str.substr(str.indexOf('(')+1);
            res = res.substr(0,res.indexOf(e));
        
            var arr = res.split('_');
            res = {to_id: arr[0], message_id: arr[1]}
            if (parseInt(res.to_id) == this.user) {
                return res;
            }
        }

        return false;  
    }

    getUpdates (callback) {
        this.getServer(() => {
            this.pollQuery ((body) => {
                callback(body.updates);
            })
        })
    }

    pollQuery (callback) {
        this.pollRequest((res) => {
            callback(res);
            this.pollQuery(callback);
        });
    };

    pollRequest (callback) {
        var url = `https://${this.server.server}?act=a_check&key=${this.server.key}&ts=${this.server.ts}&wait=25&mode=2&version=1`;
        request(url, (error, response, res) => { 
            if (!error) {
                try {
                    res = JSON.parse(res);
                    this.server.ts = res.ts
                }
                catch (e) {
                    logger.warning('pollRequest fail 3 ' + e);
                    logger.warning('Retry after ' + this.params.retry_interval + ' sec');
                        this.pollRequest(callback);
                }
                
                if (!res.failed) {
                    logger.verbose('pollRequest OK:');
                    logger.verbose(res);
                    callback(res);    
                }
                else if (res.failed == 1){
                    logger.verbose('pollRequest fail 1:');
                    logger.verbose(res);
                    this.pollRequest(callback);
                } else {
                    logger.verbose('pollRequest fail 2:');
                    logger.verbose(res);
                    this.getServer(() => {
                        this.pollRequest(callback);
                    }) 
                }
            }
            else {
                logger.warning('pollRequest fail 4: ' + error);
                logger.warning('Retry after ' + this.params.retry_interval + ' sec');
                setTimeout(() => { 
                    this.getServer(() => {
                        this.pollRequest(callback);
                    }) 
                }, this.params.retry_interval * 1000)    
            }
        })
    }

    getChatId (peer_id) {
        var res = peer_id - 2000000000;

        return res.toString();
    }
}

module.exports = LongPoll