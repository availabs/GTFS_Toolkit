/**
 *
 * @module GTFS_Toolkit.FeedHandler
 *
 */


'use strict';

var path     = require('path') ,
    async    = require('async') ,
    jsonfile = require('jsonfile') ,
    fork     = require('child_process').fork ,
    _        = require('lodash') ;


var toolkitEventEmitter = require('./events/ToolkitEventEmitter') ,
    eventCreator = require('./events/ToolkitEventCreator.js') ;


var dataUpdaterScriptPath = path.normalize(path.join(__dirname, '../bin/updateGTFSData.js'));


/**
 * FeedHandler constructor
 *
 * @constructor
 * @param {object} config - must contain a dataDirPath member that has the path to the GTFS data directory, an indexedScheduleDataFilePath, and an indexedSpatialDataFilePath.
 *
 * TODO: Describe how Data integrity requires this module to only update indices when told to do so.
 */
function FeedHandler (config) {
    if ( ! ( config                             &&
             config.gtfsConfigFilePath          &&
             config.dataDirPath                 &&
             config.tmpDirPath                  &&
             config.indexedScheduleDataFilePath &&
             config.indexedSpatialDataFilePath  &&
             config.indexingStatisticsLogPath  )) {

        throw new Error("The GTFS_Toolkit.FeedHandler constructor requires a config obj param with the dataDirPath property set.");
    }

    this.listeners = [];

    this.config            = config;
    this.latestGTFSIndices = getLatestGTFSIndicesSync.call(this);

    this.toolkitEventEmitter = toolkitEventEmitter ;
}



//===================== External API =====================

/**
 * Takes a new configuration object and using lodash.assign 
 *  "Assigns own enumerable properties of newConfig parameter to the [FeedHandler's] this.config object."
 *
 *  @param {Object} newConfig The new configuration. Note: newConfig only overwrites properties of this.config. 
 *  If a property is in this.config and not in newConfig, it remains unchanged.
 **/
FeedHandler.prototype.updateConfig = function (newConfig) {
    _.assign(this.config, newConfig);
};

/**
 * Register a listener.
 * @param {function} listener - callback that will be called for each feed message, with the message JSON as the parameter.
 */
FeedHandler.prototype.registerListener = function (listener) {
    if ( ! _.isFunction(listener) ) {
        throw new Error ("Listeners must be functions.");
    }

    this.listeners.push(listener);

    listener(this.latestGTFSIndices); // Immediate callback with the latest indices.
};


/**
 * Remove a listener.
 * @param {function} listener - listener to remove.
 */
FeedHandler.prototype.removeListener = function (listener) {
    _.pull(this.listeners, listener);
};



/**
 * Update the GTFS data. Allows live updates (while server running).
 *
 * @param {String} source The source from which to retrieve the new GTFS data. Must be either "file" or "url".
 * @param {Function} callback Function parameters (error, stdout, stdin)
 *
 **/
FeedHandler.prototype.update = function (source, callback) {
    var _this = this;

    fork(dataUpdaterScriptPath, [this.config.gtfsConfigFilePath, source])
        .on('message', function (msg) { eventCreator.emitFeedUpdateStatus(msg);  })
        .on('exit', function (code) {
            var msg;

            if (code) {
                msg = 'GTFS data update failed with status code' + code;
                console.log(msg);
                callback(new Error(msg));
            } else {
                try {
                    updateIndices.call(_this, function (err) {
                        callback(err);
                    });
                } catch (e) {
                    callback(e); 
                }
            }
        });
};



function updateIndices (callback) {
    /* jshint validthis:true */
    var _this = this;

    var tasks = {
        indexedScheduleData : getIndexedScheduleData.bind(this) ,
        indexedSpatialData  : getIndexedSpatialData.bind(this)  ,
    };

    async.parallel(tasks, function (err, results) {
        if (err) {
            callback(err);
        } else {
            _this.latestGTFSIndices = results;

            callback(null);

            _.forEach(_this.listeners, function (listener) {
                listener(results);
            });
        }
    });
}


// for use with async
function getIndexedScheduleData (callback) {
    /* jshint validthis:true */
    jsonfile.readFile(this.config.indexedScheduleDataFilePath, function (err, obj) {
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
    jsonfile.readFile(this.config.indexedSpatialDataFilePath, function (err, obj) {
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
    return jsonfile.readFileSync(this.config.indexedScheduleDataFilePath);
}



function getIndexedSpatialDataSync () {
    /* jshint validthis:true */
    //var indexedSpatialDataPath  = path.join(this.config.dataDirPath, this.config.indexedSpatialDataFilePath);
    return jsonfile.readFileSync(this.config.indexedSpatialDataFilePath);
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


