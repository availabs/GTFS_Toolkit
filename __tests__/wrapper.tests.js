jest.autoMockOff();

describe('Wrapper', function() {

    it('Make sure we can create a Wrapper.', function() {
        var path     = require('path'),
            jsonfile = require('jsonfile'),

            Wrapper  = require('../lib/Wrapper.js'),
            config   = require('./.config.js'),

            indexedScheduleData = jsonfile.readFileSync(path.join(config.dataDirPath, config.indexedScheduleDataFilePath)),
            indexedSpatialData  = jsonfile.readFileSync(path.join(config.dataDirPath, config.indexedSpatialDataFilePath)),

            wrapper = new Wrapper(indexedScheduleData, indexedSpatialData);
            
        expect(wrapper).toBeTruthy();
    });
});
