var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var chug = require('gulp-chug');
var runSequence = require('run-sequence');
var del = require('del');
var awspublish = require('gulp-awspublish');
var file = require('gulp-file');
var pkg = require('./package.json');
var config = pkg.config || {};
var fs = require('fs');
var Promise = require('bluebird');
var cloudLookup = require('aws-cloudformation-lookup');
var AWS = require('aws-sdk');
if (typeof AWS.config.region !== 'string') {
    console.error('No region found, defaulting to eu-west-1');
    AWS.config.update({ region: 'eu-west-1' }); 
}
var region = AWS.config.region;
var cloudFormation = new AWS.CloudFormation();

var buildTemp = 'build/';
var apiGatewayDir = 'api-gateway/';

var stackName = process.env.STACK_NAME || 'dev';
var swaggerTemplateFile = 'swaggerApiTpl_' + pkg.name + '.json';
var swaggerFile = 'swaggerApi_' + pkg.name.replace(' ', '') + '_' + stackName + '_' + pkg.version + '.json';
var cloudFormationFile = 'cloudformationTpl_' + pkg.name + '_' + pkg.version + '.json';
var pkgConfig = pkg.config || {};

function updateStack(stackName, stackFile, callback) {
    fs.readFile(stackFile, 'utf8', function(err, template) {
        if (err) {
            return callback(err);
        }

        cloudFormation.describeStacks({
            StackName: stackName
        } , function(err, data) {
            //Verify whether there is a stack corresponding
            var params = {
                StackName: stackName, 
                Capabilities: [
                    'CAPABILITY_IAM',
                ],
                OnFailure: 'ROLLBACK',
                TemplateBody: template,
                TimeoutInMinutes: 60
            };

            return;
            if (data) {
                // stack exists
                cloudFormation.updateStack(params, callback)
            } else {
                cloudFormation.createStack(params, callback)
            }
        });
    });
}

function listResourceFiles(path) {
    return new Promise(function(response, error) {
        fs.readdir(path, function(err, files) {
            if (err) {
                return error(err);
            };
            var resourceFiles = [];
            files.forEach( function(file,idx) {
                if (file.match(/cloudformationResource_.*.json/)) {
                    resourceFiles.push(path + file);
                }
            });
            response(resourceFiles);
        });
    });
}

function listSwaggerFiles(path) {
    return new Promise(function(response, error) {
        fs.readdir(path, function(err, files) {
            if (err) {
                return error(err);
            };
            var resourceFiles = [];
            files.forEach( function(file,idx) {
                if (file.match(/swaggerResource_.*.json/)) {
                    resourceFiles.push(path + file);
                }
            });
            response(resourceFiles);
        });
    });
}

function loadResourceFiles(files) {
    return new Promise(function(response, error) {
        var fileloads = [];
        var resources = [];
        files.forEach( function(file, idx) {
            var resource = require('./' +file);

            resources.push(resource);
        });
        response(resources);
    });
}

function corsifyResponseDef(response) {
    if (response.hasOwnProperty('headers')) {
        response.headers['Access-Control-Allow-Origin'] = {
            type: "string"
        }
    }
    return response;
}

function injectSwaggerMethodDef(method, role) {
    for (var response in method.responses) {
        method.responses[response] = corsifyResponseDef(method.responses[response]); 
    } 

    for (var response in method['x-amazon-apigateway-integration'].responses) {
        method['x-amazon-apigateway-integration'].responses[response].responseParameters = {
            'method.response.header.Access-Control-Allow-Origin' : '\'*\''
        }
    }
    if (role) {
        method['x-amazon-apigateway-integration'].credentials = role.Arn;
    }

    return method; 
}

function injectSwaggerPath(path, role) {
    var methods = [];
    for (var method in path) {
        methods.push(method.toUpperCase());
        path[method] = injectSwaggerMethodDef(path[method], role);           
    }

    path.options = {
        summary: 'CORS Support',
        tags: ['CORS'],
        responses: {
            200: {
                description: 'CORS Headers',
                headers: {
                    'Access-Control-Allow-Headers': {
                        type: 'string'
                    },
                    'Access-Control-Allow-Methods': {
                        type: 'string'
                    },
                    'Access-Control-Allow-Origin': {
                        type: 'string'
                    }
                }
            }
        },
        'x-amazon-apigateway-integration': {
            type: 'mock',
            requestTemplates : {
                'application/json' : '{"statusCode": 200}'
            },
            responses: {
                default: {
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Headers': '\'Content-Type,X-Amz-Date,Authorization,X-Api-Key\'',
                        'method.response.header.Access-Control-Allow-Methods': '\'OPTIONS,' + methods.join(',') + '\'',
                        'method.response.header.Access-Control-Allow-Origin': '\'*\''
                    }
                }
            }
        }
    };

    return path;
}

function injectSwagger(mapping, roleArn) {
    for (var path in mapping.paths) {
        mapping.paths[path] = injectSwaggerPath(mapping.paths[path], roleArn)
    };

    return(mapping);
}

function parseSwaggerFile(mapping) {
    return new Promise(function(success, fail) {
        var fs= require('fs');
        fs.readFile(buildTemp + swaggerTemplateFile, 'utf8', function(err,template) {
            if(err) {
                return fail(err);
            }
            var resources = Object.keys(mapping);

            resources.forEach(function(key, idx) {
                var replKey = '{STACK:' + key + ':Arn}';
                while (template.indexOf(replKey) > 0) {
                    template = template.replace(replKey, mapping[key].Arn);
                }
            });
            var swaggerConfig = JSON.parse(template);
            swaggerConfig.info.title = stackName + '-' + pkg.name;
            swaggerConfig.info.description = pkg.description;
            swaggerConfig.info.version = pkg.version;

            var roleName = pkgConfig.apiGatewayRole;
            var roleArn = mapping[roleName];

            success(injectSwagger(swaggerConfig, roleArn));
        });
    });
};

gulp.task('doc', function() {
    return $.apidoc.exec({
        src: 'lambda-functions',
        dest: 'doc/',
        includeFilters: ['src/index.js']
    });
});

/* JSCS linting */
gulp.task('jscs', function() {
    return gulp.src(['*.js', 'lambda-functions/**/*.js', 'tests/**/*.js', '!**/node_modules/**/*'])
        .pipe($.jscs('.jscsrc'));
});

/* JSHint style checking */
gulp.task('jshint', function() {
    return gulp.src(['*.js', 'lambda-functions/**/*.js', 'tests/**/*.js', '!**/node_modules/**/*'])
        .pipe($.jshint())
        .pipe($.jshint.reporter('default'));
});

gulp.task('testapi', function() {
    $.util.log('Running tests (mocha)');

    return gulp.src(['tests/test_*.js'])
        .pipe($.mocha());
});

gulp.task('cleandist', function() {
    return del('dist');
});

gulp.task('cleanbuild', function() {
    return del(buildTemp);
});

gulp.task('buildLambda', function() {
    process.env['BUILD_DEST'] = process.cwd() + '/' + buildTemp;
    return gulp.src('lambda-functions/*/gulpfile.js', { read: false })
        .pipe(chug({ 
            tasks: ['build']
        }));
});


gulp.task('copyResources', function() {
    return gulp.src('resources/cloudformationResource_*.json')
        .pipe(gulp.dest(buildTemp));

});

gulp.task('buildCloudformation', function() {
    var cloudFormationTpl = {
        'AWSTemplateFormatVersion' : '2010-09-09',
        'Description' : pkg.Description,
        'Resources' : {},
        'Outputs' : {}
    };

    listResourceFiles(buildTemp)
    .then(loadResourceFiles)
    .then(function(resources) {
        resources.forEach(function(resource, idx) {
            var key = resource.Key.replace(/[^a-zA-z0-9]/g,'');
            delete resource.Key;
            cloudFormationTpl.Resources[key] = resource;
            cloudFormationTpl.Outputs[key] = {
                "Description": "Physical ID for '" + key + "'",
                "Value": {
                    "Ref" : key
                }
            }
        })
        return file(cloudFormationFile, 
            JSON.stringify(cloudFormationTpl, null, '  '))
            .pipe(gulp.dest('dist/'));
    });    
});

gulp.task('swaggerPreCompile', function() {
    var swaggerTemplate = require('./api-gateway/swagger_template.json');

    listSwaggerFiles(apiGatewayDir)
    .then(loadResourceFiles)
    .then(function(resources) {
        resources.forEach(function(resource, idx) {
            var paths = Object.keys(resource.paths) || [];
            paths.forEach(function(path, idx) {
                swaggerTemplate.paths[path] = resource.paths[path];
            });
            var definitions = Object.keys(resource.definitions) || [];
            definitions.forEach(function(key, idx) {
                swaggerTemplate.definitions[key] = resource.definitions[key];
            });
        });
        return file(swaggerTemplateFile, 
            JSON.stringify(swaggerTemplate, null, '  '))
            .pipe(gulp.dest(buildTemp));
    });    
});

gulp.task('swaggerPostCompile', function() {
    cloudLookup.loadStack(stackName, function(err, resources) {
        parseSwaggerFile(resources)
        .then(function(contents) {
            return file(swaggerFile, 
                JSON.stringify(contents, null, 2))
                .pipe(gulp.dest('dist'));
        });
    });
});


gulp.task('buildSwaggerFile', function() {
    console.log('Build ' + swaggerFile)
    return runSequence(['swaggerPreCompile', 'swaggerPostCompile']);  
});

gulp.task('copyLambdaZips', function() {
    return gulp.src(buildTemp + '*.zip')
        .pipe(gulp.dest('dist'));
})

gulp.task('checkStack', function() {
    cloudFormation.describeStacks({
        StackName: stackName
    } , function(err, data) {
        if (err) {
            console.error(err);
            return;
        }
        console.log(JSON.stringify(data, null, 2));
    });
});

gulp.task('updateStack', function() {
    var templateFile = 'dist/' + cloudFormationFile;
    updateStack(stackName, templateFile, function(err, data) {
        if (err) {
            console.error(err);
            return;
        }
        console.log(data);
    });
});

gulp.task('deployStack', function() {
    return runSequence(['upload', 'updateStack']);
});

gulp.task('upload', function() {
  if (! config.bucket) {
    $.util.log('ERROR: Bucket not defined')
    return;
  }
  
  var bucket = process.env.RESOURCE_BUCKET;
  if (! bucket) {
    bucket = config.bucket;
  }
  
  $.util.log('Upload to bucket ' + bucket);
  var publisher = awspublish.create({
    params: {
      Bucket: bucket
    }
  });
  var headers = {};

  gulp.src(['dist/*.zip', 'dist/cloudformationTpl_*.json'])
    .pipe(publisher.publish(headers))
    .pipe(publisher.cache())
    .pipe(awspublish.reporter());
});

gulp.task('build', function() {
    if (!process.env.RESOURCE_BUCKET) {
        return $.util.log("RESOURCE_BUCKET not set. Cannot build.")
    }
    return runSequence('cleandist', 'cleanbuild', 'buildLambda', 'copyResources', 'copyLambdaZips', 'buildCloudformation');
});

gulp.task('build-prod', function() {
    process.env['NODE_ENVIRONMENT'] = 'prod';

    return runSequence('build');
});

gulp.task('build-dev', function() {
    process.env['NODE_ENVIRONMENT'] = 'dev';

    return runSequence('build');
});

gulp.task('build-test', function() {
    process.env['NODE_ENVIRONMENT'] = 'test';

    return runSequence('build');
});

gulp.task('test', function() {
    gulp.src('lambda-functions/*/gulpfile.js', { read: false })
        .pipe(chug({ tasks: ['test'] }));
});

gulp.task('lint', ['jscs', 'jshint']);
