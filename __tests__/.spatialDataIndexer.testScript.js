#!/usr/bin/env node

'use strict';


require('../lib/spatialDataIndexer').run({ gtfsDataDir : __dirname + '/data/' });
