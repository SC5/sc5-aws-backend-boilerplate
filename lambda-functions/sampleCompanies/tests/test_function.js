var expect = require('expect');
var lambda = require('lambda-wrapper');
var Promise = require('bluebird');
var testErrors = false; // continuous errors will revoke the service

var myMod = require('../src/index.js');
// Do not flood emails with notifications
process.env['MUTE_ERRORS'] = true;

lambda.init(myMod);

function getCompany(countryCode, businessID) {
    return new Promise(function(succeed, fail) {
        lambda.run({ 
            countryCode: countryCode, 
            businessID: businessID
        }, function(err, response) {
            if(err) {
                return fail(err);
            }
            succeed(response);
        });   
    });
};

describe('companies', function() {
    it('Returns company (SC5) details based on VAT number + country code', function(done) {
        this.timeout(10000);
        getCompany('LU', '26375245').then(function(response) {
            expect(response.name).toMatch(/AMAZON/);
            expect(response.address).toMatch(/.*LUXEMBOURG.*/);
            done();
        }, done);
    });

    it('Returns error (COUNTRYCODE_MISSING) if requested without country code', function(done) {
        this.timeout(2000);
        getCompany('', '20466502').then(function() {
            done('EXPECTED_ERROR');
        }, function(error) {
            expect(error).toMatch(/COUNTRYCODE_MISSING/);
            done();
        });
    });

    it('Returns error (BUSINESSID_MISSING) if requested without country code', function(done) {
        this.timeout(2000);
        getCompany('FI', '').then(function() {
            done('EXPECTED_ERROR');
        }, function(error) {
            expect(error).toMatch(/BUSINESSID_MISSING/);
            done();
        });
    });
    if (testErrors) {
        it('Returns error (COMPANY_NOT_FOUND) if company is not found', function(done) {
            this.timeout(15000);
            getCompany('XX', '0000000').then(function() {
                done('EXPECTED_ERROR');
            }, function(error) {
                expect(error).toMatch(/COMPANY_NOT_FOUND/);
                done();
            });
        });
    };
});
