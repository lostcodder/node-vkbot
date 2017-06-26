var Api = require('./api.js')
var LongPoll = require('./longPoll.js')

class VKBot {
    constructor(params) {
        this.params = params
        this.api = new Api(this.params)
        this.longPoll = new LongPoll(this.api)
        this.longPoll.start()
    }
}

module.exports = VKBot