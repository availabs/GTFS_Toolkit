'use strict';

var _ = require('lodash');


var theAPI = {

    // FIXME: This name doesn't make sense.
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
        return _.get(this.indexedScheduleData, ['trips', tripKey, 'trip_id'], null);
    },

    getTripHeadsignForTripKey : function (tripKey) {
        return _.get(this.indexedScheduleData, ['trips', tripKey, 'trip_headsign'], null);
    },

    getShapeIDForTripKey : function (tripKey) {
        return _.get(this.indexedScheduleData, ['trips', tripKey, 'shape_id'], null);
    },

    getRouteShortNameForTripKey : function (tripKey) {
        return _.get(this.indexedScheduleData, ['trips', tripKey, 'route_short_name'], null);
    },

    getStopName : function (stopID) {
        var stopData = this.indexedScheduleData.stops[stopID];

        return (stopData) ? stopData.stop_name : null;
    },
};


module.exports = theAPI;
