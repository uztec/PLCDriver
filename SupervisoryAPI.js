'use strict'
const axios = require('axios');
const https = require('https');
const fs = require('fs');

// Load configuration
const config = require('./config.json');
const apiUrl = config.api.url;

const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

const api = axios.create({
    httpsAgent
});

const SupervisoryAPI = {

    getStatus: function (machineCode, dateFrom)
    {
        var formatedDate = moment(dateFrom).format('YYYY-MM-DDTHH:mm:ss');
        var url = apiUrl + `status/${machineCode}/${formatedDate}`;
        return api.get(url).catch(this.requestError);
    },

    getCounter: function (machineCode, dateFrom)
    {
        var formatedDate = moment(dateFrom).format('YYYY-MM-DDTHH:mm:ss');
        var url = apiUrl + `counter/${machineCode}/${formatedDate}`;
        return api.get(url).catch(this.requestError);
    },

    getTarget: function (machineCode, dateFrom)
    {
        var formatedDate = moment(dateFrom).format('YYYY-MM-DDTHH:mm:ss');
        var url = apiUrl + `target/${machineCode}/${formatedDate}`;
        return api.get(url).catch(this.requestError);
    },
    listMachines: function ()
    {
        return api.get(apiUrl + "machine").catch(this.requestError);
    },

    listPlants: function ()
    {
        return api.get(apiUrl + "plant").catch(this.requestError);
    },

    listProcess: function ()
    {
        return api.get(apiUrl + "process").catch(this.requestError);
    },

    listTags: function ()
    {
        var url = apiUrl + "tag/listenables";
        console.log("Url : " + url);
        return api.get(url);
    },

    listPartNumberTargets: function ()
    {
        return api.get(apiUrl + "partNumberTarget").catch(this.requestError);
    },

    clearPartNumberTargets: function ()
    {
        return api.delete(apiUrl + "partNumberTarget/clear").catch(this.requestError);
    },

    insertPartNumberTargetList: function (partNumberTargetList)
    {
        var url = apiUrl + `partNumberTarget/insertList`;
        return api.post(url, partNumberTargetList).catch(this.requestError);
    },

    insertPartNumberTargets: function (partNumberTarget)
    {
        var machineCode = partNumberTarget.machineCode;
        var partNumber = partNumberTarget.partNumber;
        var url = apiUrl + `partNumberTarget/${machineCode}/${partNumber}`;
        return api.put(url, partNumberTarget).catch(this.requestError);
    },

    listCurrentMachineRuntimes: function ()
    {
        return api.get(apiUrl + "runtime/current").catch(this.requestError);
    },

    insertMachineRuntime: function (machineRuntime)
    {
        var machineCode = machineRuntime.machineCode;
        var partNumber = machineRuntime.partNumber;
        var routeDeviation = false;
        var url = apiUrl + `runtime/${machineCode}/${partNumber}/${routeDeviation}`;
        return api.put(url).catch(this.requestError);
    },

    tagChanged: function (tagData)
    {
        return api.post(apiUrl + "tag-data", tagData);//.catch(this.requestError);
    },

    requestError: function (response)
    {
        console.log("Error on API Call");
    },
};

module.exports = { SupervisoryAPI }
