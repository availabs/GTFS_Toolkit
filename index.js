/**
 * GTFS_Toolkit parses and indexes the GTFS data feed.
 * It also offers a layer of abstration for working with the GTFS data via a wrapper object.
 *
 *
 * @module GTFS_Toolkit
 * @summary  Parses, indexes, and offers an abstraction upon the GTFS data feed.
 *
 */

module.exports = {
    Wrapper             : require('./lib/Wrapper.js')             ,
    WrapperFactory      : require('./lib/Factory.js')             ,
    scheduleDataIndexer : require('./lib/scheduleDataIndexer.js') ,
    spatialDataIndexer  : require('./lib/spatialDataIndexer.js')  ,
};
