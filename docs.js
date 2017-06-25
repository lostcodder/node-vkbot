var u = require('url');
var tts = require('../tts.js')
var md5 = require('md5');
var streamBuffers = require('stream-buffers');
var fs = require("fs");
var docs = {}

docs.getUploadServer = (callback) => {
    bot.vkQuery('docs.getUploadServer', {type: 'audio_message'}, function(res) {
        if (callback) callback(res.upload_url);
    });
}

docs.save = (file, callback) => {
    bot.vkQuery('docs.save', {file: file}, function(res) {
        if (callback) callback(res);
    });
}

docs.upload = (b, callback) => {
    docs.getUploadServer((url)=>{
        var formData = {
            file: {
                value:  b,
                options: {
                  filename: 'xxx.mp3'
                }
            }
        }
        request.post({ url: url, json: true, formData: formData}, function (error, response, body) {
            docs.save(body.file, (r)=> {
                callback(r)
            })
        })  
    })
}

docs.voice = (p, msg) => {
    tts.query2( p, (b)=>{
        docs.upload(b, (r)=>{
            console.log(r);
            bot.sendMessage({peer_id: msg.peer_id, attachment: 'doc' + r[0].owner_id + '_' + r[0].id})
        })
    })
}

//docs.voice('Проверка связи', {peer_id: '392646963'})
commands.add([{com: ['!v', '!voice', '!г', '!голос'], fn: docs.voice}])

module.exports = docs
