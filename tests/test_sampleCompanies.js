var expect = require('expect');
var request = require('request-json');
var Promise = require('bluebird');
var env = process.env;

if (typeof env.APITEST_ENDPOINT === 'undefined') {
    console.log('APITEST_ENDPOINT not initialized in environment');
    process.exit(1);
}

var apiEndpoint = env.APITEST_ENDPOINT + 'companies/';
var client = request.createClient(apiEndpoint);

function getCompany(countryCode, vatNumber) {
    return new Promise(function(successCb, errorCb) {
        var reqPath  =  countryCode + '/' + vatNumber;
        console.log('GET ' + apiEndpoint + reqPath);

        client.get(reqPath, function(err, res, body) {
            if (err) {
                console.log('Error: ' + err);
                return errorCb(err);
            }

            successCb({ body: body, status: res.statusCode });
        });
    });
}

describe('/companies/', function() {
    this.timeout(10000);

    // This is how Slack sends email addresses
    it('Returns company (SC5) details based on VAT number + country code', function(done) {

        getCompany('FI', '20466502').then(function(response) {
            expect(response.body.name).toMatch(/SC5 Online Oy/);
            expect(response.body.address).toMatch(/.*HELSINKI.*/);
            expect(response.status).toEqual(200);
            done();
        })
        .then(null, function(error) {
            done(error);
        });
    });

    it('Returns state 404 if requested without country code', function(done) {
        getCompany('XX', '0000000').then(function(response) {
            expect(response.status).toEqual(404);
            done();
        })
        .then(null, function(error) {
            done(error);
        });
    });
});
