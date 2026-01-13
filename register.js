'use strict'

const { SupervisoryAPI } = require('./SupervisoryAPI');

const sqlite3 = require('sqlite3').verbose();

// Load configuration
const config = require('./config.json');
const dbPath = config.database.connectionString;
const processInterval = config.register?.processInterval || 10000; // Default 10 seconds
const batchSize = config.register?.batchSize || 300; // Default 300 jobs per batch

let db = null;
let processIntervalId = null;

main();

async function main() {
	try {
		// Initialize database
		db = await initializeDatabase(dbPath);

		// Start processing loop
		console.log(` -- Starting queue processing (interval: ${processInterval}ms, batch size: ${batchSize}) -- `);
		startProcessing();

		// Handle graceful shutdown
		process.on('SIGINT', async () => {
			console.log('\n -- Shutting down gracefully -- ');
			if (processIntervalId) {
				clearInterval(processIntervalId);
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
		});

	} catch (err) {
		console.log(" -- Error on Process -- ");
		console.log(err);
		console.log(err.stack);
		process.exit(1);
	}
}

function startProcessing() {
	processIntervalId = setInterval(async () => {
		try {
			await processQueue();
		} catch (error) {
			console.log(` -- Error processing queue: ${error.message} -- `);
		}
	}, processInterval);
}

async function processQueue() {
	return new Promise((resolve, reject) => {
		const sql = `SELECT id, job FROM QUEUE LIMIT ${batchSize};`;

		db.all(sql, async (err, rows) => {
			if (err) {
				console.log(` -- Error querying queue: ${err.message} -- `);
				return reject(err);
			}

			if (rows.length === 0) {
				// No jobs to process
				return resolve();
			}

			console.log(` -- Processing ${rows.length} job(s) from queue -- `);

			// Process all jobs in parallel
			const promises = rows.map(row => processJob(row, db));
			
			try {
				await Promise.allSettled(promises);
				resolve();
			} catch (error) {
				console.log(` -- Error processing jobs: ${error.message} -- `);
				reject(error);
			}
		});
	});
}

async function processJob(row, db) {
	try {
		const tagData = JSON.parse(row.job);
		const strTagData = `${tagData.tagCode}:${tagData.value}(${tagData.date})`;

		try {
			const response = await SupervisoryAPI.tagChanged(tagData);
			console.log(` -- OK - Registered value of ${strTagData} - Status: ${response.status} -- `);
			await removeJobFromQueue(db, row.id);
		} catch (error) {
			console.log(` -- ERROR - Failed to register value of ${strTagData} - Reason: ${error.message} -- `);
			// Don't remove from queue on error, so it can be retried
		}
	} catch (error) {
		console.log(` -- ERROR - Failed to parse job (id: ${row.id}): ${error.message} -- `);
		// Remove invalid job from queue
		await removeJobFromQueue(db, row.id);
	}
}

function removeJobFromQueue(db, id) {
	return new Promise((resolve, reject) => {
		db.run('DELETE FROM QUEUE WHERE id=?', [id], function (err) {
			if (err) {
				console.error(` -- Error deleting job ${id}: ${err.message} -- `);
				return reject(err);
			}
			resolve();
		});
	});
}

function initializeDatabase(dbPath) {
	return new Promise(function (resolve, reject) {
		const dbConnection = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, function (err) {
			if (err) {
				console.error(` -- Error opening database: ${err.message} -- `);
				return reject(err);
			} else {
				console.log(' -- Connected to SQLite database -- ');
			}
		});

		const query = 'CREATE TABLE IF NOT EXISTS QUEUE (id INTEGER PRIMARY KEY ASC AUTOINCREMENT, job TEXT);';
		dbConnection.exec(query, function (err) {
			if (err !== null) {
				console.error(` -- Error creating table: ${err.message} -- `);
				return reject(err);
			}

			resolve(dbConnection);
		});
	});
}
