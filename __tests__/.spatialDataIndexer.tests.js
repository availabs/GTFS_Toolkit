// FIXME: CAN'T GET THIS TO WORK
//          No output to data dir.

jest.autoMockOff();

describe('spatialDataIndexer', function() {
    it('Make sure it runs.', function() {
        var indexer = require('../lib/spatialDataIndexer.js'),
            config  = { gtfsDataDir : __dirname + '/data/' };
        
        indexer.run(config);
    });
});
