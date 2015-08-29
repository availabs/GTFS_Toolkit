/**
 *
 * @module GTFS_Toolkit.Factory
 *
 */

'use strict';


var Wrapper = require('./Wrapper');


/**
 * Factory constructor
 *
 * @constructor
 *
 * @params {object} config - must contain a gtfsDataDir member that has the path to the GTFS data directory.
 *
 */
function Factory (config) {
    if (! (config && config.gtfsDataDir) ) { 
        throw "The Factory constructor requires a configuration object with the gtfsDataDir property set.";
    }

    this.gtfsDataDir = config.gtfsDataDir;
}


/**
 * Creates a GTFS Wrapper for the passed date
 *
 * @param {Date} scheduleDate
 *
 * @return {Wrapper} GTFS Wrapper for the passed date
 *
 */
Factory.prototype.newWrapperForScheduleDate = function (scheduleDate) {

    return new Wrapper(scheduleDate, this.gtfsDataDir);
};

module.exports = Factory;