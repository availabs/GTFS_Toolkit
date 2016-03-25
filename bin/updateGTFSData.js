#!/usr/bin/env node

'use strict';

/**
 * This script is _NOT_ to be run while any code is using the data.
 * This script will NOT coordinate with the GTFS_Toolkit.Factory.
 *
 * To update the GTFS data for a running server, use the GTFS_Toolkit.FeedHandler.update method.
 */

/**
 * Command line arguments:
 *      1. path to the GTFS configuration node module.
 *      2. [optional] source from which to get the data. [file|url]
 *                      If no source given, data will be retrieved 
 *                      from the config.feedURL. 
 */


var fs        = require('fs') ,
    process   = require('process') ,
    request   = require('request') ,
    async     = require('async') ,
    mkdirp    = require('mkdirp') ,
    rimraf    = require('rimraf') ,
    admZip    = require('adm-zip') ;

var scheduleDataIndexer = require('../lib/scheduleDataIndexer.js') ,
    spatialDataIndexer  = require('../lib/spatialDataIndexer.js')  ;



//=================== Ensure we have gotten all the required info. ===================\\

var usageMessage;

if (process.argv.length < 3) {

    usageMessage = 'Usage: The GTFS config file path is required.' ;

    console.error(usageMessage);
    sendMessageToParentProcess({
        error: 'Error: Server error while indexing the GTFS schedule data.', 
        debug: new Error(usageMessage) ,
    }) ;
    process.exit(1);
}



//var config = require(process.argv[2]);  // Put the config in the file scope.

// Put the config in the file scope.
var configSource = require(process.argv[2]),
    config = (configSource && (typeof configSource.getGTFSConfig === 'function')) ? 
                configSource.getGTFSConfig() : configSource ;



// http://stackoverflow.com/a/32108184
if (!config || ((Object.keys(config).length === 0) && (JSON.stringify(config) === JSON.stringify({})))) {

    var usageMessage = 'Invalid configuration source for the GTFS feed.';

    console.error(usageMessage);
    sendMessageToParentProcess({
        error: 'Error: Server error while indexing the GTFS schedule data.', 
        debug: new Error(usageMessage) ,
    }) ;
    process.exit(1);
}


if ( (process.argv.length < 4) && ( !config.feedURL ) ) {

    usageMessage = 'Usage: If a "source" is not given as the second command line argument,\n' +
                   '       it is assumed that the data should be retreived from config.feedURL.\n' +
                   '       Therefore, you must either specify the feedURL in the config file,\n' +
                   '       or upload the GTFS feed data to the location given as\n' +
                   '       feedDataZipFilePath in the config file.\n' ;

    console.log(usageMessage);
    sendMessageToParentProcess({
        error: 'Error: Server error while indexing the GTFS schedule data.', 
        debug: new Error(usageMessage).stack ,
    }) ;
    process.exit(1);
}


var source = process.argv[3] || 'url';

//============================ Starts the ball rolling. =============================\\


(function () {
    var requiredStages = (source === 'url') ? [stage_1, stage_2, stage_3] : [stage_2, stage_3];

    async.series(requiredStages, function (err) {
        if (err) {
            try {
                cleanup();
            } finally {
                console.error(err.stack || err);

                sendMessageToParentProcess({
                    error: 'The GTFS data update failed.' ,
                    debug: err.stack || err ,
                }) ;

                process.exit(1);
            }
        } else {
            console.log('GTFS data update complete.');

            sendMessageToParentProcess({ 
                info: 'GTFS data update complete.' 
            });

            process.exit(0);
        }
    });
}());


//================================ Coordinaters ===================================\\

function stage_1 (callback) {
    var tasks = [
        removeTmpDir ,
        createDirectories ,
        downloadStaticGTFS ,
    ];

    async.series(tasks, callback);
}



function stage_2 (callback) {
    var tasks = [
        unzipStaticGTFS ,
        indexGTFSData   ,
    ];

    async.series(tasks, callback);
}



function stage_3 (callback) {
    var tasks = [
        removeTmpDir ,
    ];

    async.series(tasks, callback);
}


function cleanup (callback) {
    sendMessageToParentProcess({
        debug: 'Removing the GTFS update work directory.' ,
    }) ;
    removeTmpDir(callback);
}


//================================ The workers ====================================\\

function removeTmpDir (callback) {
    rimraf(config.workDirPath, callback);
}



function createDirectories (callback) {

    mkdirp(config.dataDirPath, function (err) {
        if (err) { 
            sendMessageToParentProcess({ error: 'Error encountered while creating the GTFS data directory.' , }) ;
            callback(err); 
        } else {
            mkdirp(config.workDirPath, function (err) {
                if (err) {
                    sendMessageToParentProcess({
                        error: 'Error encountered while creating the GTFS update work directory.' ,
                    }) ;
                    return callback(err) ;
                }
                callback(null);
            });
        }
    });
}



//http://stackoverflow.com/a/22907134
function downloadStaticGTFS (callback) {
    try {
        var gtfsFeedZipFile = 
                fs.createWriteStream(config.feedDataZipFilePath) 
                  .on('error', function (err) {
                          sendMessageToParentProcess({
                              error: 'Error encountered writing the GTFS zip archive file to disk.' ,
                          }) ;
                          callback(err); 
                      })
                  .on('finish', function () {
                          sendMessageToParentProcess({ debug: 'GTFS feed zip file download complete.' , }) ;
                          gtfsFeedZipFile.close(callback); 
                      });

            sendMessageToParentProcess({ debug: 'Downloading the GTFS feed zip file.' , }) ;

            request(config.feedURL).pipe(gtfsFeedZipFile);

    } catch (e) {
        sendMessageToParentProcess({
            error: 'GTFS feed zip file download encountered an error.' 
        });
        callback(e);
    }
}



function unzipStaticGTFS (callback) {
    var zip = new admZip(config.feedDataZipFilePath);

    sendMessageToParentProcess({
        debug: 'Extracting the GTFS feed data from the zip archive.'
    });
    zip.extractAllToAsync(config.workDirPath, true, function (err) {
        if (err) {
            sendMessageToParentProcess({
                error: 'Error encountered while extracting the GTFS feed data.'
            });
            return callback(err) ;
        }
        sendMessageToParentProcess({
            debug: 'Successfully extracted the GTFS feed data from the zip archive.'
        });
        callback(null);
    });
}



function indexGTFSData (callback) {
    var indexingTasks = [
            scheduleDataIndexer.run.bind(null, config.workDirPath, config) ,
            spatialDataIndexer.run.bind(null, config.workDirPath, config)  ,
        ];

    sendMessageToParentProcess({
        info: 'Starting indexing tasks.'
    });
    async.parallel(indexingTasks, callback);
}



function sendMessageToParentProcess (message) {
    if (process.send) { 
        message.timestamp = (Date.now() + (process.hrtime()[1]%1000000)/1000000) ;
        process.send(message);
    }
}
