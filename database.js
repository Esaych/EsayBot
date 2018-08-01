// esaydb.js
var mysql = require('promise-mysql');

var con = mysql.createPool({
	host: "localhost",
	user: "esay",
	password: "[removed]",
	database: "esaydb",
	connectionLimit: 10,
	multipleStatements: true
});

exports.insertChat = function (chat, conversationid, userid) {
	let q = "INSERT INTO `Chat` (`PlatformID`, `Message`, `Status`, `CreatedDatetm`, `CreatedBy`) VALUES (1, ?, 1, NOW(), ?); SELECT * FROM `Chat` WHERE CreatedBy = ? ORDER BY CreatedDatetm LIMIT 1;"
	return con.query(q, [chat.text, userid, userid]);
};

exports.getStudent = function (studentid) {
	let q = 'SELECT * FROM `esaydb`.`Student` WHERE `StudentID` = ?;';
	return con.query(q, [studentid]);
}

exports.getStudents = function () {
	let q = 'SELECT * FROM `esaydb`.`Student`;';
	return con.query(q);
}

exports.addStudent = function (studentid) {
	let q = 'INSERT INTO `esaydb`.`Student` (`StudentID`,`PlatformID`,`SchoolID`, `SetupStatus`) VALUES (?,1,1,0);';
	return con.query(q, [studentid]);
}

exports.setStudentName = function (studentid, name) {
	let q = 'UPDATE `esaydb`.`Student` SET `Name` = ? WHERE `StudentID` = ?;';
	return con.query(q, [name, studentid]);
} 

exports.deleteStudent = function(studentid) {
	let q = 'DELETE FROM `esaydb`.`Student` WHERE `StudentID` = ?; DELETE FROM `esaydb`.`J_Student_Class` WHERE `StudentID` = ?; DELETE FROM `esaydb`.`J_Student_Assignment` WHERE `StudentID` = ?;';
	return con.query(q, [studentid, studentid, studentid]);
}

exports.deleteStudentClasses = function(studentid) {
	let q = 'DELETE FROM `esaydb`.`J_Student_Class` WHERE `StudentID` = ?; DELETE FROM `esaydb`.`J_Student_Assignment` WHERE `StudentID` = ?;';
	return con.query(q, [studentid, studentid, studentid]);
}

exports.newConversation = function (senderid) {
	console.log("new conversation");
	let q = 'INSERT INTO `esaydb`.`Conversation` (StudentID, Status, CreatedDatetm) VALUES (?, 1, NOW()); SELECT * FROM `Conversation` WHERE StudentID = ? ORDER BY CreatedDatetm LIMIT 1;';
	return con.query(q, [senderid, senderid]);
}

exports.getConversation = function (studentid) {
	let q = 'SELECT * FROM `esaydb`.`Conversation` WHERE `StudentID` = ? AND `Status` > 0 ORDER BY CreatedDatetm LIMIT 1;';
	return con.query(q, [studentid]);
}

exports.setConversationStatus = function(conversationid, newstatus) {
	console.log("conv: " + conversationid + " newstat: " + newstatus);
	let q = 'UPDATE `esaydb`.`Conversation` SET `Status` = ? WHERE `ConversationID` = ?;';
	return con.query(q, [newstatus, conversationid]);
}

exports.endConversation = function (convid) {
	console.log("end conversation");
	let q = 'UPDATE `esaydb`.`Conversation` SET `Status` = -1 WHERE ConversationID = ?;';
	return con.query(q, [convid]);
}

exports.addClass = function(studentid, code, credits, dept, name, semester) {
	let q = 'INSERT IGNORE INTO `esaydb`.`Class` (`Code`, `FullName`, `Credits`, `Department`, `Semester`) VALUES (?,?,?,?,?); INSERT IGNORE INTO `esaydb`.`J_Student_Class` (`StudentID`, `ClassID`) VALUES (?,(SELECT ClassID FROM `esaydb`.`Class` WHERE Code = ? AND Semester = ? LIMIT 1));';
	console.log(q);
	return con.query(q, [code, name, credits, dept, semester, studentid, code, semester]);
}

exports.getClasses = function(studentid, semester) {
	let q = 'SELECT * FROM `esaydb`.`Class` JOIN `esaydb`.`J_Student_Class` ON `esaydb`.`J_Student_Class`.`ClassID` = `esaydb`.`Class`.`ClassID` WHERE StudentID = ? AND Semester = ?';
	return con.query(q, [studentid, semester]);
}

exports.addAssignment = function (studentid, name, course, date, desc, type) {
	var asDate = new Date(date);
	var curDate = new Date();
	let q = 'INSERT INTO `esaydb`.`Assignment` (`AssignmentName`,`ClassID`,`Description`,`DueDate`,`Type`) VALUES (?, (SELECT `ClassID` FROM `esaydb`.`Class` WHERE `Code` = ? LIMIT 1), ?, ?, ?); INSERT INTO `esaydb`.`J_Student_Assignment` (`StudentID`,`AssignmentID`,`Progress`,`Difficulty`,`Status`) VALUES (?, last_insert_id(), 0, 50, 1);';
	if (asDate < curDate) {
		q = 'INSERT INTO `esaydb`.`Assignment` (`AssignmentName`,`ClassID`,`Description`,`DueDate`,`Type`) VALUES (?, (SELECT `ClassID` FROM `esaydb`.`Class` WHERE `Code` = ? LIMIT 1), ?, ?, ?); INSERT INTO `esaydb`.`J_Student_Assignment` (`StudentID`,`AssignmentID`,`Progress`,`Difficulty`,`Status`) VALUES (?, last_insert_id(), 1, 50, 1);';
	}
	return con.query(q, [name, course, desc, date, type, studentid]);
}

exports.getAssignments = function (studentid) {
	let q = 'SELECT * FROM `esaydb`.`Assignment` JOIN `esaydb`.`J_Student_Assignment` AS `Join` ON `Assignment`.`AssignmentID` = `Join`.`AssignmentID` JOIN `esaydb`.`Class` ON `Class`.`ClassID` = `Assignment`.`ClassID` WHERE `StudentID` = ? AND `Progress` < 1 ORDER BY `DueDate`';
	return con.query(q, [studentid]);
}
exports.getAssignmentsDays = function (studentid, type, nums) {
	let q = 'SELECT `AssignmentName`, `Class`.`ClassID`, `Code`, DATE_FORMAT(`DueDate`, "%a %b %e") AS `FormatDueDate` FROM `esaydb`.`Assignment` JOIN `esaydb`.`J_Student_Assignment` AS `Join` ON `Assignment`.`AssignmentID` = `Join`.`AssignmentID` JOIN `esaydb`.`Class` ON `Class`.`ClassID` = `Assignment`.`ClassID` WHERE `StudentID` = ? AND `Status` = ? AND `Progress` < 1 AND `DueDate` BETWEEN CURDATE() - INTERVAL 1 DAY AND CURDATE() + INTERVAL ? DAY  GROUP BY `AssignmentName`,`DueDate` ORDER BY `DueDate` ';
	return con.query(q, [studentid, type, nums]);
}
exports.getAssignmentsByName = function (studentid, name) {
	let q = 'SELECT `Assignment`.`AssignmentID`, `AssignmentName`, `Class`.`ClassID`, `Class`.`Code`, DATE_FORMAT(`DueDate`, "%b %e, %Y") AS `DueDate` FROM `esaydb`.`Assignment` JOIN `esaydb`.`J_Student_Assignment` AS `Join` ON `Assignment`.`AssignmentID` = `Join`.`AssignmentID` JOIN `esaydb`.`Class` ON `Class`.`ClassID` = `Assignment`.`ClassID` WHERE `StudentID` = ? AND `AssignmentName` LIKE ? ORDER BY `DueDate` ';
	return con.query(q, [studentid, ('%'+name.replace('%','[%]')+'%')]);
}
exports.getAssignmentsByNameAndStatus = function (studentid, stat, name) {
	let q = 'SELECT `Assignment`.`AssignmentID`, `AssignmentName`, `Class`.`ClassID`, `Class`.`Code`, DATE_FORMAT(`DueDate`, "%b %e, %Y") AS `DueDate` FROM `esaydb`.`Assignment` JOIN `esaydb`.`J_Student_Assignment` AS `Join` ON `Assignment`.`AssignmentID` = `Join`.`AssignmentID` JOIN `esaydb`.`Class` ON `Class`.`ClassID` = `Assignment`.`ClassID` WHERE `StudentID` = ? AND `Status` = ? AND `Progress` < 1 AND `AssignmentName` LIKE ? ORDER BY `DueDate` ';
	return con.query(q, [studentid, stat, ('%'+name.replace('%','[%]')+'%')]);
}
exports.setAssignmentComplete = function (assignmentid, studentid) {
	console.log("assignmentid: " + assignmentid +  	" | studentid: " + studentid);
	let q = 'UPDATE `esaydb`.`J_Student_Assignment` SET `Progress` = 1 WHERE `AssignmentID` = ? AND `StudentID` = ?;';
	return con.query(q, [assignmentid, studentid]);
}

exports.saveCalendarLink = function (studentid, url) {
	let q = 'UPDATE `esaydb`.`Student` SET `CanvasCalendar` = ? WHERE `StudentID` = ?;';
	return con.query(q, [url, studentid]);
}

exports.setSetupStatus = function(studentid, stat) {
	let q = 'UPDATE `esaydb`.`Student` SET `SetupStatus` = ? WHERE `StudentID` = ?;';
	return con.query(q, [stat, studentid]);
}