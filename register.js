'use strict'

const { SupervisoryAPI } = require('./SupervisoryAPI');

const sqlite3 = require('sqlite3').verbose();


main();

function main()
{
    initializeDatabase('/home/supervisory/supervisory-driver/tag-queue.db')
        .then(doJob)
        .catch(function (reason)
        {
            console.log(" -- Erron on Open SQLITE Db - " + reason + " -- ");
        });
}

function doJob(db)
{
    var sql = 'SELECT id, job FROM QUEUE LIMIT 300;';

    db.each(sql, function (err, row)
    {
        if (err)
        {
            throw err;
        }

        var tagData = JSON.parse(row.job);
        var strTagData = `${tagData.tagCode}:${tagData.value}(${tagData.date})`;

        SupervisoryAPI.tagChanged(tagData)
            .then(function (response)
            {
                console.log("Ok - " + new Date() + " - Registered value of " + strTagData + " - Status: " + response.status);
                removeJobFromQueue(db, row.id);

            })
            .catch(function (reason)
            {
                console.log("ERROR - " + new Date() + " - Failed to registered value of " + strTagData + " - Reason: " + reason);
            });


    });

    setTimeout(()=>doJob(db), 10000);
}

function removeJobFromQueue(db, id)
{
    // delete a row based on id
    db.run('DELETE FROM QUEUE WHERE id=?', id, function (err)
    {
        if (err)
        {
            return console.error(err.message);
        }
        //console.log(`Row(s) deleted ${db.changes}`);
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
