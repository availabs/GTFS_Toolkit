/**
 *
 * @module GTFS_Toolkit.Wrapper
 *
 */

'use strict';


var theAPI   = require('./WrapperAPI');


/**
 * Creates a GTFS Wrapper.
 * @see GTFS_Toolkit.Factory
 *
 * @constructor 
 *
 * @param {object} indexedScheduleData
 * @param {object} indexedSpatialData
 *
 */
function Wrapper (indexedScheduleData, indexedSpatialData) { 

    this.indexedScheduleData = indexedScheduleData ;
    this.indexedSpatialData  = indexedSpatialData  ;
}

Wrapper.prototype = Object.create(theAPI);

module.exports = Wrapper;
