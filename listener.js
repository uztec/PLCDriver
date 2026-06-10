'use strict'

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// Load configuration
const config = require('./config.json');

const plcAddress = config.plc.ip;
const plcPort = config.plc.port || 4840; // OPC UA default port
const scanRate = config.plc.scanRate || 500; // Polling interval in ms
const dbPath = config.database.connectionString;

var tagList = require('./tags-to-listen.json');

// Store previous values to detect changes
const previousValues = new Map();

// OPC UA driver will be loaded dynamically
let driver = null;

main();

async function main() {
	try {
		// Dynamically import OPC UA driver (ES module)
		const { default: OPCUADriver } = await import('./lib-opcua-driver/index.js');
		
		// Create OPC UA driver instance
		driver = new OPCUADriver(plcAddress, plcPort);

		// Filter only listenable tags
		const listenableTags = tagList.filter(tag => tag.listenable);
		
		if (listenableTags.length === 0) {
			console.log(" -- No listenable tags found -- ");
			process.exit(1);
		}

		console.log(` -- Found ${listenableTags.length} listenable tag(s) -- `);

		// Initialize database
		let db = await initializeDatabase(dbPath);

		// Connect to OPC UA server
		console.log(` -- Connecting to OPC UA server at ${plcAddress}:${plcPort} -- `);
		await driver.connect();
		console.log(" -- Connected to OPC UA server -- ");

		// Initialize all tags - read them once to get initial values
		console.log(" -- Initializing tags -- ");
		for (const tag of listenableTags) {
			try {
				const value = await driver.readTag(tag.tagCode);
				previousValues.set(tag.tagCode, value);
				console.log(` -- Tag ${tag.tagCode} initialized with value: ${value} -- `);
				
				// Register initial value
				RegisterTagData(tag.tagCode, value, db);
			} catch (error) {
				console.log(` -- Error initializing tag ${tag.tagCode}: ${error.message} -- `);
			}
		}

		// Start polling loop
		console.log(` -- Starting polling loop (interval: ${scanRate}ms) -- `);
		startPolling(listenableTags, db);

		// Handle graceful shutdown
		process.on('SIGINT', async () => {
			console.log('\n -- Shutting down gracefully -- ');
			await driver.disconnect();
			if (db) {
				db.close();
			}
			process.exit(0);
		});

	} catch (err) {
		console.log(" -- Error on Process -- ");
		console.log(err);
		console.log(err.stack);
		process.exit(1);
	}
}

function startPolling(tags, db) {
	const pollInterval = setInterval(async () => {
		for (const tag of tags) {
			try {
				const currentValue = await driver.readTag(tag.tagCode);
				const previousValue = previousValues.get(tag.tagCode);

				// Check if value changed
				if (previousValue !== undefined && currentValue !== previousValue) {
					console.log(` -- Tag ${tag.tagCode} changed from: ${previousValue} to: ${currentValue} -- `);
					RegisterTagData(tag.tagCode, currentValue, db);
				}

				// Update previous value
				previousValues.set(tag.tagCode, currentValue);

			} catch (error) {
				console.log(` -- Error reading tag ${tag.tagCode}: ${error.message} -- `);
			}
		}
	}, scanRate);

	// Store interval reference for cleanup if needed
	driver.pollInterval = pollInterval;
}

function RegisterTagData(tagCode, value, db) {
	try {
		// Convert value to number if possible, otherwise keep original
		let numericValue = value;
		if (typeof value === 'boolean') {
			numericValue = value ? 1 : 0;
		} else if (typeof value === 'number') {
			numericValue = value;
		} else {
			// Try to parse as number
			const parsed = Number(value);
			numericValue = isNaN(parsed) ? value : parsed;
		}

		var tagData = {
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
				throw err;
			} else {
				console.log(' -- Connected to SQLite database -- ');
			}
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
