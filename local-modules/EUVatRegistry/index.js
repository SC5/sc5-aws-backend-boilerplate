var Promise = require('bluebird');
var request = require('request');
var DOM = require('xmldom').DOMParser;
var xpath = require('xpath');
var config;

// jshint multistr:true
var soapReqTpl = '<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\" xmlns:urn=\"urn:ec.europa.eu:taxud:vies:services:checkVat:types\"><soapenv:Header/> \
<soapenv:Body> \
 <urn:checkVat> \
  <urn:countryCode>##COUNTRYCODE##</urn:countryCode> \
  <urn:vatNumber>##VATNUMBER##</urn:vatNumber> \
 </urn:checkVat> \
</soapenv:Body> \
</soapenv:Envelope>';

var endpointURL = 'http://ec.europa.eu/taxation_customs/vies/services/checkVatService';

function lookupCompany(countryCode, vatNumber) {
    return new Promise(function(response, reject) {
        var soapReq = soapReqTpl.replace('##COUNTRYCODE##', countryCode).replace('##VATNUMBER##', vatNumber);

        var soapheaders = {
            'Content-length': soapReq.length,
            'Content-Type': 'application/soap+xml; charset=utf-8'
        };  

        request.post({ url: endpointURL,
                       headers: soapheaders,
                       body: soapReq }, function(err, resp, body) {
            if (err) {
                return reject(err);
            }
            
            // Simplify things by scrapping NS stuff
            body = body.replace(/xmlns[^ >]*/g, '');
            var doc = new DOM().parseFromString(body);
            var keys = ['countryCode', 'vatNumber', 'name', 'address', 'valid'];
            var company = {};
            
            keys.forEach(function(key) {
                company[key] = xpath.select('//' + key + '/text()', doc).toString();
            });

            if (company.valid === 'true') {
                company.responseDate = new Date();
                return response(company);
            }
            var errorCode = xpath.select('//faultcode/text()', doc).toString();
            var error = xpath.select('//faultstring/text()', doc).toString();
            
            reject('COMPANY_NOT_FOUND : ' + error + ' (' + errorCode + ')');
        });
    });
}

module.exports = exports = {
    lookupCompany: lookupCompany
};
