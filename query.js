const querystring = require('querystring');
var request = require('request')

class Query {
    constructor(params) {
        this.params = params
    }

    vkQuery (method, pa, callback) {
        var p = pa;
        if (!p.access_token) p.access_token = this.params.access_token;
        p.v = '5.60';
        p = querystring.stringify(p);
        var url = 'https://api.vk.com/method/'+ method;
        var q = { url: url, body: p}
        request.post(q, (error, response, body) => {
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
                console.log(e);
                logger.warning('vkQuery fail 2:')
                logger.warning(q)
                logger.warning(body)
                callback(false)
            }
        })
    }

    vkQuery5 (method, pa, callback) {
        var q = {method: method, pa: pa, callback: callback}
        this.queryPool.push(q)
    }

    vkQuery2 (q, callback) {
        var method = q.method
        var pa = q.pa
        var p = pa;
        if (!p.access_token) p.access_token = this.params.access_token;
        p.v = '5.60';
        p = querystring.stringify(p);
        var url = 'https://api.vk.com/method/'+ method;
        var qr = { url: url, body: p}
        request.post(qr, (error, response, body) => {
            try {
                var res = JSON.parse(body);
                if (res.response) {
                    logger.verbose('vkQuery OK:')
                    logger.verbose(q)
                    logger.verbose(res.response)
                    q.callback(res.response);
                } else if (res.error) {
                    logger.verbose('vkQuery fail 1:')
                    logger.verbose(q)
                    logger.verbose(res.error)
                    q.callback(res.error)
                }
            }
            catch(e) {
                console.log(e);
                logger.warning('vkQuery fail 2:')
                logger.warning(q)
                logger.warning(body)
                q.callback(false)
            }
        })
    }

    doQueries () {
        if (this.queryPool) {
            setTimeout(()=>{
                if (this.queryPool.length > 0) {
                    var q = this.queryPool.shift()
                    this.vkQuery2(q, (r)=> {
                        if (!r.captcha_img) {
                            q.callback(r)
                            this.doQueries()
                        } else {
                            this.getCaptcha(r.captcha_img, (c)=>{
                                q.pa.captcha_sid = r.captcha_sid
                                q.pa.captcha_key = c
                                this.queryPool.unshift(q)
                                this.doQueries()
                            })
                        }
                    })
                } else {
                    this.doQueries()
                }
            }, 334)
        }
    }
}

module.exports = Query