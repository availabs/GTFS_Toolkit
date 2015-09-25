#!/usr/bin/env node

'use strict';

/**
 * This script is _NOT_ to be run while any code is using the data.
 * This script will NOT coordinate with the GTFS_Toolkit.Factory.
 *
 * To update the GTFS data for a running app, use the GTFS_Toolkit.FeedHandler.update method.
 *
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



if ( (process.argv.length < 4) && ( ! config.latestDataURL ) ) {
    console.error('Usage: The URL to the latest data must be specified either\n' + 
                          '\tin the GTFS config file\n\tor as the second command line parameter.');
    process.exit(1);
}



//======================= Put config values in global scope. =========================\\

var dataURL     = process.argv[3] || config.latestDataURL  ,
    
    zipFilePath = path.join(config.tmpDirPath, 'gtfs.zip') ;


var scheduleDataIndexer = require('../lib/scheduleDataIndexer.js') ,
    spatialDataIndexer  = require('../lib/spatialDataIndexer.js')  ;



//============================ Starts the ball rolling. =============================\\

(function () {
    async.series([stage_1, stage_2, stage_3], function (err) {
        if (err) {
            try {
                cleanup();
            } finally {
                console.error(err);
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
        unzipStaticGTFS    ,
    ];

    async.series(tasks, callback);
}



function stage_2 (callback) {
    var tasks = [
        indexGTFSData ,
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
    var zipFile = fs.createWriteStream(zipFilePath);

    try {
        request(dataURL).pipe(zipFile);

        zipFile.on('finish', function () {
            zipFile.close(callback);  
        });
    } catch (e) {
        callback(e);
    }
}



function unzipStaticGTFS (callback) {
    var zip = new admZip(zipFilePath);

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
        config.indexedScheduleDataFileName ,
        config.indexedSpatialDataFileName  ,
        config.indexingStatisticsFileName  ,
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
