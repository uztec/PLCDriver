'use strict'

const { Controller, Tag, EthernetIP } = require("ethernet-ip");
const sqlite3 = require('sqlite3').verbose();

const { DINT, BOOL } = EthernetIP.CIP.DataTypes.Types;

// Load configuration
const config = require('./config.json');

const plcAddress = config.plc.ip;
const plcSlot = config.plc.slot != null ? config.plc.slot : 0;
const scanRate = config.plc.scanRate || 500;
const dbPath = config.database.connectionString;

var tagList = require('./tags-to-listen.json');

let PLC = null;
let db = null;
let shuttingDown = false;

main();

async function main() {
	try {
		const listenableTags = tagList.filter(tag => tag.listenable && tag.tagCode);

		if (listenableTags.length === 0) {
			console.log(" -- No listenable tags found -- ");
			process.exit(1);
		}

		console.log(` -- Found ${listenableTags.length} listenable tag(s) -- `);

		db = await initializeDatabase(dbPath);

		process.on('SIGINT', () => {
			shutdown();
		});

		let attempt = 1;
		while (!shuttingDown) {
			try {
				await connectToPLCAndReadTags(listenableTags, attempt);
			} catch (err) {
				console.log(" -- Error on Process -- ");
				console.log(err);
				if (err && err.stack) console.log(err.stack);
			}

			safeDestroy(PLC);
			PLC = null;

			if (shuttingDown) break;

			console.log(" -- Wait 5 seconds to next attempt -- ");
			await sleep(5000);
			attempt++;
		}
	} catch (err) {
		console.log(" -- Error on Process -- ");
		console.log(err);
		if (err && err.stack) console.log(err.stack);
		process.exit(1);
	}
}

async function connectToPLCAndReadTags(listenableTags, attempt) {
	PLC = new Controller();

	listenableTags.forEach(function (tag) {
		var tagType = (tag.function == 'counter') ? DINT : BOOL;
		var plcTag = new Tag(tag.tagCode, null, tagType);

		PLC.subscribe(plcTag);
		console.log(` -- Subscribing Tag ${tag.tagCode} (${tag.function}) -- `);
	});

	console.log(` -- Trying to Connect on PLC (${plcAddress}, slot ${plcSlot}) -- Attempt ${attempt} -- `);
	await PLC.connect(plcAddress, plcSlot);

	console.log(` -- Connected on PLC (${plcAddress}, slot ${plcSlot}) -- `);
	PLC.scan_rate = scanRate;

	PLC.forEach((tag) => {
		tag.on("Initialized", (t) => {
			console.log(` -- Tag ${t.name} initialized with value: ${t.value} -- `);
			RegisterTagData(t.name, t.value, db);
		});

		tag.on("Changed", (t, oldValue) => {
			console.log(` -- Tag ${t.name} changed from: ${oldValue} to: ${t.value} -- `);
			RegisterTagData(t.name, t.value, db);
		});
	});

	console.log(` -- Starting scan (interval: ${scanRate}ms) -- `);
	await PLC.scan();
}

function RegisterTagData(tagCode, value, db) {
	var tagData = null;
	try {
		let numericValue = value;
		if (typeof value === 'boolean') {
			numericValue = value ? 1 : 0;
		} else if (typeof value === 'number') {
			numericValue = value;
		} else {
			const parsed = Number(value);
			numericValue = isNaN(parsed) ? value : parsed;
		}

		tagData = {
			tagCode: tagCode,
			date: new Date(),
			value: numericValue
		};

		console.log(" -- Register: " + JSON.stringify(tagData) + " -- ");

		db.run('INSERT INTO QUEUE (job) VALUES(?)', [JSON.stringify(tagData)], function (err) {
			if (err) {
				console.log(" -- Error on register " + JSON.stringify(tagData) + " -- " + err.message);
			} else {
				console.log(" -- Registered: " + JSON.stringify(tagData) + " -- ");
			}
		});
	} catch (err) {
		console.log(" -- Error on register Tag " + JSON.stringify(tagData) + " -- " + err.message);
	}
}

function initializeDatabase(dbPath) {
	return new Promise(function (resolve, reject) {
		let dbConnection = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, function (err) {
			if (err) {
				console.error(err.message);
				reject(err.message);
				return;
			}
			console.log(' -- Connected to SQLite database -- ');
		});

		let query = 'CREATE TABLE IF NOT EXISTS QUEUE (id INTEGER PRIMARY KEY ASC AUTOINCREMENT, job TEXT);'
		dbConnection.exec(query, function (err) {
			if (err !== null) {
				reject(err);
			} else {
				resolve(dbConnection);
			}
		});
	});
}

function shutdown() {
	if (shuttingDown) return;
	shuttingDown = true;

	console.log('\n -- Shutting down gracefully -- ');

	if (PLC) {
		try {
			PLC.pauseScan();
		} catch (err) {
			// scan may already be stopped
		}
		safeDestroy(PLC);
		PLC = null;
	}

	if (db) {
		db.close((err) => {
			if (err) {
				console.error(' -- Error closing database -- ', err.message);
			} else {
				console.log(' -- Database closed -- ');
			}
			process.exit(0);
		});
	} else {
		process.exit(0);
	}
}

function safeDestroy(controller) {
	if (!controller || controller.destroyed) return;
	try {
		controller.destroy();
	} catch (err) {
		try {
			require('net').Socket.prototype.destroy.call(controller);
		} catch (destroyErr) {
			// socket already closed
		}
	}
}

function sleep(ms) {
	return new Promise(function (resolve) {
		setTimeout(resolve, ms);
	});
}
