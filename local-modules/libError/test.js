var expect = require('expect');
var errorLib = require('./index.js');

describe('libError', function() {
    it('handleError handles an error with object input', function(done) {
        errorLib.handleError({
            message: 'TEST ERROR',
            details: {
                session: { id : 'foobar'},
                data: { foo : 'bar'}
            }
        }, function(err) {
            expect(err).toEqual('TEST ERROR');
            done();
        });
    });

    it('handleError handles an error with string input (legacy mode)', function(done) {
        errorLib.handleError('STRING_ERROR_' + Array(100).join('x'), function(err) {
            expect(err).toMatch(/STRING_ERROR_x*/);
            done();
        });
     });
    it('can be muted', function(done) {
        errorLib.init({
            muteErrorRegex: /MUTE_ME/
        });
        errorLib.handleError('some error MUTE_ME this time', function(err) {
            done(); 
        });
    })
});