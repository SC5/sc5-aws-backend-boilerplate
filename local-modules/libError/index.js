/**
* HoN-lib-session:
* Library / module for managing HaapyOrNot webshop sessions
*/

var AWS = require('aws-sdk');

// Initialize AWS and DynamoDB (for session access)
if (typeof AWS.config.region !== 'string') {
    console.log('No region found, defaulting to eu-west-1');
    AWS.config.update({ region: 'eu-west-1' });
}
var sns = new AWS.SNS();
var arns = {};
var errorTopic = 'errorsTopic';

//Parameters for the error handler
//Errors should n
var muteErrorRegex = null;

function getTopicArn(topicName, callbackFn) {
    var stackName = process.env.STACK_NAME;

    if (! stackName) {
        return callbackFn('STACK_NAME not set');
    }

    if (arns[topicName]) {
        return callbackFn(arns.topicName);
    }
    var fullName = stackName + '-' + topicName;

    sns.listTopics('', function(err, data) {
        var arnRe = new RegExp('arn:.+:' + fullName);
        var match;

        for (var i in data.Topics) {
            var topic = data.Topics[i];

            match = topic.TopicArn.match(arnRe);

            if (match != null) {
                return callbackFn(null, topic.TopicArn);
            }
        };

        return callbackFn('TOPIC_NOT_FOUND:' + fullName);        
    });
}

function handleError(error, callbackFn) {
    if (typeof(error) === 'string') {
        var newError = { 
            message:error
        };
        error = newError;
    }

    if (error.message === null) {
        error.message = '';
    }

    if (! error.details) {
        error.details = {};
    }
    error.details.message = error.message;
 
    if (muteErrorRegex && (error.message.match(muteErrorRegex))) {
        console.log('Match mute rule ' + muteErrorRegex + ' - no notifications sent');
        return callbackFn(error.message);
    }

    if (process.env.MUTE_ERRORS) {
        console.log('MUTE_ERRORS set - no notifications sent.');
        return callbackFn(error.message);
    }

    console.log(['ERROR: ' + error.message + ' : ', JSON.stringify(error.details || {},  null, 2)].join('\n'));
    
    getTopicArn(errorTopic, function(err, topicArn) {
        if (err) {
            return callbackFn(['Failed to get err topic : ' + err,  ' Original error message: ' + error.message].join('\n'));
        }
        var snsNotif = {
            Message: JSON.stringify(error.details || {}).substring(0, 256000),
            TopicArn: topicArn
        };
        var subject = 'ERROR: ' + error.message;

        snsNotif.Subject = subject.substring(0, 80);

        sns.publish(snsNotif, function(err, data) {
            if (err) {
                return callbackFn(['Failed to send error notification : ' + err , ' Original error message: ' + error.message].join('\n'));
            }
            
            return callbackFn(error.message);
        });
    });
};

function init(params) {
    if (params.muteErrorRegex) {
        muteErrorRegex = params.muteErrorRegex;
    }
}

/**
* public methods:
*   handleError(error, callback)
*/

module.exports = exports = {
    handleError : handleError,
    init : init
};
