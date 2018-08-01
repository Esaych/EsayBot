var ontime = require('ontime');
var Q = require('q');
var ical = require('ical');
var database = require('./database.js');
var sender = require('./sender.js');
var interpreter = require('./interpreter');
var cacheData = {};

console.log("The time is: " + new Date());

ontime({
    cycle: '21:00:00'
}, function (ot) {
	Q.fcall(function () {
		return database.getStudents();
	})
	//pull latest conversation for studentid 
	.then(function (students) {
		for (var i = 0; i < students.length; i++) {
			remind(students[i]);
		}
		
	}).catch(function (error) {
		console.log(error);
	})
	.done();
    ot.done()
    return
});

function remind(student) {
	var studentID = student['StudentID'];
	var studentName = student['Name'];
	Q.fcall(function () {
		return database.getAssignmentsDays(studentID, 1, 3);
	}).then(function (resp) {
		if (resp.length > 0) {
			msgVals = {};
			msgVals.name = studentName;
			msgVals.assignments = resp;
			msgVals.time = "3 days";
			sender.conv(studentID, 210, msgVals);
			Q.delay(500).done(function message2() {
				sender.conv(studentID, 200, msgVals);
			});
		}
	})
	.done();
}

ontime({
    cycle: [ '00:00:00', '12:00:00', '16:00:00', '20:00:00' ]
//cycle: ['00','15','30','45']
}, function (ot) {
	Q.fcall(function () {
		return database.getStudents();
	})
	//pull latest conversation for studentid 
	.then(function (students) {
		for (var i = 0; i < students.length; i++) {
			var studentID = students[i]['StudentID'];
			var canvasCalendar = students[i]['CanvasCalendar'];
			updateAssignmentsFromCalendar(studentID, canvasCalendar);
		}
		
	}).catch(function (error) {
		console.log(error);
	})
	.done();
    ot.done()
    return
});

function updateAssignmentsFromCalendar(studentID, canvasCalendar) {
	ical.fromURL(canvasCalendar, {}, function(err, data) {
		if (err) {
			//ignore
		} else {
			var assignments = [];
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
						console.dir(assignment);
						checkIfExists(studentID, assignment.name, assignment.course);
						assignments.push(assignment);
					}
				}
			}
			sendNewAssignments(studentID);
			addAssignments(studentID, assignments);
		}
	});
}

function addAssignments(studentID, assignments) {
	Q.delay(2000).done(function delayAddAssignments() {
		for (var key in assignments) {
			//repeats should be ignored by database
			database.addAssignment(studentID, assignments[key].name, assignments[key].course, assignments[key].date, assignments[key].desc, interpreter.classifyAssignment(assignments[key].name));
		}
	});
}

function sendNewAssignments(studentID) {
	if (cacheData[studentID] && cacheData[studentID].newassignments) {
		var convVals = {};
		convVals.assignments = cacheData[studentID].newassignments;
		sender.conv(studentID, 220, convVals);
		
		cacheData[studentID].newassignments = null;
	}
}

function checkIfExists(studentID, name, course) {
	Q.fcall(function () {
		return database.getAssignmentsByName(studentID, name);
	}).then(function (assignments) {
		if (assignments.length == 0) {
			if (!cacheData[studentID]) {
				cacheData[studentID] = {};
			}
			if (!cacheData[studentID].newassignments) {
				cacheData[studentID].newassignments = [];
			}
			
			cacheData[studentID].newassignments.push(course + ": " + name);
		}
	}).done();
}