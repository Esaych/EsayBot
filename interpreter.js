var sender = require('./sender.js');
var database = require('./database.js');
var Q = require('q');
var request = require('request');
var ical = require('ical');
var speak = require("speakeasy-nlp");
var stringSimilarity = require('string-similarity');

var datacache = {};
var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Handles messages events
exports.handleMessage = function (sender_psid, received_message) {
	console.log("Received Message: " + received_message);
	var context = {
		userid : sender_psid,
		chat : received_message,
		entities : []
	}
	if (received_message.nlp) {
		context.entities = received_message.nlp.entities
	}
	if (received_message.text) {	
	
		//pull student
		Q.fcall(function () {
			return database.getStudent(context['userid']);
		})
		//pull latest conversation for studentid 
		.then(function (student) {
			console.log("value of student: ");
			console.log(student);
			if (!student || student.length == 0) {
				console.log("Welcome!");
				database.addStudent(context['userid']);
			} else {
				context['student'] = student[0];
			}
			return database.getConversation(context['userid']);
		})
		//if null or expired, create new, otherwise return current
		.then(function (conversation) {
			console.log("queried conversation");
			console.log(conversation);
			if (!conversation || conversation.length == 0) {
				return database.newConversation(context['userid']);
			}
			return conversation[0];
		})
		//add chat with conversation id and process response
		.then(function (conversation){
			console.log("current conversation");
			console.log(conversation);
			context['conversation'] = conversation;
			if (!context.conversation['ConversationID']) {
				context['conversation'] = conversation[1][0];
				console.log('new conv data');
				console.log(conversation[1][0]);
			}
			database.insertChat(context['chat'], conversation['ConversationID']);
			exports.processConversation(context);
		})
		// Handle any error from all above steps
		.catch(function (error) {
			console.log(error);
		})
		.done();
		
	} else if (received_message.attachments) {
  
		// Gets the URL of the message attachment
		let attachment_url = received_message.attachments[0].payload.url;
		response = {
		  "attachment": {
			"type": "template",
			"payload": {
			  "template_type": "generic",
			  "elements": [{
				"title": "Is this the right picture?",
				"subtitle": "Tap a button to answer.",
				"image_url": attachment_url,
				"buttons": [
				  {
					"type": "postback",
					"title": "Yes!",
					"payload": "yes",
				  },
				  {
					"type": "postback",
					"title": "No!",
					"payload": "no",
				  }
				],
			  }]
			}
		  }
		}
	} 
}

exports.processConversation = function (context) {
	console.log("CONTEXT VARIABLE:");
	console.log(context);
	if (!context['student'] || context['student'].length == 0) { //new user
		sender.conv(context['userid'], 0);
		database.setConversationStatus(context['conversation']['ConversationID'], 20);
	} else { 
		let message = context['chat']['text'].trim();
		if (message.includes("convid")) {
			database.setConversationStatus(context['conversation']['ConversationID'], message.split(' ')[1]);
			return;
		}
		if (message.toLowerCase().includes("back") || message.toLowerCase().includes("wrong") || message.toLowerCase() === "no") {
			var setupStatus = context['student']['SetupStatus'];
			if (setupStatus == 0) {
				sender.conv(context['userid'], -40, {});
				database.deleteStudentClasses(context['userid']);
				database.setConversationStatus(context['conversation']['ConversationID'], 20);
				return;
			}			
		}
		let convStat = context['conversation']['Status'];
		let convVals = {};
		switch (convStat) {
			case 20:
				let name = toTitleCase(message);
				database.setStudentName(context['userid'], name);
				convVals.name = name;
				sender.conv(context['userid'], 20, convVals);
				database.setConversationStatus(context['conversation']['ConversationID'], 25);
				break;
			case 25:
				if (message.startsWith('https://myelms.umd.edu/feeds/calendars/user_')) {

					ical.fromURL(message, {}, function(err, data) {
						if (err) {
							sender.conv(context['userid'], -21, convVals);
						} else {
							var assignments = [];
							database.saveCalendarLink(context['userid'], message);
							for (var k in data) {
								if (data.hasOwnProperty(k)) {
									var ev = data[k];
									if (ev.summary) {
										var matches = ev.summary.match(/^(.+)\s\[([A-Z][A-Z][A-Z][A-Z]\d\d\d[A-Z]?)\]$/);
										var assignment = {
											name: matches[1],
											course: matches[2],
											date: ev.start,
											desc: ev.description
										};
										
										assignments.push(assignment);
									}
								}
							}
							var courses = [];
							for (var key in assignments) {
								if (courses.indexOf(assignments[key].course) == -1) {
									courses.push(assignments[key].course);
								}
							}
							for (var key in courses) {
								request('https://api.umd.io/v0/courses?semester=201801&course_id=' + courses[key].toUpperCase(), function (error, response, body) {
									if (!error && response.statusCode == 200) {
										let classData = JSON.parse(body);
										classData = classData[0];
										if (classData) {
											let id = classData['course_id'];
											let name = classData['name'];
											let dept = classData['department'];
											let credits = classData['credits'];
											let semester = classData['semester'];
											
											database.addClass(context['userid'], id, credits, dept, name, semester);
										}
									}
								});
							}
							Q.delay(2000).done(function delayAddAssignments() {
								for (var key in assignments) {
									database.addAssignment(context['userid'], assignments[key].name, assignments[key].course, assignments[key].date, assignments[key].desc, exports.classifyAssignment(assignments[key].name));
								}
							});
							var coursesStr = "";
							for (key in courses) {
								coursesStr += ", " + courses[key];
							}
							convVals.classes = coursesStr.substring(2);
							sender.conv(context['userid'], 25, convVals);
							database.setConversationStatus(context['conversation']['ConversationID'], 30);
						}
					});
				} else if (message.includes('skip') || message.includes('done')) {
					sender.conv(context['userid'], 26, convVals);
					database.setConversationStatus(context['conversation']['ConversationID'], 30);
				} else {
					sender.conv(context['userid'], -20, convVals);
				}
				break;
			case 30:
				if (message.toLowerCase() === 'done') {
					Q.fcall(function () {
						return database.getClasses(context['userid'], 201801);
					})
					//pull latest conversation for studentid 
					.then(function (classes) {
						console.log("user classes found: ");
						console.log(classes);
						
						var credits = 0;
						var courses = "";
						for (key in classes) {
							credits += classes[key].Credits;
							courses += ", " + classes[key].Code;
						}
						
						convVals.classes = courses.substring(2);
						convVals.credits = credits;
						sender.conv(context['userid'], 31, convVals);
						database.setConversationStatus(context['conversation']['ConversationID'], 40);
					});
				} else {
					request('https://api.umd.io/v0/courses?semester=201801&course_id=' + message.toUpperCase(), function (error, response, body) {
						if (!error && response.statusCode == 200) {
							let classData = JSON.parse(body);
							classData = classData[0];
							if (classData) {
								let id = classData['course_id'];
								let name = classData['name'];
								let dept = classData['department'];
								let credits = classData['credits'];
								let semester = classData['semester'];
								
								database.addClass(context['userid'], id, credits, dept, name, semester);
								
								convVals.id = id;
								convVals.name = name;
								convVals.dept = dept;
								convVals.credits = credits;
								
								sender.conv(context['userid'], 30, convVals);
								database.setConversationStatus(context['conversation']['ConversationID'], 30);
							} else {
								sender.conv(context['userid'], -30, convVals);
								database.setConversationStatus(context['conversation']['ConversationID'], 30);
							}
						} else {
							sender.conv(context['userid'], -30, convVals);
							database.setConversationStatus(context['conversation']['ConversationID'], 30);
						}
					});
				}
				break;
			case 40:
				if (isYes(message)) {
					sender.conv(context['userid'], 40, convVals);
					database.endConversation(context['conversation']['ConversationID']);
					database.setSetupStatus(context['userid'], 1);
				} else {
					sender.conv(context['userid'], -40, convVals);
					database.setConversationStatus(context['conversation']['ConversationID'], 20);
				}
			break;
			case 100:
				exports.processNewConversation(message, context);
			break;
			case 410:
				if (isNo(message) || userWantsToQuit(context)) {
					sender.conv(context['userid'], 420, convVals);
					database.endConversation(context['conversation']['ConversationID']);
				} else {
					convVals.code = message.toUpperCase();
					
					request('https://api.umd.io/v0/courses?semester=201801&course_id=' + message.toUpperCase(), function (error, response, body) {
						if (!error && response.statusCode == 200) {
							let classData = JSON.parse(body);
							classData = classData[0];
							if (classData) {
								let id = classData['course_id'];
								let name = classData['name'];
								let dept = classData['department'];
								let credits = classData['credits'];
								let semester = classData['semester'];
								
								database.addClass(context['userid'], id, credits, dept, name, semester);
								
								convVals.id = id;
								convVals.name = name;
								convVals.dept = dept;
								convVals.credits = credits;
								
								sender.conv(context['userid'], 410, convVals);
								database.endConversation(context['conversation']['ConversationID']);
							} else {
								sender.conv(context['userid'], -410, convVals);
							}
						} else {
							sender.conv(context['userid'], -410, convVals);
						}
					});
				}
			break;
			case 460:
				if (userWantsToQuit(context)) {
					sender.conv(context['userid'], 420, convVals);
					database.endConversation(context['conversation']['ConversationID']);
				} else {
					if (!datacache[context['userid']]) {
						datacache[context['userid']] = {};
					}
					if (!datacache[context['userid']]['assignment']) {
						datacache[context['userid']]['assignment'] = {};
					}
					if (!datacache[context['userid']]['assignment'].name) {
						datacache[context['userid']]['assignment'].name = message;
						generateAssignmentVals(context);
					} else if (!datacache[context['userid']]['assignment'].date) {
						if (context['entities'].datetime) {
							var nlpDate = context['entities'].datetime;
							if (context['entities'].datetime[0]) {
								nlpDate = context['entities'].datetime[0];
							}
							if (nlpDate.confidence > 0.7) {
									console.log("SEARCHING DATE3");
								if (nlpDate.grain === "day") {
									console.log("SEARCHING DATE4");
									datacache[context['userid']]['assignment'].date = nlpDate.value;
								}
							}
						}
						generateAssignmentVals(context);
					} else if (!datacache[context['userid']]['assignment'].code) {
						bestClassMatch(message, context['userid'], generateAssignmentVals, context);
					}
				}
			break;
			case 470:
				sender.conv(context['userid'], 470, convVals);
				database.setConversationStatus(context['conversation']['ConversationID'], 480);
			break;
			case 480:
				if (isYes(message)) {
					database.addAssignment(
						context['userid'],
						datacache[context['userid']]['assignment'].name, 
						datacache[context['userid']]['assignment'].code, 
						datacache[context['userid']]['assignment'].date, 
						"", 
						exports.classifyAssignment(datacache[context['userid']]['assignment'].name)
					);
					sender.conv(context['userid'], 480, convVals);
					database.endConversation(context['conversation']['ConversationID']);
				} else {
					if (message.toLowerCase().includes('change')) {
						if (message.toLowerCase().includes('name') || message.toLowerCase().includes('title')) {
							datacache[context['userid']]['assignment'].name = null;
							generateAssignmentVals(context);
						} else if (message.toLowerCase().includes('due') || message.toLowerCase().includes('date')) {
							datacache[context['userid']]['assignment'].date = null;
							generateAssignmentVals(context);
						} else if (message.toLowerCase().includes('class') || message.toLowerCase().includes('course')) {
							datacache[context['userid']]['assignment'].code = null;
							generateAssignmentVals(context);
						} else {							
							sender.conv(context['userid'], -480, convVals);
							datacache[context['userid']]['assignment'] = {};
							database.setConversationStatus(context['conversation']['ConversationID'], 460);
						}
					} else {
						sender.conv(context['userid'], -480, convVals);
						database.setConversationStatus(context['conversation']['ConversationID'], 460);
						if (datacache[context['userid']])
							datacache[context['userid']]['assignment'] = {};
					}
				}
			break;
			case 510: 				
				exports.parseFinish(message, context);
			break;
			case 530:
				if (datacache[context['userid']]) {
					var assignment = datacache[context['userid']][parseInt(message)-1];
					if (assignment) {
						convVals.assignments = datacache[context['userid']];
						convVals.assignments[0] = assignment;
						sender.conv(context['userid'], 520, convVals);
						database.setAssignmentComplete(assignment['AssignmentID'], context['userid']);
						database.endConversation(context['conversation']['ConversationID']);
					} else {
						sender.conv(context['userid'], 540, convVals);
					}
				} else {
					exports.parseFinish(message, context);
				}
			break;
			case 1010:
				if (isYes(message)) {
					convVals['name'] = context['student']['Name'];
					sender.conv(context['userid'], 1010, convVals);
					database.deleteStudent(context['userid']);
				} else {
					sender.conv(context['userid'], 1020, convVals);
				}
				database.endConversation(context['conversation']['ConversationID']);
			break;
			case 1100:
				if (isYes(message)) {					
					database.deleteStudentClasses(context['userid']);
					database.setSetupStatus(context['userid'], 0);
					sender.conv(context['userid'], 0, convVals);
					database.setConversationStatus(context['conversation']['ConversationID'], 20);
				} else {
					sender.conv(context['userid'], 420, convVals);
					database.endConversation(context['conversation']['ConversationID']);
				}
			break;
			default: //user is defined, conversation was not
				var setupStatus = context['student']['SetupStatus'];
				var dbConv = context['conversation'][0];
				if (dbConv) {
					context['conversation'] = dbConv;
				}
				
				console.log('Setup Status: ' + setupStatus);
				if (setupStatus == 0) {
					sender.conv(context['userid'], 10, convVals);
					database.setConversationStatus(context['conversation']['ConversationID'], 20);
				} else {
					exports.processNewConversation(message, context);
				}
			break;
		}
	}
	
}

exports.processNewConversation = function (message, context) {	
	convVals = {};
	var studentID = context['student']['StudentID'];
	message = message.toLowerCase();
	
	if (context['entities'].greetings[0] && context['entities'].greetings[0].confidence > 0.7) {
		convVals.name = context['student']['Name'];
		sender.conv(studentID, 100, convVals);
		database.setConversationStatus(context['conversation']['ConversationID'], 100);
	} else if (context['entities'].thanks[0] && context['entities'].thanks[0].confidence > 0.7) {
		sender.conv(studentID, 300, convVals);
	} else if ((message.includes('add ') || message.includes('remind me ') || message.toLowerCase().includes('i have ')) && !message.toLowerCase().includes('what homework')) {
		if (message.includes('new class') || message.includes('add class') || message.includes('add a class') || message.match(/add [a-zA-Z]+\s?[a-zA-Z]* class/)) {
			exports.parseAddClass(message, context);
		} else {
			exports.parseAddAssignment(message, context);
		}
	} else if (message.includes('finish') || message.includes('complete') || message.includes('done')) {
		exports.parseFinish(message, context);
	} else if (message.includes('mute') || message.includes('stop') || message.includes('shut up')) {
		sender.conv(studentID, 1000, convVals);
		database.setConversationStatus(context['conversation']['ConversationID'], 1010);
	} else if (message.includes('due') || message.includes('coming') || message.includes('next') || message.includes(' i have')) {
		Q.fcall(function () {
			if (context['entities'].datetime) {
				var nlpDate = context['entities'].datetime;
				if (context['entities'].datetime[0]) {
					nlpDate = context['entities'].datetime[0];
				}
				if (nlpDate.confidence > 0.7) {
					var date1 = new Date();
					var date2 = new Date();
					var grain = "";
					if (nlpDate.type === 'interval' && nlpDate.to.value) {
						grain = nlpDate.to.grain;
						date2 = new Date(nlpDate.to.value);
					} else if (nlpDate.value) {
						grain = nlpDate.grain;
						date2 = new Date(nlpDate.value);
					}
					var distance = Math.floor((date2 - date1) / (1000*60*60*24)) + 1;
					if (grain === 'week') {
						if (distance < 7) {
							distance = 7;
						}
						distance = Math.floor((distance)/7)*7;
					}
					if (distance > 13) {
						convVals.time = Math.floor(distance/7) + " weeks";
					} else if (distance <= 1) {
						convVals.time = "day";
					} else {
						convVals.time = distance + " days";
					}
					
					return database.getAssignmentsDays(studentID, 1, distance);
				}
			}
			convVals.time = "week";
			return database.getAssignmentsDays(studentID, 1, 7);
		}).then(function (resp) {
			convVals.assignments = resp;
			sender.conv(studentID, 200, convVals);
		})
		.done();
	} else if (message.toLowerCase().includes('setup')) {
		sender.conv(studentID, 1100, convVals);
		database.setConversationStatus(context['conversation']['ConversationID'], 1100);
	} else {
		sender.conv(studentID, 110, convVals);
		database.setConversationStatus(context['conversation']['ConversationID'], 100);
	}
}

exports.parseAddClass = function(message, context) {
	sender.conv(context['student']['StudentID'], 400, convVals);
	database.setConversationStatus(context['conversation']['ConversationID'], 410);
}

exports.parseAddAssignment = function(message, context) {
	var studentID = context['student']['StudentID'];
	if (!datacache[studentID]) {
		datacache[studentID] = {};
	}
	if (!datacache[studentID]['assignment']) {
		datacache[studentID]['assignment'] = {};
	}
	
	if (context['entities'].datetime) {
		var nlpDate = context['entities'].datetime;
		if (context['entities'].datetime[0]) {
			nlpDate = context['entities'].datetime[0];
		}
		if (nlpDate.confidence > 0.7) {
			if (nlpDate.grain === "day") {
				datacache[studentID]['assignment'].date = nlpDate.value;
			}
		}
	}
	var detectedClass = message.toLowerCase();
	//common sentence structures
	var matches = message.match(/add (.+) for ([a-zA-Z0-9]+\s?[a-zA-Z0-9]*) /);
	if (matches) {
		datacache[studentID]['assignment'].name = matches[1];
		detectedClass = matches[2];
	} else {
		matches = message.match(/add (.+) to ([a-zA-Z0-9]+\s?[a-zA-Z0-9]*) /);
		if (matches) {
			datacache[studentID]['assignment'].name = matches[1];
			detectedClass = matches[2];
		} else {
			matches = message.match(/remind me to do (.+) for ([a-zA-Z0-9]+\s?[a-zA-Z0-9]*) /);
			if (matches) {
				datacache[studentID]['assignment'].name = matches[1];
				detectedClass = matches[2];
			} else {
				matches = message.match(/remind me about (.+) for ([a-zA-Z0-9]+\s?[a-zA-Z0-9]*) /);
				if (matches) {
					datacache[studentID]['assignment'].name = matches[1];
					detectedClass = matches[2];
				} else {					
					matches = message.match(/[Ii] have (.+) due in ([a-zA-Z0-9]+\s?[a-zA-Z0-9]*) /);
					if (matches) {
						datacache[studentID]['assignment'].name = matches[1];
						detectedClass = matches[2];
					} else {
						matches = message.match(/[Ii] have (.+) due for ([a-zA-Z0-9]+\s?[a-zA-Z0-9]*) /);
						if (matches) {
							datacache[studentID]['assignment'].name = matches[1];
							detectedClass = matches[2];
						}
					}
				}
			}
		}
	}
	
	bestClassMatch(detectedClass, studentID, generateAssignmentVals, context);	
}

function bestClassMatch(message, studentID, callback, context) {
	Q.fcall(function () {
		return database.getClasses(studentID, 201801);
	}).then(function (classes) {
		var bestMatch = 0.0;
		var classCode = "";
		var speakDat = speak.classify(message);
		for (word in speakDat.tokens) {
			for (key in classes) {
				var similarity = stringSimilarity.compareTwoStrings(speakDat.tokens[word], classes[key].Code); 
				if (similarity > bestMatch) {
					classCode = classes[key].Code;
					bestMatch = similarity;
					console.log("update: " + classes[key].Code + " similar: " + similarity);
				}
				similarity = stringSimilarity.compareTwoStrings(speakDat.tokens[word], classes[key].FullName); 
				if (similarity > bestMatch) {
					classCode = classes[key].Code;
					bestMatch = similarity;
					console.log("update: " + classes[key].FullName + " similar: " + similarity);
				}
			}
		}
		
		console.log("best course match: " + classCode);
		if (bestMatch > 0.3) {
			datacache[studentID]['assignment'].code = classCode;
		}
		callback(context);
	})
	.done();
}

function generateAssignmentVals(context) {
	var studentID = context['userid'];
	var known = "";
	var askFor = "";
	var amountUnknown = 0;
	if (datacache[studentID]['assignment'].code) {
		known = "\nClass: " + datacache[studentID]['assignment'].code;
	} else {
		known = "\nClass: ?";
		askFor = "class name";
		amountUnknown++;
	}
	if (datacache[studentID]['assignment'].date) {
		var day = new Date(datacache[studentID]['assignment'].date);
		known = "\nDue: " + months[day.getMonth()] + " " + day.getDate() + known;
	} else {
		known = "\nDue: ?" + known;
		askFor = "due date";
		amountUnknown++;
	}
	if (datacache[studentID]['assignment'].name) {
		datacache[studentID]['assignment'].name = toTitleCase(datacache[studentID]['assignment'].name);
		if (datacache[studentID]['assignment'].name.startsWith('My ')) {
			datacache[studentID]['assignment'].name = datacache[studentID]['assignment'].name.substring(3);
		}
		if (datacache[studentID]['assignment'].name.startsWith('The ')) {
			datacache[studentID]['assignment'].name = datacache[studentID]['assignment'].name.substring(4);
		}
		known = "\nName: " + datacache[studentID]['assignment'].name + known;
	} else {
		known = "\nName: ?" + known;
		askFor = "name";
		amountUnknown++;
	}
	
	var convVals = {};
	convVals.known = known;
	convVals.askFor = askFor;
	if (askFor === '') {
		sender.conv(studentID, 470, convVals);
		database.setConversationStatus(context['conversation']['ConversationID'], 480);
	} else if (amountUnknown == 3) {
		sender.conv(studentID, 450, convVals);
		database.setConversationStatus(context['conversation']['ConversationID'], 460);
	} else {
		sender.conv(studentID, 460, convVals);
		database.setConversationStatus(context['conversation']['ConversationID'], 460);
	}
}

function isYes(message) {
	return (message.toLowerCase().startsWith("y") || message.toLowerCase().includes("is correct")
	|| message.toLowerCase().includes("are correct") || message.toLowerCase().includes("right")) && !message.toLowerCase().includes("not");
}

function isNo(message) {
	return message.toLowerCase().startsWith("n") || message.toLowerCase().includes("incorrect") 
	|| message.toLowerCase().includes("wrong") || message.toLowerCase().includes("not correct");
}

function userWantsToQuit(context) {
	var message = context['chat']['text'].trim().toLowerCase();
	return message === "quit" || message === "stop" || message === "nevermind" || message === "cancel" || message === "nothing" || message === "no assignment";
}

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1);});
}

exports.classifyAssignment = function(name) {
	name = name.toLowerCase();
	if (name.includes('exam') || name.includes('final') || name.includes('test') || name.includes('midterm')) {
		return 4;
	}
	if (name.includes('quiz')) {
		return 3;
	}
	if (name.includes('project') || name.includes('paper') || name.includes('report')) {
		return 2;
	}
	return 1;
}

exports.parseFinish = function (message, context) {
	var studentID = context['student']['StudentID'];
	if (userWantsToQuit(context)) {
		sender.conv(studentID, 420, {});
		database.endConversation(context['conversation']['ConversationID']);
		return;
	}
	Q.fcall(function () {
		var spl = message.split(" ");
		var query = "";
		for (key in spl) {
			console.log(spl[key]);
			if (!spl[key].includes('finish') && !spl[key].includes('complete') && !spl[key].includes('done') && spl[key].length > 2) {
				query += (" " + spl[key].toLowerCase());
			}
		}
		console.log("query:");
		console.log(query);
		return database.getAssignmentsByNameAndStatus(studentID, 1, query.substring(1));
	}).then(function (resp) {
		var convVals = {};
		convVals.assignments = resp;
		console.log("found assignments: ");
		console.dir(resp);
		if (resp.length == 0 || resp.length > 10) { //couldn't find ~ probably because didn't give query
			sender.conv(studentID, 510, convVals);
			database.setConversationStatus(context['conversation']['ConversationID'], 510);
		} else if (resp.length == 1) { //found exactly one assignment
			sender.conv(studentID, 520, convVals);
			database.endConversation(context['conversation']['ConversationID']);
			database.setAssignmentComplete(resp[0]['AssignmentID']);
		} else { //got too many matches, need help
			datacache[studentID] = resp;
			sender.conv(studentID, 530, convVals);
			database.setConversationStatus(context['conversation']['ConversationID'], 530);
		}
	})
	.done();
}

// Handles messaging_postbacks events
exports.handlePostback = function (sender_psid, received_postback) {
  let response;
  
  // Get the payload for the postback
  let payload = received_postback.payload;

  // Set the response based on the postback payload
  if (payload === 'yes') {
    response = { "text": "Thanks!" }
  } else if (payload === 'no') {
    response = { "text": "Oops, try sending another image." }
  }
  // Send the message to acknowledge the postback
  sender.callSendAPI(sender_psid, response);
}