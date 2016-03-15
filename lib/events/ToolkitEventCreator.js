'use strict';


var eventEmitter = require('./ToolkitEventEmitter') ;



module.exports = {
    emitFeedHandlerConstructionEvent : function (payload) {
        eventEmitter.emit(eventEmitter.eventTypes.FEED_HANDLER_CONSTRUCTION_STATUS, payload) ;
    } ,

    emitFeedUpdateStatus : function (payload) {
        eventEmitter.emit(eventEmitter.eventTypes.FEED_UPDATE_STATUS, payload) ;
    } ,

    emitDataAnomaly : function (payload) {
        eventEmitter.emit(eventEmitter.eventTypes.DATA_ANOMALY, payload) ;
    } ,

    emitError : function (payload) {
        eventEmitter.emit(eventEmitter.eventTypes.ERROR, payload) ;
    } ,
} ;

