'use strict'
const BootBot = require('bootbot');

const bot = new BootBot({
  accessToken: '[removed]',
  verifyToken: 'welcometoesaybot',
  appSecret: '[removed]'
});

bot.on('message', (payload, chat) => {
  const text = payload.message.text;
  chat.say(`Echo: ${text}`);
});

bot.start(443);