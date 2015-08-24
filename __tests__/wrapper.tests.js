jest.autoMockOff();

describe('WrapperFactory', function() {

    it('Make sure the Factory creates Wrappers.', function() {
        var Factory = require('../lib/Factory.js'),
            config  = { gtfsDataDir : __dirname + '/data/' },

            factory = new Factory(config),

            wrapper = factory.newWrapperForScheduleDate();
            
        expect(wrapper).toBeTruthy();
    });
});
