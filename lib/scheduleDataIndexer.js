#!/usr/bin/env node


'use strict';

//TODO: Need to extract only the relevant data from the GTFS data.
//      Otherwise, JSON object is about 185M.

function run (config) {

    var fs          = require('fs'),
        Converter   = require("csvtojson").Converter,
        _           = require('lodash'),

        dataDict    = {},

        tablePKs    = {
            agency   : 'agency_id'  ,
            calendar : 'service_id' ,
            routes   : 'route_id'   ,
            stops    : 'stop_id'    ,
            trips    : 'trip_id'    ,
        },

        tables = Object.keys(tablePKs),
        
        outputFilePath = config.gtfsDataDir + 'indexedScheduleData.json';


    if ( ! config && config.gtfsDataDir ) { 
        throw 'Need to pass the gtfsDataDir path through the config parameter.'; 
    }


    (function iterateAndParse (i) {
        var tableName = tables[i],
            filePath  = config.gtfsDataDir + tableName + '.txt',
            converter,
            fileStream;

        if (i === tables.length) {
            fs.writeFile(outputFilePath, JSON.stringify(dataDict, null, 4));
            return;
        }

        fs.exists(filePath, function(exists) { 
            if (exists) { 
                converter  = new Converter({constructResult:true});
                fileStream = fs.createReadStream(filePath);

                converter.on("end_parsed", function (parsedTable) {
                    dataDict[tableName] = _.indexBy(parsedTable, function (rowObj) {
                        var keyName = tablePKs[tableName];

                        return (tableName === 'trips' && config.tripKeyBuilder) ? 
                        config.tripKeyBuilder(rowObj[keyName]) : 
                        rowObj[keyName]; 
                    });

                    iterateAndParse(++i); 
                });

                fileStream.pipe(converter);
            } else {
                console.log('No', filePath, 'in the data directory.');

                iterateAndParse(++i); 
            }
        }); 
    }(0));
}

module.exports = {
    run : run, 
};
