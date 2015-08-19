'use strict';

// TODO: Getting the appropriate GTFS data ?could/should? be handled in here.
//          Based on the tripID passed to the parameters.
//          Should not need to restart this code to handle the transition.
//          but we also don't want to go to disk on every function call.
//
//      ??? A constuctor that takes the schedule date and hands off to local functions ???
//       
//       Should have filters to remove unneeded info. (e.g WKD, SAT, SUN)


var jsonfile = require('jsonfile'),
    _        = require('lodash');


// Gets the latest. Will need to handle feed version effective dates.
function newGTFSWrapperForScheduleDate () { // needs to eventually take scheduleDate as param and get the relevant indices.
    
    
    var indexedScheduleDataPath = __dirname + '/' + '../GTFS_Data/20150614/indexedScheduleData.json',
        indexedSpatialDataPath  = __dirname + '/' + '../GTFS_Data/20150614/indexedSpatialData.json',

        that = {
            indexedScheduleData : jsonfile.readFileSync(indexedScheduleDataPath) ,
            indexedSpatialData  : jsonfile.readFileSync(indexedSpatialDataPath)  ,
        };

    return _.merge(that, _.mapValues(theAPI, function (f) { return f.bind(that); }));
}


var theAPI = {

    getGTFSTripIDForTrain : function (tripKey) {
        return this.getTripIDForTripKey(tripKey);
    },

    getGTFSTripHeadsignForTrain : function (tripKey) {
        return this.getTripHeadsignForTripKey(tripKey);
    },

    getGTFSShapeIDForTrain : function (tripKey) {
        return this.getShapeIDForTripKey(tripKey);
    },

    getTripIDForTripKey : function (tripKey) {
        return (this.indexedScheduleData.trips[tripKey] && this.indexedScheduleData.trips[tripKey].trip_id) || null;
    },

    getTripHeadsignForTripKey : function (tripKey) {
        return ((this.indexedScheduleData.trips[tripKey]) && this.indexedScheduleData.trips[tripKey].trip_headsign) || null;
    },

    getShapeIDForTripKey : function (tripKey) {
        return ((this.indexedScheduleData.trips[tripKey]) && this.indexedScheduleData.trips[tripKey].shape_id) || null;
    },

    getRouteShortNameForTripKey : function (tripKey) {
        return ((this.indexedScheduleData.trips[tripKey]) && this.indexedScheduleData.trips[tripKey].route_short_name) || null;
    },

    getStopName : function (stopID) {
        var stopData = this.indexedScheduleData.stops[stopID];

        return (stopData) ? stopData.stop_name : null;
    },
};

module.exports = {
    newGTFSWrapperForScheduleDate : newGTFSWrapperForScheduleDate,
};
