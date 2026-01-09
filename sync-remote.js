'use strict'

const { SupervisoryAPI } = require('./SupervisoryAPI');
const { RemoteAPI } = require('./SupervisoryAPI-Remote');

const startDate = '2019-05-01'
const endDate = '2019-05-21'
//const tagCodePrefix = 'FOB_3660_10150304'  // GLASSLINE
const tagCodePrefix = 'FOB_3660_10140305'  // BAVELLONI 2
//const tagCodePrefix = 'FOB_3660_10140102'  // BAVELLONI 1
//const tagCodePrefix = 'FOB_3660_10140301'  // SCHIATTI 
//const tagCodePrefix = 'FOB_3660_10160121'  // THIEME
//const tagCodePrefix = 'FOB_3665_10190402'  // LISEC

const step = 30;
var tagDataList = null;
var startOfChunk = 0;
var answeredCalls = 0;
main();

async function main()
{
    try
    {

        var firstTagCode = tagCodePrefix + '_RUN';
        var listTagDataResponse = await RemoteAPI.listTagData(firstTagCode, startDate, endDate);
        tagDataList = listTagDataResponse.data;

        console.log("Starting Sync Calls");

        var tagDataChunk = tagDataList.slice(0, step);
        setTimeout(() => insertChunk(tagDataChunk), 10);

        [
            tagCodePrefix + '_MAN', 
            tagCodePrefix + '_STOP', 
            tagCodePrefix + '_PIECES',
            tagCodePrefix + '_PARTNUMBER_IHM',
        ].forEach(function (tagCode)
        {
            RemoteAPI.listTagData(tagCode, startDate, endDate)
                .then(function (response)
                {
                    response.data.forEach(function (tagData)
                    {
                        tagDataList.push(tagData);
                    });
                })
                .catch(function (reason)
                {
                    console.log("ERROR - " + new Date() + " - Failed to List tagDatas from: " + startDate + " to " + endDate + " of tag " + tagCode + " - Reason: " + reason);
                });
        });

    }
    catch (reason)
    {
        console.log("ERROR - " + new Date() + " - Failed to List tagDatas from: " + startDate + " to " + endDate + " of tag " + firstTagCode + " - Reason: " + reason);
    }
}

async function insertChunk(tagDataChunk)
{
    answeredCalls = 0;
    tagDataChunk.forEach(async function (tagData)
    {
        var strTagData = `${tagData.tagCode}:${tagData.value}(${tagData.date})`;

        console.log("Calling tagChanged of " + strTagData);
        SupervisoryAPI.tagChanged(tagData)
            .then(function (response)
            {
                console.log("Ok - " + new Date() + " - Registered value of " + strTagData + " - Status: " + response.status);
                verifyNextChunk(tagDataChunk);
            })
            .catch(function (reason)
            {
                console.log("ERROR - " + new Date() + " - Failed to registered value of " + strTagData + " - Reason: " + reason);
                verifyNextChunk(tagDataChunk);
            });
    });
}

function verifyNextChunk(tagDataChunk)
{
    if (++answeredCalls == tagDataChunk.length)
    {
        startOfChunk += step;
        var endOfChunk = startOfChunk + step;
        endOfChunk = (endOfChunk > tagDataList.lenght) ? tagDataList.lenght : endOfChunk;
        var nextChunk = tagDataList.slice(startOfChunk, endOfChunk);
        setTimeout(() => insertChunk(nextChunk), 10);
    }
}