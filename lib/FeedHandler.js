/**
 *
 * @module GTFS_Toolkit.FeedHandler
 *
 */

'use strict';

var path     = require('path')                   ,
    async    = require('async')                  ,
    jsonfile = require('jsonfile')               ,
    execFile = require('child_process').execFile ,
    _        = require('lodash')                 ;


var dataUpdaterScriptPath = path.normalize(path.join(__dirname, '../bin/updateGTFSData.js'));


/**
 * FeedHandler constructor
 *
 * @constructor
 * @param {object} config - must contain a dataDirPath member that has the path to the GTFS data directory, an indexedScheduleDataFileName, and an indexedSpatialDataFileName.
 *
 * TODO: Describe how Data integrity requires this module to only update indices when told to do so.
 */
function FeedHandler (config) {
    if ( ! ( config                             &&
             config.gtfsConfigFilePath          &&
             config.dataDirPath                 &&
             config.tmpDirPath                  &&
             config.indexedScheduleDataFileName &&
             config.indexedSpatialDataFileName  &&
             config.indexingStatisticsFileName  )) {

        throw "The GTFS_Toolkit.FeedHandler constructor requires a config obj param with the dataDirPath property set.";
    }

    this.listeners = [];

    this.config            = config;
    this.latestGTFSIndices = getLatestGTFSIndicesSync.call(this);
}



//===================== External API =====================

/**
 * Register a listener.
 * @param {function} listener - callback that will be called for each feed message, with the message JSON as the parameter.
 */
FeedHandler.prototype.registerListener = function (listener) {
    if ( ! _.isFunction(listener) ) {
        throw "Listeners must be functions.";
    }

    this.listeners.push(listener);

    listener(this.latestGTFSIndices); // Immediate callback with the latest indices.
};


/**
 * Remove a listener.
 * @param {function} listener - listener to deregister.
 */
FeedHandler.prototype.removeListener = function (listener) {
    _.pull(this.listeners, listener);
};



// Hook for a GTFS data update while the server is up.
// call ../bin/updateGTFSData.js
// callback(err, stdout, stderr)
FeedHandler.prototype.update = function (url, callback) {
    var configFilePath = this.config.gtfsConfigFilePath;

    execFile(dataUpdaterScriptPath, [configFilePath, url], function (err, stdout, stderr) {
        if (err) {
            console.error('=========== Error ==========');
            callback(err, stdout, stderr); 
        } else {
            try {
                updateIndices.call(this, callback);
                callback(undefined, stdout, stderr); 
            } catch (e) {
                callback(e, stdout, stderr); 
            }
        }
    });
};


//===================== Async versions, for use in FeedHandler constructor. =====================


function updateIndices (callback) {
    /* jshint validthis:true */
    var tasks = {
        indexedScheduleData : getIndexedScheduleData.bind(this) ,
        indexedSpatialData  : getIndexedSpatialData.bind(this)  ,
    };

    async.parallel(tasks, function (err, results) {
        if (err) {
            callback(err);
        } else {
            this.latestGTFSIndices = results;

            callback();

            _.forEach(this.listeners, function (listener) {
                listener(results);
            });
        }
    });
}


// for use with async
function getIndexedScheduleData (callback) {
    /* jshint validthis:true */
    var indexedScheduleDataPath = path.join(this.config.dataDirPath, this.config.indexedScheduleDataFileName);

    jsonfile.readFile(indexedScheduleDataPath, function (err, obj) {
        if (err) {
            callback(err);
        } else {
            callback(undefined, obj);
        }
    });
}



// for use with async
function getIndexedSpatialData (callback) {
    /* jshint validthis:true */
    var indexedSpatialDataPath  = path.join(this.config.dataDirPath, this.config.indexedSpatialDataFileName);

    jsonfile.readFile(indexedSpatialDataPath, function (err, obj) {
        if (err) {
            callback(err);
        } else {
            callback(undefined, obj);
        }
    });
}


//===================== Sync versions, for use in FeedHandler constructor. =====================

function getLatestGTFSIndicesSync() {
    /* jshint validthis:true */
    return {
                indexedScheduleData : getIndexedScheduleDataSync.call(this)  ,
                indexedSpatialData  : getIndexedSpatialDataSync.call(this)   ,
    };
}


function getIndexedScheduleDataSync () {
    /* jshint validthis:true */
    var indexedScheduleDataPath = path.join(this.config.dataDirPath, this.config.indexedScheduleDataFileName);

    return jsonfile.readFileSync(indexedScheduleDataPath);
}



function getIndexedSpatialDataSync () {
    /* jshint validthis:true */
    var indexedSpatialDataPath  = path.join(this.config.dataDirPath, this.config.indexedSpatialDataFileName);

    return jsonfile.readFileSync(indexedSpatialDataPath);
}

//=========================================================================================



/**
 * Get the latest GTFS_Toolkit.Wrapper
 *
 * @return {object} The latest GTFS data, indexed: { indexedScheduleData: , indexedSpatialData }
 *
 */
FeedHandler.prototype.getLatestIndexedData = function () {
    return this.latestGTFSIndices;
};

module.exports = FeedHandler;
