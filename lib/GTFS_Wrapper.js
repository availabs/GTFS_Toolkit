'use strict';

// TODO: Getting the appropriate GTFS data ?could/should? be handled in here.
//
//       Should have filters to remove unneeded info. (e.g WKD, SAT, SUN)
//
//       Could possibly partition the indexed data and have a cache
//          to avoid having large quantities of unused data in memory.


var jsonfile = require('jsonfile'),
    _        = require('lodash'),

    theAPI   = require('./GTFS_WrapperAPI');



function Factory (config) {
   
    if (! (config && config.gtfsDataDir) ) { 
        throw "Factory requires a configuration object with the gtfsDataDir property."; 
    }


    // FIXME: needs to eventually take scheduleDate as param and get the relevant indices.
    function newGTFSWrapperForScheduleDate () { 

        var indexedScheduleDataPath = config.gtfsDataDir + '/indexedScheduleData.json',
            indexedSpatialDataPath  = config.gtfsDataDir + '/indexedSpatialData.json',

            that = {
                indexedScheduleData : jsonfile.readFileSync(indexedScheduleDataPath) ,
                indexedSpatialData  : jsonfile.readFileSync(indexedSpatialDataPath)  ,
            };

        // The `this` var in API functions will have access to the indices,
        //      as well as each other, while not requiring each new Wrapper obj
        //      to redefine all the functions.
        return _.merge(that, theAPI);
    }

    return {
        newGTFSWrapperForScheduleDate : newGTFSWrapperForScheduleDate ,
    };
}



module.exports = {
    Factory : Factory,
};
