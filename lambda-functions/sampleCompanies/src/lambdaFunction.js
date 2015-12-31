var euvat = require('EUVatRegistry');

function handleRequest(event, callback) {
   var businessID = event.businessID;
   var countryCode = event.countryCode;
   
   if ((countryCode === null) || (countryCode === '')) {
       return callback('COUNTRYCODE_MISSING');
   }
   
   if ((businessID === null) || (businessID === '')) {
       return callback('BUSINESSID_MISSING');
   }
   
   console.log('Lookup : ' + countryCode + businessID);
   euvat.lookupCompany(countryCode, businessID)
   .then(function(company) {
       callback(null, company)
   }, function(error) {
       callback(error);
   });
}

module.exports = exports = {
    handleRequest: handleRequest 
};
