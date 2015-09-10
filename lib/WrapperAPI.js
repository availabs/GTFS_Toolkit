/**
 *
 * @module "GTFS_Toolkit.WrapperAPI"
 *
 * see https://developers.google.com/transit/gtfs/reference
 */


'use strict';

var _ = require('lodash');


var theAPI = {

    /**
     * "If the a tripKeyBuilder function was passed to the indexers, 
     *  tripKey is the output of that function when passed a trip_id.
     *  This function performs the inverse, mapping back from tripKey
     *  to trip_id."
     * @param {string} tripKey - The key used in the indices to represent a trip.
     * @returns {string}
     */ 
    getFullTripIDForTrip : function (tripKey) {
        return _.get(this, ['indexedScheduleData', 'trips', tripKey, 'trip_id'], null);
    },


    /**
     * "The trip_headsign field contains the text that appears on a sign 
     *  that identifies the trip's destination to passengers."
     * @param {string} tripKey - either trip_id or output of tripKeyBuilder
     * @returns {string}
     */
    getTripHeadsign : function (tripKey) {
        return _.get(this, ['indexedScheduleData', 'trips', tripKey, 'trip_headsign'], null);
    },



    /**
     * "The shape_id field contains an ID that defines a shape for the trip. 
     *  This value is referenced from the shapes.txt file. 
     *  The shapes.txt file allows you to define how a line 
     *  should be drawn on the map to represent a trip.
     * @param {string} tripKey - either trip_id or output of tripKeyBuilder
     * @return {string}
     */
    getShapeIDForTrip : function (tripKey) {
        return _.get(this, ['indexedScheduleData', 'trips', tripKey, 'shape_id'], null);
    },


    /**
     * "The route_id field contains an ID that uniquely identifies a route. 
     *  This value is referenced from the routes.txt file."
     * @param {string} tripKey - either trip_id or output of tripKeyBuilder
     * @return {string}
     */
    getRouteIDForTrip : function (tripKey) {
        return _.get(this, ['indexedSpatialData', 'trips', tripKey, 'route_id'], null);
    },


    /**
     * "The direction_id field contains a binary value that indicates 
     *  the direction of travel for a trip. Use this field to distinguish 
     *  between bi-directional trips with the same route_id. 
     *  This field is not used in routing; it provides a way to separate 
     *  trips by direction when publishing time tables"
     * @param {string} tripKey - either trip_id or output of tripKeyBuilder
     * @return {string}
     */
    getDirectionIDForTrip : function (tripKey) {
        return _.get(this, ['indexedSpatialData', 'trips', tripKey, 'direction_id'], null);
    },

    /**
     * "The route_short_name contains the short name of a route. 
     *  This will often be a short, abstract identifier 
     *  like "32", "100X", or "Green" that riders use to identify a route, 
     *  but which doesn't give any indication of what places the route serves."
     * @param {string} route_id 
     * @return {string}
     */
    getRouteShortName : function (route_id) {
        return _.get(this, ['indexedScheduleData', 'routes', route_id, 'route_short_name'], null);
    },



    /**
     * "The route_long_name contains the full name of a route. 
     *  This name is generally more descriptive than the route_short_name 
     *  and will often include the route's destination or stop."
     * @param {string} route_id
     * @return {string}
     */
    getRouteLongName : function (route_id) {
        return _.get(this, ['indexedScheduleData', 'routes', route_id, 'route_long_name'], null);
    },



    
    /**
     * "The stop_name field contains the name of a stop or station."
     * @param {string} stop_id
     * @returns {string}
     */
    getStopName : function (stop_id) {
        return _.get(this, ['indexedScheduleData', 'stops', stop_id, 'stop_name'], null);
    },


    getIDOfFirstStopForTrip : function (tripKey) {
        var i = _.get(this, ['indexedSpatialData', 'tripKeyToProjectionsTableIndex', tripKey], null);

        return _.get(this, ['indexedSpatialData', 'stopProjectionsTable', i, 0, 'stop_id'], null);
    },


    /**
     * "The block_id field identifies the block to which the trip belongs. 
     *  A block consists of two or more sequential trips made using the same vehicle, 
     *  where a passenger can transfer from one trip to the next just by staying in the vehicle. 
     *  The block_id must be referenced by two or more trips in trips.txt."
     *
     * NOTE: Qualifications in the MTA documentations.
     *       @see [Transparency of Block vs. Trip-Level Assignment]@link{https://bustime.mta.info/wiki/Developers/SIRIMonitoredVehicleJourney#HTransparencyofBlockvs.Trip-LevelAssignment}
     * @param {string|number} tripKey
     * @returns {string}
     */
    getBlockIDForTrip : function (tripKey) {
        return _.get(this, ['indexedScheduleData', 'trips', tripKey, 'block_id']) || null;
    }
};


module.exports = theAPI;


/*
getFullTripIDForTrip
getTripHeadsign
getShapeIDForTrip
getRouteShortName
getRouteLongName
getStopName
getIDOfFirstStopForTrip
getBlockIDForTrip 
*/
