// This file is copied to the lambda-functions using ./setup.sh
// Managed and versioned centrally

var del = require('del');
var gulp = require('gulp');
var $ = require('gulp-load-plugins')({
    config: '../../package.json'
});

var runSequence = require('run-sequence');
var gulpNSP = require('gulp-nsp');
var mocha = require('gulp-mocha');
var install = require('gulp-install');
var lambda = require('gulp-awslambda');
var zip    = require('gulp-zip');
var symlink = require('gulp-sym');
var file = require('gulp-file');
var cloudLookup = require('aws-cloudformation-lookup');
var lambdaenv = require('./lambdaenv.json');
var pkg = require('./package.json');
var cloudResource = require('./cloudformation_resource.json');

/* Configurations. Note that most of the configuration is stored in
the task context. These are mainly for repeating configuration items */
var destDir = process.env.BUILD_DEST || './dist/';
var stackName = process.env.STACK_NAME || '';
var pkgName = pkg.name.replace(/[^A-Za-z0-9_-]/g, '_');
var pkgVersion = pkg.version;

var buildName = [
    pkgName,
    pkgVersion,
].join('-');

var deployName = [
    stackName,
    pkgName
].join('-');

process.env['AWS_LAMBDA_FUNCTION_NAME'] = deployName;

/* Bump version number for package.json */
/* TODO Provide means for appending a patch id based on git commit id or md5 hash */
gulp.task('bump', function() {
    // Fetch whether we're bumping major, minor or patch; default to minor
    var env = $.util.env;
    var type = (env.major) ? 'major' : (env.patch) ? 'patch' : 'minor';

    gulp.src(['./package.json'])
        .pipe($.bump({ type: type }))
        .pipe(gulp.dest('./node_modules'));
});

gulp.task('copy-lint-configs', function() {
    return gulp.src(['../../.jshintrc', '../../.jscsrc'])
        .pipe(gulp.dest('./'));
});

/* JSCS linting */
gulp.task('jscs', function() {
    return gulp.src(['*.js', 'src/**/*.js', 'tests/*.js'])
            .pipe($.jscs('.jscsrc'));
});

/* JSHint style checking */
gulp.task('jshint', function() {
    return gulp.src(['*.js', 'src/**/*.js', 'tests/*.js'])
        .pipe($.jshint())
        .pipe($.jshint.reporter('default'));
});

gulp.task('lint', ['jscs', 'jshint']);

gulp.task('build-cleantmp', function() {
    return del('temp');
});

gulp.task('symlink-modules', function(callback) {
    return gulp.src('../../local-modules')
        .pipe(symlink('../local-modules', { force: true }));
});

gulp.task('build-copysrcfiles', function() {
    return gulp.src(['src/*.js'])
        .pipe(gulp.dest('temp'));
});

gulp.task('build-copynodemodules', function() {
    return gulp.src('./package.json')
        .pipe(gulp.dest('temp'))
        .pipe(install({production: true}));
});

gulp.task('build-ziptemp', function() {
    $.util.log("Build package " + buildName + ".zip to " + destDir );
    return gulp.src('temp/**/*')
        .pipe(zip(buildName + '.zip'))
        .pipe(gulp.dest(destDir));
});

gulp.task('buildzip', function(callback) {
    return runSequence('symlink-modules','build-copysrcfiles', 'build-copynodemodules', 'build-ziptemp', callback);
});

gulp.task('buildresource', function(callback) {
    cloudResource.Properties.Code.S3Key = buildName + '.zip';
    cloudResource.Properties.Code.S3Bucket = process.env.RESOURCE_BUCKET;
    cloudResource.Key = pkg.name;
    cloudResource.Properties.Description = pkg.description;
    
    return file('cloudformationResource_' + buildName + '.json', JSON.stringify(cloudResource, null, '  '), {src: true})
        .pipe(gulp.dest(destDir));
});

gulp.task('build', function(callback) {
    return runSequence('buildzip', 'buildresource','build-cleantmp', callback);
});

gulp.task('deployzip', function(callback) {
    cloudLookup.loadStack(stackName, function(err, stackResources) {
        var roleArn = lambdaenv.Role;
        var timeout = cloudResource.Properties.Timeout;

        if (stackResources[pkg.name]) {
            deployName = stackResources[pkg.name].PhysicalResourceId;
        }
        var roleName = cloudResource.Properties.Role['Fn::GetAtt'][0];
        if (stackResources[roleName]) {
            roleArn = stackResources[roleName].Arn;
        }
        var lambdaparams = {
            FunctionName: deployName,
            Description: pkg.description,
            Role: roleArn,
            Timeout: timeout
        };

        var lambdaoptions = {
            region: lambdaenv.region
        };
        $.util.log("Deploy to Lambda function " + deployName + " [" + lambdaoptions.region + "]");

        gulp.src(destDir + buildName + '.zip')
            .pipe(lambda(lambdaparams, lambdaoptions)) 
            .on('end', function() { callback() });      
    }) 
});

gulp.task('deploy', function(callback) {
    if ((stackName.length === 0) && (functionName.length === 0)) {
        $.util.log('STACK_NAME not defined');
        return;
    }
    delete process.env.STACK_NAME;

    return runSequence(
        'symlink-modules',
        'build-copysrcfiles',
        'build-copynodemodules',
        'build-ziptemp',
        'deployzip',
        'build-cleantmp',       
        callback
    );
});

gulp.task('test-run', function() {
    if (stackName.length === 0) {
        $.util.log('STACK_NAME not defined');
        return null;
    }
    process.env['VERBOSE'] = true;
    process.env['NODE_ENV'] = 'test';

    $.util.log('Running tests (mocha) for ' + process.env.AWS_LAMBDA_FUNCTION_NAME);
    gulp.src(['tests/test*.js'])
        .pipe(mocha());
});

//To check your package.json
gulp.task('test-nsp', function(cb) {
    gulpNSP({
        package: __dirname + '/package.json'
    }, cb);
});

gulp.task('clean', function(cb) {
    return del([
        'dist',

        // here we use a globbing pattern to match everything inside the `mobile` folder
        'temp'
    ], cb);
});

// NOTE: Running also build to avoid running against old code
gulp.task('test', function() {
    return runSequence('check', 'test-nsp');
});

// NOTE: Running also build to avoid running against old code
gulp.task('check', function() {
    return runSequence('test-run');
});

gulp.task('default', ['build', 'test']);
