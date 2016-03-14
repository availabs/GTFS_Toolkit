'use strict';


var eventEmitter = require('./ToolkitEventEmitter') ;



module.exports = {
    emitError : function (payload) {
        eventEmitter.emit(eventEmitter.eventTypes.ERROR, payload) ;
    } ,

    emitDataAnomaly : function (payload) {
        eventEmitter.emit(eventEmitter.eventTypes.DATA_ANOMALY, payload) ;
    } ,

    emitFeedUpdateStatus : function (payload) {
        eventEmitter.emit(eventEmitter.eventTypes.FEED_UPDATE_STATUS, payload) ;
    } ,

} ;

