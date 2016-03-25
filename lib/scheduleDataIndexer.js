/**
 *
 * @module GTFS_Toolkit.scheduleDataIndexer
 *
 */

'use strict';

var fs          = require('fs') ,
    process     = require('process') ,
    path        = require('path') ;


function run (workingDirPath, config, runMethodCallback) {

    var Converter   = require("csvtojson").Converter ,
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

        tripKeyMutator = (Array.isArray(config.tripKeyMutator)) ? config.tripKeyMutator : null ,

        msg ;
        
    

    if ( ! (workingDirPath && config && config.indexedScheduleDataFilePath) ) { 
        sendMessageToParentProcess({
            error: 'Error: Server error while indexing the GTFS schedule data.' ,
        });

        runMethodCallback(new Error('Need to pass the working directory and a config object ' + 
                                    'with the indexedScheduleDataFilePath property defined.' )) ;
        return;
    }

    sendMessageToParentProcess({ info: 'Indexing GTFS schedule data.' , });

    (function iterateAndParse (i) {
        var tableName = tables[i],
            filePath  = path.join(workingDirPath, tableName + '.txt'),
            converter ;

        if (i === tables.length) {
            try {
                fs.writeFile(config.indexedScheduleDataFilePath, JSON.stringify(dataDict), function (err) { 
                    if (err) {
                        sendMessageToParentProcess({
                            error: 'Error occurred writing the indexed GTFS schedule data to disk.' ,
                        });
                        runMethodCallback(err);
                    } else {
                        sendMessageToParentProcess({
                            info: 'Indexed GTFS schedule data written to disk.' ,
                        });
                        runMethodCallback(null);
                    }
                });
                return;
            } catch (err) {
                sendMessageToParentProcess({
                    error: 'Error occurred writing the indexed GTFS schedule data to disk.' ,
                });
                runMethodCallback(err);
            }
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
        if ((tableName === 'stop_times') && (!config.indexStopTimes)) { iterateAndParse(++i); return; }


        try {
            var previousTripKey ,
                previousStopInfo ;

            converter  = new Converter({constructResult:true});

            sendMessageToParentProcess({ debug: ('Reading ' + tableName + '.txt') , });

            fs.createReadStream(filePath)
              .on('error', function () {
                    var msg = 'The spatial data indexer encountered an error reading from ' + tableName + '.txt' ;

                    sendMessageToParentProcess({ error: msg }) ;
                    console.warn(msg) ;
                  })
              .pipe(converter) ;

            converter.on("end_parsed", function (parsedTable) {

                if ( ! Array.isArray(parsedTable) ) { return; }

                // The stop_times table requires special logic.
                if (tableName === 'stop_times') {

                    sendMessageToParentProcess({ debug: ('Indexing ' + tableName) });

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
//TODO: Redirect dirty data messages to their own log.
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

                    sendMessageToParentProcess({ debug: ('Successfully indexed ' + tableName) });

            } else {
                sendMessageToParentProcess({ debug: ('Indexing ' + tableName) }) ;

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

        } catch (e) {
            if (e.code === 'ENOENT') {
                msg = 'No ' + filePath + ' in the data directory.' ;

                console.warn(msg);
                sendMessageToParentProcess({ error: msg }) ;

                iterateAndParse(++i); 

            } else {
                msg = 'Error encountered while creating indexedScheduleData.' ;
                
                console.error(msg) ;
                sendMessageToParentProcess({ error: msg }) ;
                
                runMethodCallback(e) ;
            } 
        }

    }(0)); //END: IterateAndParse immediately invoked function.
}


function sendMessageToParentProcess (message) {
    if (process.send) { 
        message.timestamp = parseInt(process.hrtime().join(''))/1000 ;
        process.send(message);
    }
}


module.exports = {
    run : run, 
};
