'use strict'
const axios = require('axios');
const fs = require('fs');

// Load configuration
const config = require('./config.json');
const apiUrl = config.api.url;

const SupervisoryAPI = {

    getStatus: function (machineCode, dateFrom)
    {
        var formatedDate = moment(dateFrom).format('YYYY-MM-DDTHH:mm:ss');
        var url = apiUrl + `status/${machineCode}/${formatedDate}`;
        return axios.get(url).catch(this.requestError);
    },

    getCounter: function (machineCode, dateFrom)
    {
        var formatedDate = moment(dateFrom).format('YYYY-MM-DDTHH:mm:ss');
        var url = apiUrl + `counter/${machineCode}/${formatedDate}`;
        return axios.get(url).catch(this.requestError);
    },

    getTarget: function (machineCode, dateFrom)
    {
        var formatedDate = moment(dateFrom).format('YYYY-MM-DDTHH:mm:ss');
        var url = apiUrl + `target/${machineCode}/${formatedDate}`;
        return axios.get(url).catch(this.requestError);
    },
    listMachines: function ()
    {
        return axios.get(apiUrl + "machine").catch(this.requestError);
    },

    listPlants: function ()
    {
        return axios.get(apiUrl + "plant").catch(this.requestError);
    },

    listProcess: function ()
    {
        return axios.get(apiUrl + "process").catch(this.requestError);
    },

    listTags: function ()
    {
        var url = apiUrl + "tag/listenables";
        console.log("Url : " + url);
        return axios.get(url);
    },

    listPartNumberTargets: function ()
    {
        return axios.get(apiUrl + "partNumberTarget").catch(this.requestError);
    },

    clearPartNumberTargets: function ()
    {
        return axios.delete(apiUrl + "partNumberTarget/clear").catch(this.requestError);
    },

    insertPartNumberTargetList: function (partNumberTargetList)
    {
        var url = apiUrl + `partNumberTarget/insertList`;
        return axios.post(url, partNumberTargetList).catch(this.requestError);
    },

    insertPartNumberTargets: function (partNumberTarget)
    {
        var machineCode = partNumberTarget.machineCode;
        var partNumber = partNumberTarget.partNumber;
        var url = apiUrl + `partNumberTarget/${machineCode}/${partNumber}`;
        return axios.put(url, partNumberTarget).catch(this.requestError);
    },

    listCurrentMachineRuntimes: function ()
    {
        return axios.get(apiUrl + "runtime/current").catch(this.requestError);
    },

    insertMachineRuntime: function (machineRuntime)
    {
        var machineCode = machineRuntime.machineCode;
        var partNumber = machineRuntime.partNumber;
        var routeDeviation = false;
        var url = apiUrl + `runtime/${machineCode}/${partNumber}/${routeDeviation}`;
        return axios.put(url).catch(this.requestError);
    },

    tagChanged: function (tagData)
    {
        return axios.post(apiUrl + "tag-data", tagData);//.catch(this.requestError);
    },

    requestError: function (response)
    {
        console.log("Error on API Call");
    },
};

module.exports = { SupervisoryAPI }
