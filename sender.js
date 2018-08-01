const request = require('request');
const PAGE_ACCESS_TOKEN = '[removed]';
var Q = require('q');

// Sends response messages via the Send API
exports.sendMessage = function (sender_psid, message_text) {

	// Construct the message body
	let request_body = {
		"recipient": {
			"id": sender_psid
		},
		"message": {
			"text": message_text
		}
	}

	// Send the HTTP request to the Messenger Platform
	request({
		"uri": "https://graph.facebook.com/v2.6/me/messages",
		"qs": { "access_token": PAGE_ACCESS_TOKEN },
		"method": "POST",
		"json": request_body
	}, (err, res, body) => {
		if (!err) {
			console.log('Response: ' + message_text)
		} else {
			console.error("Unable to send message:" + err);
		}
	}); 
}

exports.sendImage = function (sender_psid, image_link) {
	
	// Construct the message body
	let request_body = {
		"recipient": {
			"id": sender_psid
		},
		"message": {
			"attachment":{
				"type":"image", 
				"payload":{
					"url": image_link, 
					"is_reusable":true
				}
			}
		}
	}

	// Send the HTTP request to the Messenger Platform
	request({
		"uri": "https://graph.facebook.com/v2.6/me/messages",
		"qs": { "access_token": PAGE_ACCESS_TOKEN },
		"method": "POST",
		"json": request_body
	}, (err, res, body) => {
		if (!err) {
			console.log('Response: ' + image_link)
		} else {
			console.error("Unable to send image:" + err);
		}
	}); 
}

exports.typing = function (sender_psid) {
	
	let request_body = {
		"recipient": {
			"id": sender_psid
		},
		"sender_action":"typing_on"
	}
	
	request({
		"uri": "https://graph.facebook.com/v2.6/me/messages",
		"qs": { "access_token": PAGE_ACCESS_TOKEN },
		"method": "POST",
		"json": request_body
	}, (err, res, body) => {
		if (err) console.error("Typing error:" + err);
	}); 
}

exports.stop_typing = function (sender_psid) {
	
	let request_body = {
		"recipient": {
			"id": sender_psid
		},
		"sender_action":"typing_off"
	}
	
	request({
		"uri": "https://graph.facebook.com/v2.6/me/messages",
		"qs": { "access_token": PAGE_ACCESS_TOKEN },
		"method": "POST",
		"json": request_body
	}, (err, res, body) => {
		if (err) console.error("Typing error:" + err);
	}); 
}

exports.mark_seen = function (sender_psid) {
	let request_body = {
		"recipient": {
			"id": sender_psid
		},
		"sender_action":"mark_seen"
	}
	
	request({
		"uri": "https://graph.facebook.com/v2.6/me/messages",
		"qs": { "access_token": PAGE_ACCESS_TOKEN },
		"method": "POST",
		"json": request_body
	}, (err, res, body) => {
		if (err) console.error("Mark Seen:" + err);
	}); 
}

exports.conv = function (sender_psid, id, msgVals) {
	console.log("senderid:");
	console.log(sender_psid);
	console.log("msgid:");
	console.log(id);
	switch (id) {
		case 0: //new user, welcome to the chatbot, begin setup
			exports.typing(sender_psid);
			console.log("typing " + id);
			Q.delay(2000).done(function message2() {
				exports.sendMessage(sender_psid, `Hello! My name is Esay, the Smart Homework Assistant Chat Bot. I'm here to help you keep track of your scholarly life.`);
				exports.typing(sender_psid);
			});
			Q.delay(3000).done(function () {
				exports.sendMessage(sender_psid, `Before we get started with your classes, what would you like me to call you?`);
				exports.stop_typing(sender_psid);
			});
			break;
		case 10: //stale user, begin setup
			exports.sendMessage(sender_psid, `Hello again! Let's get you set up.`);
			exports.typing(sender_psid);
			Q.delay(1000).done(function message2() {
				exports.sendMessage(sender_psid, `What would you like me to call you?`);
				exports.stop_typing(sender_psid);
			});
			break;
		case 20:
			exports.sendMessage(sender_psid, `Okay, hi `+ msgVals.name +`!`);
			exports.typing(sender_psid);
			Q.delay(1000).done(function message2() {
				exports.sendMessage(sender_psid, `At any time in the setup, if I get something wrong, just say "no" or "wrong", and I'll go back a step.`);
				exports.typing(sender_psid);
			});
			Q.delay(4000).done(function message3() {
				exports.sendMessage(sender_psid, `Let's start by keeping track of your current schedule. At the moment I only know classes from Spring 2018, University of Maryland, College Park. `);
				exports.typing(sender_psid);
			});
			Q.delay(5000).done(function message4() {
				exports.sendMessage(sender_psid, `Head over to Canvas and send me your calendar.`);
				exports.typing(sender_psid);
			});
			Q.delay(5100).done(function message5() {
				exports.sendMessage(sender_psid, `1. Go to your Calendar.`);
				exports.typing(sender_psid);
			});
			Q.delay(5200).done(function message6() {
				exports.sendMessage(sender_psid, `2. Click on 'Calendar Feed'`);
				exports.typing(sender_psid);
			});
			Q.delay(5300).done(function message7() {
				exports.sendMessage(sender_psid, `3. Copy the link, and send it to me!`);
				exports.typing(sender_psid);
			});
			Q.delay(6000).done(function message8() {
				exports.sendImage(sender_psid, 'https://i.imgur.com/QTJdYiM.jpg');
				exports.typing(sender_psid);
			});
			Q.delay(6200).done(function message9() {
				exports.sendImage(sender_psid, 'https://i.imgur.com/3y8gPw4.jpg');
				exports.stop_typing(sender_psid);
			});
			break;
		case -20:
			exports.sendMessage(sender_psid, `That doesn't look like a link, if you don't have one, just say 'skip'`);
			break;
		case -21:
			exports.sendMessage(sender_psid, `Sorry that link didn't work, try again, or if it's not working just say 'skip'`);
			break;
		case 25:
			exports.sendMessage(sender_psid, `Alright perfect!`);
			exports.typing(sender_psid);
			Q.delay(1000).done(function message2() {
				exports.sendMessage(sender_psid, `From this calendar, I see you have these classes: ` + msgVals.classes);
				exports.typing(sender_psid);
			});
			Q.delay(3000).done(function message3() {
				exports.sendMessage(sender_psid, `Did I miss anything? Type in all of your course codes, one at a time. Then say 'done' when you're done!`);
				exports.stop_typing(sender_psid);
			});
			break;
		case 26:
			exports.sendMessage(sender_psid, `Alright, you can just tell me all your classes manually then.`);
			exports.typing(sender_psid);
			Q.delay(3000).done(function message3() {
				exports.sendMessage(sender_psid, `Type in all of your course codes, one at a time. Then say 'done' when you're done!`);
				exports.stop_typing(sender_psid);
			});
			break;
		case 30:
			exports.sendMessage(sender_psid, msgVals.id + `, a ` + msgVals.credits + ` credit ` + msgVals.dept + ` class called: ` + msgVals.name);
			break;
		case -30: 
			switch (getRandomInt(3)) {
				case 1:
				exports.sendMessage(sender_psid, "Sorry I couldn't find that course. Please type the ABCD123 course code.");
				break;
				case 2:
				exports.sendMessage(sender_psid, "I searched and I couldn't find that course. Try to send me the ABCD123 course code.");
				break;
				case 3:
				exports.sendMessage(sender_psid, "The directory doesn't have that course. Please send me the ABCD123 course code.");
				break;
			}
			break;
		case 31:
			exports.sendMessage(sender_psid, `Okay, so you're taking ` + msgVals.classes);
			exports.typing(sender_psid);
			Q.delay(1000).done(function message2() {
				exports.sendMessage(sender_psid, `And I calculated that's ` + msgVals.credits + ` credits.`);
				exports.typing(sender_psid);
			});
			if (msgVals.credits >= 17) {
				Q.delay(2000).done(function message2() {
					exports.sendMessage(sender_psid, `Wow you're really busy.`);
					exports.typing(sender_psid);
				});
			} else if (msgVals.credits > 14) {
				Q.delay(2000).done(function message2() {
					exports.sendMessage(sender_psid, `Wow that's a nice full schedule.`);
					exports.typing(sender_psid);
				});
			} else if (msgVals.credits >= 12) {
				Q.delay(2000).done(function message2() {
					exports.sendMessage(sender_psid, `So that means you're a full time student.`);
					exports.typing(sender_psid);
				});
			} else {
				Q.delay(2000).done(function message2() {
					exports.sendMessage(sender_psid, `So that means you're a part time student.`);
					exports.typing(sender_psid);
				});
			}
			Q.delay(3000).done(function message2() {
				exports.sendMessage(sender_psid, `Did I get everything right?`);
				exports.stop_typing(sender_psid);
			});
			break;
		case 40:
			exports.sendMessage(sender_psid, `Congratulations! You're set up!`);
			exports.typing(sender_psid);
			Q.delay(1000).done(function message2() {
				exports.sendMessage(sender_psid, `From now on, just text me if you need anything.`);
				exports.typing(sender_psid);
			});
			Q.delay(2000).done(function message2() {
				exports.sendMessage(sender_psid, `Right now I can help you with adding assignments, showing your assignments, and setting up again. Just say 'help' for a list of commands.`);
				exports.typing(sender_psid);
			});
			Q.delay(3000).done(function message2() {
				exports.sendMessage(sender_psid, `If your professor doesn't use canvas well, don't forget to tell me about upcoming assignments and exams! Leave it up to me to remind you once or twice a day about your upcoming assignments!`);
				exports.stop_typing(sender_psid);
			});
		break;
		case -40:
			exports.sendMessage(sender_psid, "Alright, let's try again. What's your name?");
		break;
		
		case 100:
			switch (getRandomInt(3)) {
				case 1:
					exports.sendMessage(sender_psid, "Hey " + msgVals.name);
				break;
				case 2:
					exports.sendMessage(sender_psid, "Hi " + msgVals.name);
				break;
				case 3:
					exports.sendMessage(sender_psid, "Hello " + msgVals.name);
				break;
			}
			exports.typing(sender_psid);
			Q.delay(500).done(function message2() {
			switch (getRandomInt(3)) {
				case 1:
					exports.sendMessage(sender_psid, `How can I help you?`);
				break;
				case 2:
					exports.sendMessage(sender_psid, `What can I do for you?`);
				break;
				case 3:
					exports.sendMessage(sender_psid, `Do you need anything?`);
				break;
			}
				exports.stop_typing(sender_psid);
			});
		break;
		case 110:
			exports.sendMessage(sender_psid, "Here's a list of things I can do: \n- Tell you what homework you have\n- Add to your homework list\n- Mark your homework complete\n- Remind you about upcoming homework\n- Add new classes\n- Be muted");
		break;
		
		case 200:
			console.dir(msgVals.assignments);
			if (msgVals.assignments.length > 0) {
				exports.sendMessage(sender_psid, `In the next ` + msgVals.time + ` you have:`);
				exports.typing(sender_psid);
				msgVals.msg = "==========================";
				var printdate = "";
				for (key in msgVals.assignments) {		
					if (msgVals.assignments[key]['FormatDueDate'] !== printdate) {
						msgVals.msg += "\n" + msgVals.assignments[key]['FormatDueDate'] + ":"
						printdate = msgVals.assignments[key]['FormatDueDate'];
					}
					msgVals.msg += "\n| " + msgVals.assignments[key]['Code'] + ": " + msgVals.assignments[key]['AssignmentName'];	
				}
				msgVals.msg += "\n==========================";
				Q.delay(500).done(function message2() {
					exports.sendMessage(sender_psid, msgVals.msg.substring(1));
					exports.stop_typing(sender_psid);
				});
			} else {
				exports.sendMessage(sender_psid, "You have no assignments due in the next " + msgVals.time + ".");
			}
		break;
		
		case 210:
			switch (getRandomInt(4)) {
				case 1:
					exports.sendMessage(sender_psid, "Hey " + msgVals.name + ", just a heads up");
				break;
				case 2:
					exports.sendMessage(sender_psid, "Hey " + msgVals.name + ", quick update");
				break;
				case 3:
					exports.sendMessage(sender_psid, "Quick update!");
				break;
				case 4:
					exports.sendMessage(sender_psid, "Hey " + msgVals.name + "!");
				break;
			}
		break;
		case 220:
			var assignmentListing = "";
			for (key in msgVals.assignments) {
				assignmentListing += "\n" + msgVals.assignments[key];
			}
			exports.sendMessage(sender_psid, assignmentListing + "\njust showed up on your Canvas calendar.");
		break;
		
		case 300:
			switch (getRandomInt(4)) {
				case 1:
					exports.sendMessage(sender_psid, `No problem! :)`);
				break;
				case 2:
					exports.sendMessage(sender_psid, "You're welcome! :)");
				break;
				case 3:
					exports.sendMessage(sender_psid, "It's a pleasure helping you");
				break;
				case 4:
					exports.sendMessage(sender_psid, "Anytime!");
				break;
			}
		break;
		
		case 400:
			exports.sendMessage(sender_psid, `Tell me the class code you'd like to add to your schedule.`);
		break;
		case 410: 
			exports.sendMessage(sender_psid, "Okay, I've added " + msgVals.name + " to your class schedule.");
		break;
		case -410: 
			exports.sendMessage(sender_psid, "Sorry, I looked for " + msgVals.code + " but I couldn't find it in the " + msgVals.univ + " directory. Try again?");
		break;
		case 420:
			switch (getRandomInt(2)) {
				case 1:
					exports.sendMessage(sender_psid, "Okay nevermind then");
				break;
				case 2:
					exports.sendMessage(sender_psid, "Alright, nevermind");
				break;
			}
		break;
		case 450:
			exports.sendMessage(sender_psid, `Tell me the assignment you'd like add to your schedule.`);
		break;
		case 460:
			exports.sendMessage(sender_psid, "========DRAFT=======" + msgVals.known + "\n========DRAFT=======\nWhat is the assignment " + msgVals.askFor + "?");
		break;
		case 470:
			exports.sendMessage(sender_psid, "====================" + msgVals.known + "\n====================" + "\nIs this right?");
		break;
		case 480: 
			exports.sendMessage(sender_psid, "Okay, assignment added to your todo list!");
		break;
		case -480:
			exports.sendMessage(sender_psid, "Oops, sorry, let's try again. What is the assignment name?")
		break;
		
		case 510:
			exports.sendMessage(sender_psid, `What was the assignment name you finished?`);
		break;
		case 520:
			exports.sendMessage(sender_psid, "Great job! " + msgVals.assignments[0]['Code'] + " " + msgVals.assignments[0]['AssignmentName'] + " marked off your todo list.");
		break;
		case 530:
			msgVals.msg = "I found a couple similar assignments on your todo list. Which one did you complete?";
			for (key in msgVals.assignments) {
				msgVals.msg += "\n" + (parseInt(key)+1) + ". " + msgVals.assignments[key]['AssignmentName'];	
			}
			exports.sendMessage(sender_psid, msgVals.msg);
		break;
		case 540:
			exports.sendMessage(sender_psid, "Sorry if I wasn't clear, give me the number for the assignment you finished.");
		break;
		
		case 1000:
			exports.sendMessage(sender_psid, "I'm sorry if I'm annoying you. Would you like me to completely forget you and end all communication?");
		break;
		case 1010:
			exports.sendMessage(sender_psid, "It was nice chatting with you! Good bye " + msgVals.name + " 🤐");
		break;
		case 1020:
			exports.sendMessage(sender_psid, "Okay nevermind then, I'll continue to keep you updated with your homework assignments!");
		break;
		case 1100:
			exports.sendMessage(sender_psid, "Would you like to go through the setup process again?");
		break;
		default:
			exports.sendMessage(sender_psid, "Sorry, there was an error in the conversation generator. Error: " + id);
		break;
	}
	
}

var counter = 0;

function getRandomInt(max) {
//  return Math.floor(Math.random() * Math.floor(max)) + 1;
	return counter++ % max + 1;
}