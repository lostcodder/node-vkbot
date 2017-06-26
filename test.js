var VKBot = require('./index.js')
var bot = new VKBot({access_token: '9e8fa600d85a2f74ab7d5759b8de03cb28e49cd0e45c012256c0ba91c950e3b027174dc9a166f92c702d5'})
bot.api.getCurrentUser((u)=> {
    console.log(u);
})

bot.longPoll.on('message', (msg)=>{
    console.log(msg);
})

bot.longPoll.on('topic', (msg)=>{
    console.log(msg);
})

bot.longPoll.on('chat_invite_user', (msg)=>{
    console.log(msg);
})

bot.longPoll.on('chat_kick_user', (msg)=>{
    console.log(msg);
})