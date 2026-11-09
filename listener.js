'use strict'
const { Controller, Tag, EthernetIP } = require("ethernet-ip");

const { DINT, INT, BOOL } = EthernetIP.CIP.DataTypes.Types;

// Using it as Queue
const sqlite3 = require('sqlite3').verbose();

const plcAddress = "10.37.156.6";
//const plcAddress = "216.98.8.15";

var tagList = require('./tags-to-listen');

var attempt = 1;
main();

async function main() {
	do 
	{
		await connectToPLCAndReadTags();
		console.log("\n\n Wait 5 Seconds to next Attempt");
		sleep(5000);

	}while (attempt++ < 10)
}

async function connectToPLCAndReadTags() {

	const PLC = new Controller();

	try {
		tagList.forEach(function (tag) {
			if (tag.listenable) {
				var tagType = (tag.function == 'counter') ? DINT : BOOL;
				var plcTag = new Tag(tag.tagCode, null, tagType);

				PLC.subscribe(plcTag);
				console.log(" -- Subscribing Tag " + tag.tagCode + " - " + JSON.stringify(tag));
			}
		});

		let db = await initializeDatabase('tag-queue.db');

		console.log(" -- Trying to Connect on PLC (" + plcAddress + ") --  Attempt " + attempt + "/10 ");
		await PLC.connect(plcAddress, 0);

		console.log(" -- Connected on PLC (" + plcAddress + ") -- ");
		PLC.scan_rate = 500;
		PLC.forEach((tag) => {

			// Called on the First Successful Read from the Controller
			tag.on("Initialized", (t) => {
				console.log(t.name + " initialized with value: ", t.value);
				RegisterTagData(t, db);
			});

			// Called if Tag.controller_value changes
			tag.on("Changed", (t, oldValue) => {
				console.log(t.name + " changed from: " + oldValue + " to :", t.value);
				RegisterTagData(t, db);
			});
		});
		
		await PLC.scan();

	}
	catch (err) {
		console.log(" -- Erron on Process -- ");
		console.log(err);
		console.log(err.stack);
	}
}

function RegisterTagData(tag, db) {
	try {
		var tagData = {
			tagCode: tag.name,
			date: new Date(),
			value: Number(tag.value)
		};
		console.log("Register: " + JSON.stringify(tagData));

		db.run('INSERT INTO QUEUE (job) VALUES(?)', [JSON.stringify(tagData)], function (err) {
			if (err)
				console.log("Error on register " + JSON.stringify(tagData) + "\nt--" + err.message);
			else
				console.log("Registered: " + JSON.stringify(tagData));
		});
	}
	catch (err) {
		console.log("Error on register Tag " + JSON.stringify(tagData) + "\nt--" + err.message);
	}
}


function initializeDatabase(dbPath) {

	return new Promise(function (resolve, reject) {
		let dbConnection = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, function (err) {
			if (err) {
				console.error(err.message);
				reject(err.message);
				throw err;
			}
			else {
				console.log('Connected on SQlite database.');
			}
		});

		let query = 'CREATE TABLE IF NOT EXISTS QUEUE (id INTEGER PRIMARY KEY ASC AUTOINCREMENT, job TEXT);'
		dbConnection.exec(query, function (err) {
			if (err !== null)
				reject(err);

			resolve(dbConnection);

		});
	});
}

function sleep(ms) {
	var waitTill = new Date(new Date().getTime() + ms);
	while (waitTill > new Date()) { }
}
