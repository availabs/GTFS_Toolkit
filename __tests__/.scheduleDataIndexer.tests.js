// FIXME: CAN'T GET THIS TO WORK
//          No output to data dir.

jest.autoMockOff();

describe('scheduleDataIndexer', function() {
    it('Make sure it runs.', function() {
        var indexer = require('../lib/scheduleDataIndexer'),
            config  = { gtfsDataDir : __dirname + '/data/' };
        
        indexer.run(config);
    });
});
