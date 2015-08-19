#!/usr/bin/env node


'use strict';

//TODO: Need to extract only the relevant data from the GTFS data.
//      Otherwise, JSON object is about 185M.

var fs          = require('fs'),
    Converter   = require("csvtojson").Converter,
    _           = require('lodash'),


    // 
    tripKeyBuilder = require('../lib/utils/tripKeyBuilder'),


    // FIXME: hardcoded date
    gtfsDataDir = __dirname + '/' + '../GTFS_Data/20150614/',

    dataDict    = {},

    tablePKs    = {
        agency   : 'agency_id'  ,
        calendar : 'service_id' ,
        routes   : 'route_id'   ,
        stops    : 'stop_id'    ,
        trips    : 'trip_id'    ,
    },

    tables = Object.keys(tablePKs);



(function iterateAndParse (i) {
    var tableName = tables[i],
        filePath  = gtfsDataDir + tableName + '.txt',
        converter,
        fileStream;

    if (i === tables.length) {
        fs.writeFile(gtfsDataDir + 'indexedScheduleData.json', JSON.stringify(dataDict, null, 4));
        return;
    }

    converter  = new Converter({constructResult:true});
    fileStream = fs.createReadStream(filePath);

    converter.on("end_parsed", function (parsedTable) {
        dataDict[tableName] = _.indexBy(parsedTable, function (rowObj) {
            var keyName = tablePKs[tableName];

            return (tableName === 'trips') ? tripKeyBuilder(rowObj[keyName]) : rowObj[keyName]; 
        });

        iterateAndParse(++i); 
    });

    fileStream.pipe(converter);
}(0));
