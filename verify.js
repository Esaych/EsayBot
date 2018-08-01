'use strict';

// Imports dependencies and set up http server
var express = require('express');
var bodyParser = require('body-parser');
var https = require('https');
var fs = require('fs');

var app = express().use(bodyParser.json());

const PAGE_ACCESS_TOKEN = '[removed]';

var options = {
    key: fs.readFileSync('./ssl/esaybot_me.key'),
    cert: fs.readFileSync('./ssl/www_esaybot_me.crt'),
	ca: fs.readFileSync ('./ssl/www_esaybot_me.ca-bundle')
};

https.createServer(options, app).listen(443);

var http = require('http');
http.createServer(function (req, res) {
    res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
    res.end();
}).listen(80);


app.all(/.*/, function(req, res, next) {
  var host = req.header("host");
  if (host.match(/^www\..*/i)) {
    next();
  } else {
    res.redirect(301, "https://www." + host + req.url);
  }
});
app.use(express.static(__dirname + "/public"));

// Test app
app.get('/', function(req, res){
  res.send('hello world');
});

// Creates the endpoint for our webhook 
app.post('/fbwebhook', (req, res) => {  
 
  let body = req.body;

  // Checks this is an event from a page subscription
  if (body.object === 'page') {

    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach(function(entry) {

      // Gets the message. entry.messaging is an array, but 
      // will only ever contain one message, so we get index 0
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);
    });

    // Returns a '200 OK' response to all requests
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Returns a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});

// Adds support for GET requests to our webhook
app.get('/fbwebhook', (req, res) => {

  // Your verify token. Should be a random string.
  let VERIFY_TOKEN = "welcometoesaybot"
    
  // Parse the query params
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];
    
  // Checks if a token and mode is in the query string of the request
  if (mode && token) {
  
    // Checks the mode and token sent is correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      
      // Responds with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);      
    }
  }
});