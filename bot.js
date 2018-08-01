// bot.js
// launches express server
// listens for messages on esaybot.me/fbwebhook
// hosts website on esay.me for normal users

'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const https = require('https');
const fs = require('fs');
const interpreter = require('./interpreter.js');
const reminders = require('./reminders.js');

const app = express().use(bodyParser.json());

var options = {
    key: fs.readFileSync('./ssl/esaybot_me.key'),
    cert: fs.readFileSync('./ssl/www_esaybot_me.crt'),
	ca: fs.readFileSync ('./ssl/www_esaybot_me.ca-bundle')
};

// create https server for facebook
https.createServer(options, app).listen(443);

// create http server to redirect to https domain
http.createServer(function (req, res) {
    res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
    res.end();
}).listen(80);

// redirect all calls without www to https://www.
app.all(/.*/, function(req, res, next) {
  var host = req.header("host");
  if (host.match(/^www\..*/i)) {
    next();
  } else {
    res.redirect(301, "https://www." + host + req.url);
  }
});
app.use(express.static(__dirname + "/public"));

// default response for www.esaybot.me
app.get('/', function(req, res){
	fs.readFile('site/index.html', 'utf8', function(err, data) {
		res.writeHead(200, {"Content-Type": "text/html"});
		res.end(data);
	});
});

app.get('/index.html', function (req, res) { 	
	fs.readFile('site/index.html', 'utf8', function(err, data) {
		res.writeHead(200, {"Content-Type": "text/html"});
		res.end(data);
	});
});

app.get('/styles/index.css', function (req, res) { 	
	fs.readFile('site/styles/index.css', 'utf8', function(err, data) {
		res.writeHead(200, {"Content-Type": "text/css"});
		res.end(data);
	});
});
app.get('/images/coffee-schedule.jpg', function(req, res, path){
  var options = {
    root: __dirname,
    dotfiles: 'deny',
    headers: {
        'x-timestamp': Date.now(),
        'x-sent': true
    }
  };
  res.sendFile('site/images/coffee-schedule.jpg', options, function (err) {
    if (err) {
      console.log(err);
    }
  });
})
app.get('/images/esaylogo-clean-small.png', function(req, res, path){
  var options = {
    root: __dirname,
    dotfiles: 'deny',
    headers: {
        'x-timestamp': Date.now(),
        'x-sent': true
    }
  };
  res.sendFile('site/images/esaylogo-clean-small.png', options, function (err) {
    if (err) {
      console.log(err);
    }
  });
})
app.get('/images/esaylogo-background.jpg', function(req, res, path){
  var options = {
    root: __dirname,
    dotfiles: 'deny',
    headers: {
        'x-timestamp': Date.now(),
        'x-sent': true
    }
  };
  res.sendFile('site/images/esaylogo-background.jpg', options, function (err) {
    if (err) {
      console.log(err);
    }
  });
})
app.get('/images/IMG_0511.jpg', function(req, res, path){
  var options = {
    root: __dirname,
    dotfiles: 'deny',
    headers: {
        'x-timestamp': Date.now(),
        'x-sent': true
    }
  };
  res.sendFile('site/images/IMG_0511.jpg', options, function (err) {
    if (err) {
      console.log(err);
    }
  });
})
app.get('/images/favicon.ico', function(req, res, path){
  var options = {
    root: __dirname,
    dotfiles: 'deny',
    headers: {
        'x-timestamp': Date.now(),
        'x-sent': true
    }
  };
  res.sendFile('site/images/favicon.ico', options, function (err) {
    if (err) {
      console.log(err);
    }
  });
})

// bot webhook response for www.esaybot.me/fbwebhook
app.post('/fbwebhook', (req, res) => {  
 
  // Parse the request body from the POST
  let body = req.body;

  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {

    // Iterate over each entry - there may be multiple if batched
    body.entry.forEach(function(entry) {

      // Get the webhook event. entry.messaging is an array, but 
      // will only ever contain one event, so we get index 0
      let webhook_event = entry.messaging[0];

	  // Get the sender PSID
	  let sender_psid = webhook_event.sender.id;
	  
	  if (webhook_event.message) {
		console.log(webhook_event);
		interpreter.handleMessage(sender_psid, webhook_event.message);        
	  } else if (webhook_event.postback) {
		interpreter.handlePostback(sender_psid, webhook_event.postback);
	  }
      
    });

    // Return a '200 OK' response to all events
    res.status(200).send('EVENT_RECEIVED');

  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});