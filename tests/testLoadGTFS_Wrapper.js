#!/usr/bin/env node

'use strict';

var wrapper = require('../lib/GTFS_Wrapper.js'),

    obj = wrapper.newGTFSWrapperForScheduleDate();

console.log(JSON.stringify(obj, null, '    '));

