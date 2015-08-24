#!/usr/bin/env node

'use strict';

require('../lib/scheduleDataIndexer').run( { gtfsDataDir : './data/' } );
