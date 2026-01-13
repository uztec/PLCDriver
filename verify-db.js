'use strict'

const sqlite3 = require('sqlite3').verbose();

// Load configuration
const config = require('./config.json');
const dbPath = process.argv[2] || config.database.connectionString; // Allow override via command line argument
const limit = parseInt(process.argv[3] || '100'); // Allow limit override

let db = null;

main();

async function main() {
	try {
		// Initialize database
		db = await initializeDatabase(dbPath);

		// Get total count
		const count = await getQueueCount(db);
		console.log(`\n -- Total jobs in queue: ${count} -- \n`);

		if (count === 0) {
			console.log(' -- Queue is empty -- ');
			await closeDatabase();
			process.exit(0);
		}

		// Get jobs
		const jobs = await getQueueJobs(db, limit);
		
		console.log(` -- Showing ${jobs.length} job(s) (limit: ${limit}) -- \n`);

		// Display jobs
		jobs.forEach((row, index) => {
			try {
				const jobData = JSON.parse(row.job);
				console.log(`[${index + 1}] ID: ${row.id}`);
				console.log(`    Tag: ${jobData.tagCode}`);
				console.log(`    Value: ${JSON.stringify(jobData.value)}`);
				console.log(`    Date: ${jobData.date}`);
				console.log('');
			} catch (error) {
				console.log(`[${index + 1}] ID: ${row.id}`);
				console.log(`    Raw: ${row.job}`);
				console.log(`    Error parsing: ${error.message}`);
				console.log('');
			}
		});

		// Summary
		console.log(' -- Summary -- ');
		console.log(`Total in queue: ${count}`);
		console.log(`Displayed: ${jobs.length}`);
		if (count > limit) {
			console.log(`Hidden: ${count - limit}`);
		}

		await closeDatabase();

	} catch (err) {
		console.log(" -- Error on Process -- ");
		console.log(err);
		console.log(err.stack);
		process.exit(1);
	}
}

function getQueueCount(db) {
	return new Promise((resolve, reject) => {
		const sql = 'SELECT COUNT(*) as count FROM QUEUE;';
		db.get(sql, (err, row) => {
			if (err) {
				return reject(err);
			}
			resolve(row.count);
		});
	});
}

function getQueueJobs(db, limit) {
	return new Promise((resolve, reject) => {
		const sql = `SELECT id, job FROM QUEUE ORDER BY id ASC LIMIT ${limit};`;
		db.all(sql, (err, rows) => {
			if (err) {
				return reject(err);
			}
			resolve(rows || []);
		});
	});
}

function initializeDatabase(dbPath) {
	return new Promise(function (resolve, reject) {
		const dbConnection = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, function (err) {
			if (err) {
				console.error(` -- Error opening database: ${err.message} -- `);
				return reject(err);
			} else {
				console.log(` -- Connected to SQLite database: ${dbPath} -- `);
			}
		});

		// Verify table exists
		const query = "SELECT name FROM sqlite_master WHERE type='table' AND name='QUEUE';";
		dbConnection.get(query, function (err, row) {
			if (err) {
				console.error(` -- Error checking table: ${err.message} -- `);
				return reject(err);
			}

			if (!row) {
				console.log(' -- Table QUEUE does not exist -- ');
				return reject(new Error('Table QUEUE does not exist'));
			}

			resolve(dbConnection);
		});
	});
}

function closeDatabase() {
	return new Promise((resolve) => {
		if (db) {
			db.close((err) => {
				if (err) {
					console.error(' -- Error closing database -- ', err.message);
				} else {
					console.log('\n -- Database closed -- ');
				}
				resolve();
			});
		} else {
			resolve();
		}
	});
}
