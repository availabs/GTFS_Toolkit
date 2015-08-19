#!/usr/bin/env node

'use strict';

var testConfig = require('./testConfig');



var wrapper = require('../lib/GTFS_Wrapper.js'),

    obj = wrapper.Factory(testConfig).newGTFSWrapperForScheduleDate();

console.log(JSON.stringify(obj, null, '    '));

