var expect = require('expect');
var myMod = require('./index.js');
if (! process.env.STACK_NAME) {
    process.env['STACK_NAME'] = 'HoN';
}

describe('EUVatRegistry', function() {
    it('Finds information for SC5 Online (FI20466502)', function(done) {
        myMod.lookupCompany('FI', '20466502').then(function(company) {
            expect(company.name).toMatch(/SC5.*/);
            done();
        }, done);
    });
    
    it('Finds information for Amazon Luxembourgh (LU26375245)', function(done) {
        myMod.lookupCompany('LU', '26375245').then(function(company) {
            expect(company.name).toMatch(/AMAZON/);
            done();
        }, done);
    });
    
    it('Finds information for Dom Perignon (FR44509553459)', function(done) {
        myMod.lookupCompany('FR', '44509553459').then(function(company) {
            expect(company.name).toMatch(/SCS.*/);
            done();
        }, done);
    });
});