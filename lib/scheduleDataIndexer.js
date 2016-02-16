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

    var fs          = require('fs') ,
        path        = require('path') ,
        Converter   = require("csvtojson").Converter ,
        _           = require('lodash') ,

        dataDict    = {},

        tablePKs    = {
            trips      : 'trip_id' ,
            agency     : 'agency_id' ,
            routes     : 'route_id' ,
            stops      : 'stop_id' ,
            stop_times : ['trip_id', 'stop_times' ],
        },

        tables = Object.keys(tablePKs),

        tripKeyMutator = (Array.isArray(config.tripKeyMutator)) ? config.tripKeyMutator : null,
        
        outputFilePath;
    

    if ( ! (workingDirPath && config && config.indexedScheduleDataFileName) ) { 
        throw 'Need to pass the working directory and a config object ' + 
                'with the indexedScheduleDataFileName property defined.'; 
    }


    outputFilePath = path.join(workingDirPath, config.indexedScheduleDataFileName);


    (function iterateAndParse (i) {
        var tableName = tables[i],
            filePath  = path.join(workingDirPath, tableName + '.txt'),
            converter,
            fileStream;

        if (i === tables.length) {
            fs.writeFile(outputFilePath, JSON.stringify(dataDict), runMethodCallback);
            return;
        }

        // The stop_times table is huge, and not necessarily required.
        //
        // NOTE: For large stop_times tables that are required, 
        //          node may run out of memory, or the length
        //          of the stringified dataDict can cause an error.
        //
        //          If these stop_times is required and these errors occur,
        //          it seems the best solution would be to store the stop_times
        //          in separate files and to implement a cache for these.
        //          The memory usage would be improved by only keeping in memory
        //          the necessary stop_times information.
        //
        //          Punting on that for now... YAGNI.
        if ((tableName === 'stop_times') && (!config.index_stop_times)) { iterateAndParse(++i); return; }


        try {
            var previousTripKey ,
                previousStopInfo ;

            converter  = new Converter({constructResult:true});
            fileStream = fs.createReadStream(filePath);

            converter.on("end_parsed", function (parsedTable) {

                if ( ! Array.isArray(parsedTable) ) { return; }

                // The stop_times table requires special logic.
                if (tableName === 'stop_times') {


                    /**
                     *  the stop_times information in stored in a table with the following structure:
                     *      
                     *      { 
                     *          tripKey : {
                     *              stopInfoBySequenceNumber: [] , //indexed by sequence number
                     *              stopIdToSequenceNumbersTable: { stop_id : [] } // array of stop_sequences
                     *          }
                     *      }     
                     */
                    dataDict[tableName] = parsedTable.reduce(function (acc, rowObj) {

                        if (_.isEmpty(rowObj)) { return acc; }


                        var tripKey = (tripKeyMutator) ? 
                                            rowObj.trip_id.replace(tripKeyMutator[0], tripKeyMutator[1]) :
                                            rowObj.trip_id ,

                            stop_id = rowObj.stop_id ,

                            stop_sequence = parseInt(rowObj.stop_sequence) ,

                            stopInfo;



                        if (!acc[tripKey]) {
                            acc[tripKey] = {
                                stopInfoBySequenceNumber : [],
                                stopIdToSequenceNumbersTable : {},
                            };
                        }

                        if (!acc[tripKey].stopIdToSequenceNumbersTable[stop_id]) {
                            acc[tripKey].stopIdToSequenceNumbersTable[stop_id] = [];
                        }

                        stopInfo = {
                            stop_id        : stop_id ,
                            arrival_time   : rowObj.arrival_time ,
                            departure_time : rowObj.departure_time ,
                            nextStop       : null , // GTFS data can have gaps in seq nums.
                        };

                        // Even if stop_sequence is NaN, we may be able to use it...
                        acc[tripKey].stopInfoBySequenceNumber[stop_sequence] = stopInfo;
                        acc[tripKey].stopIdToSequenceNumbersTable[stop_id].push(stop_sequence);

                        if (isNaN(stop_sequence)) { // Output the dirty data message.
                            console.warn('WARN: Invalid stop_sequence in stop_times.txt:');
                            console.warn('\t{ trip_id: '+ rowObj.trip_id +', stop_sequence: '+ stop_sequence +' }');
                        }

                        if ((tripKey === previousTripKey) && (previousStopInfo)) {
                            previousStopInfo.nextStop = stopInfo;
                        }

                        previousStopInfo = stopInfo;

                        previousTripKey = tripKey;

                        return acc;

                    },{});

            } else {
                dataDict[tableName] = _.indexBy(parsedTable, function (rowObj) {
                    var keyName = tablePKs[tableName];
                        
                    if ((tableName === 'trips') && tripKeyMutator) {
                        return rowObj[keyName].replace(tripKeyMutator[0], tripKeyMutator[1]) ;
                    } else {
                        return rowObj[keyName] ;
                    }
                });
            }

            iterateAndParse(++i); 
        });

        fileStream.pipe(converter);

        } catch (e) {
            if (e.code === 'ENOENT') {
                console.warn('No', filePath, 'in the data directory.');
                iterateAndParse(++i); 
            } else {
                console.error('Error encountered while creating indexedScheduleData.');
                runMethodCallback(e);
            } 
        }

    }(0)); //END: IterateAndParse immediately invoked function.
}

module.exports = {
    run : run, 
};
