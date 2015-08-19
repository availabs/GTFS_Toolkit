#!/usr/bin/env node

'use strict';


var testConfig = require('./testConfig');


require('../lib/spatialDataIndexer').run(testConfig);
