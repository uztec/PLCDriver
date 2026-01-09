'use strict'
const { SupervisoryAPI } = require('./SupervisoryAPI');
var fs = require('fs');

SupervisoryAPI.listTags().then(function (response)
{
    fs.writeFile('tags-to-listen.json', JSON.stringify(response.data, null, 3), 'utf8', fileWriteCallback);

    response.data.forEach(function (tag)
    {
        var tagType = (tag.function == 'counter') ? 'INT' : 'BOOL';
        console.log(tag.tagCode + "=" + tagType + " \\");
    });

});

function fileWriteCallback(value)
{

    //console.log('Write Callback: ' + JSON.stringify(value));
}
