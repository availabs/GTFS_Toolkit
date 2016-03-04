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


var request   = require('request') ,
    fs        = require('fs')      ,
    path      = require('path')    ,
    async     = require('async')   ,
    mkdirp    = require('mkdirp')  ,
    rimraf    = require('rimraf')  ,
    admZip    = require('adm-zip') ;



//=================== Ensure we have gotten all the required info. ===================\\

if (process.argv.length < 3) {
    console.error('Usage: The GTFS config file path is required.');
    process.exit(1);
}

var config = require(process.argv[2]);  // Put the config in the file scope.

console.log('++++' + config.indexingStatisticsFilePath + '++++');

if ( (process.argv.length < 4) && ( !config.feedURL ) ) {
    // To avoid confusing error messages, all code calling this script should provide both
    // arguments, the config file path and the source type. 
    console.error('Usage: If a "source" is not given as the second command line argument,\n' +
                  '       it is assumed that the data should be retreived from config.feedURL.\n' +
                  '       Therefore, you must either specify the feedURL in the config file,\n' +
                  '       or upload the GTFS feed data to the location given as\n' +
                  '       feedDataZipFilePath in the config file.\n');
    process.exit(1);
}

//======================= Put config values in global scope. =========================\\

var source = process.argv[3] || 'url';

var scheduleDataIndexer = require('../lib/scheduleDataIndexer.js') ,
    spatialDataIndexer  = require('../lib/spatialDataIndexer.js')  ;


//============================ Starts the ball rolling. =============================\\

(function () {
    var requiredStages = (source === 'url') ? [stage_1, stage_2, stage_3] : [stage_2, stage_3];

    async.series(requiredStages, function (err) {
        if (err) {
            try {
                cleanup();
            } finally {
                console.error(err.stack || err);
                process.exit(1);
            }
        } else {
            console.log('GTFS data update complete.');
        }
    });
}());


//================================ Coordinaters ===================================\\

function stage_1 (callback) {
    var tasks = [
        removeTmpDir       ,
        createTmpDir       ,
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
        moveIndices  ,
        removeTmpDir ,
    ];

    async.series(tasks, callback);
}


function cleanup (callback) {
    removeTmpDir(callback);
}


//================================ The workers ====================================\\

function removeTmpDir (callback) {
    rimraf(config.tmpDirPath, callback);
}



function createTmpDir (callback) {
    mkdirp(config.tmpDirPath, callback);
}



//http://stackoverflow.com/a/22907134
function downloadStaticGTFS (callback) {
    var zipFile = fs.createWriteStream(config.feedDataZipFilePath);

    try {
        request(config.feedURL).pipe(zipFile);

        zipFile.on('finish', function () {
            zipFile.close(callback);  
        });
    } catch (e) {
        callback(e);
    }
}



function unzipStaticGTFS (callback) {
    var zip = new admZip(config.feedDataZipFilePath);

    zip.extractAllToAsync(config.tmpDirPath, true, callback);
}



function indexGTFSData (callback) {
    var indexingTasks = [
            scheduleDataIndexer.run.bind(null, config.tmpDirPath, config) ,
            spatialDataIndexer.run.bind(null, config.tmpDirPath, config)  ,
        ];

    async.parallel(indexingTasks, callback);
}


function moveIndices (callback) {
    var keepers = [
        config.indexedScheduleDataFilePath ,
        config.indexedSpatialDataFilePath  ,
        config.indexingStatisticsFilePath  ,
    ];

    
    //http://stackoverflow.com/a/17654067
    async.each(keepers, function (fileName, cb) {
        var sourcePath = path.join(config.tmpDirPath, fileName)  ,
            destPath   = path.join(config.dataDirPath, fileName) ,

            source     = fs.createReadStream(sourcePath)         ,
            dest       = fs.createWriteStream(destPath)          ;


        source.pipe(dest);
        source.on('end', cb);
        source.on('error', cb);

    }, callback);
}
