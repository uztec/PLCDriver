'use strict'
const sqlite3 = require('sqlite3').verbose();

main();

function main()
{
    initializeDatabase('./tag-queue-verify.db')
        .then(function (db)
        {
            var sql = 'SELECT id, job FROM QUEUE LIMIT 100;';

            db.each(sql, function (err, row)
            {
                if (err)
                {
                    throw err;
                }

                console.log(row.job);
            });

            var sql2 = 'SELECT count (*) FROM QUEUE;';
            db.each(sql2, function (err, row)
            {
                if (err)
                {
                    throw err;
                }

                console.log(' -- Count: ' + JSON.stringify(row));
            });

        })
        .catch(function (reason)
        {
            console.log(" -- Erron on Open SQLITE Db - " + reason + " -- ");
        });
}

function initializeDatabase(dbPath)
{
    return new Promise(function (resolve, reject)
    {
        var db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, function (err)
        {
            if (err)
            {
                return console.error(err.message);
                reject(err.message);
            }
            else
            {
                console.log('Connected on SQlite database.');
            }
        });

        var query = 'CREATE TABLE IF NOT EXISTS QUEUE (id INTEGER PRIMARY KEY ASC AUTOINCREMENT, job TEXT);'
        db.exec(query, function (err)
        {
            if (err !== null)
                reject(err);

            resolve(db);

        });
    });
}
