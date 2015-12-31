/**
* Wrapper for lambda function using lambda-server
*  Actual function logic in lambdaFunction.js
*/

var server = require('lambda-server');
var lambdaFunction = require('./lambdaFunction.js');
var libError = require('libError');

// Do not notify errors about companies not found
libError.init({
    muteErrorRegex: /COMPANY_NOT_FOUND/
});

var errorHandler = libError.handleError;

server.init({
    lambdaFunction: lambdaFunction, 
    errorHandler: errorHandler
});

module.exports = exports = {
    handler : server.handler
};
