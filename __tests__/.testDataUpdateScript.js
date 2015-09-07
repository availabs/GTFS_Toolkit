#!/usr/bin/env node

'use strict';

var execFile = require('child_process').execFile,
    config   = require('./.config.js');


execFile('../bin/updateGTFSData.js', [config.gtfsConfigFilePath], function (err, stdout, stderr) {
    
    if (err) { console.log(err); } 
    else     { console.log('==== Indexing Complete. ===='); }
});
