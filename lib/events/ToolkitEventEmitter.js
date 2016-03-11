'use strict';


var EventEmitter = require('events') ,
    util = require('util') ;



function ToolkitEventEmitter () {
    EventEmitter.call(this) ;
}

util.inherits(ToolkitEventEmitter, EventEmitter) ;


ToolkitEventEmitter.prototype.eventTypes = {
    DATA_ANOMALY : 'DATA_ANOMALY' ,
    ERROR        : 'ERROR' ,
};


module.exports = new ToolkitEventEmitter() ;

