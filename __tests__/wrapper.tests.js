jest.autoMockOff();

describe('Wrapper', function() {

    it('Make sure we can create a Wrapper.', function() {
        var path     = require('path'),
            jsonfile = require('jsonfile'),

            Wrapper  = require('../lib/Wrapper.js'),
            config   = require('./.config.js'),

            indexedScheduleData = jsonfile.readFileSync(path.join(config.dataDirPath, config.indexedScheduleDataFileName)),
            indexedSpatialData  = jsonfile.readFileSync(path.join(config.dataDirPath, config.indexedSpatialDataFileName)),

            wrapper = new Wrapper(indexedScheduleData, indexedSpatialData);
            
        expect(wrapper).toBeTruthy();
    });
});
