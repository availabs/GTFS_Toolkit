/**
 *
 * @module GTFS_Toolkit.scheduleDataIndexer
 *
 */

'use strict';

//TODO: Need to extract only the relevant data from the GTFS data.
//      Otherwise, JSON object is about 185M.
//
//TODO: Should prob just return the data as a string so that 
//         modules extending this one can easily mutate it as needed.
//      No need to force disk I/O on clients who may not need it.


function run (workingDirPath, config, runMethodCallback) {

    var fs          = require('fs')                  ,
        path        = require('path')                ,
        Converter   = require("csvtojson").Converter ,
        _           = require('lodash')              ,

        dataDict    = {},

        tablePKs    = {
            agency   : 'agency_id'  ,
            calendar : 'service_id' ,
            routes   : 'route_id'   ,
            stops    : 'stop_id'    ,
            trips    : 'trip_id'    ,
        },

        tables = Object.keys(tablePKs),
        
        outputFilePath;
    

    if ( ! (workingDirPath && config && config.indexedScheduleDataFileName) ) { 
        throw 'Need to pass the working directory and a config object with the indexedScheduleDataFileName property defined.'; 
    }


    outputFilePath = path.join(workingDirPath, config.indexedScheduleDataFileName);


    (function iterateAndParse (i) {
        var tableName = tables[i],
            filePath  = path.join(workingDirPath, tableName + '.txt'),
            converter,
            fileStream;

        if (i === tables.length) {
            fs.writeFile(outputFilePath, JSON.stringify(dataDict));
            if (runMethodCallback) { runMethodCallback(); }
            return;
        }

        try {
            fs.exists(filePath, function(exists) { 
                if (exists) { 
                    converter  = new Converter({constructResult:true});
                    fileStream = fs.createReadStream(filePath);

                    converter.on("end_parsed", function (parsedTable) {
                        dataDict[tableName] = _.indexBy(parsedTable, function (rowObj) {
                            var keyName = tablePKs[tableName];

                            return (tableName === 'trips' && config.tripKeyBuilder) ? 
                                        config.tripKeyBuilder(rowObj[keyName])      : 
                                        rowObj[keyName]                             ; 
                        });

                        iterateAndParse(++i); 
                    });

                    fileStream.pipe(converter);
                } else {
                    console.log('No', filePath, 'in the data directory.');

                    iterateAndParse(++i); 
                }
            });
        } catch (e) {
            runMethodCallback(e);
        }
    }(0));
}

module.exports = {
    run : run, 
};
