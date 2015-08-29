/**
 *
 * @module GTFS_Toolkit.Wrapper
 *
 */

'use strict';

// FIXME: needs to eventually take scheduleDate as param and get the relevant indices.
//
// NOTE: For client ease of use, use the Factory to handle configuration.
//
// Should have filters to remove unneeded info. (e.g WKD, SAT, SUN)
//
// Could possibly partition the indexed data and have a cache
//    to avoid having large quantities of unused data in memory.


var jsonfile = require('jsonfile'),
    theAPI   = require('./WrapperAPI');


/**
 * Creates a GTFS Wrapper.
 *
 * @constructor 
 *
 * @param {date}   scheduleDate 
 * @param {string} dataDir - the path to the GTFS data directory.
 *
 */
function Wrapper (scheduleDate, gtfsDataDir) { 

    var indexedScheduleDataPath = gtfsDataDir + '/indexedScheduleData.json',
        indexedSpatialDataPath  = gtfsDataDir + '/indexedSpatialData.json';

    this.indexedScheduleData = jsonfile.readFileSync(indexedScheduleDataPath) ;
    this.indexedSpatialData  = jsonfile.readFileSync(indexedSpatialDataPath)  ;
}
Wrapper.prototype = Object.create(theAPI);


module.exports = Wrapper;
