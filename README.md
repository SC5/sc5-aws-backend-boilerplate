# HappyOrNot webshop server

## Project structure
    
The project structure is the following:

    1. api-gateway/ : all API endpoint definitions (in swagger format)
    2. build/ : files produced during the build of the server
    3. dist/ : end products of builds (cloudFormation resources, swagger templates, lambda functions)
    4. gulpfile.js : the gulp file responsible for building the server components
    5. gulpfile_functions.js : the gulp file (master) to be used by lambda-functions (copied by setup.sh)
    6. lambda-functions/ : the lambda functions (see structure below)
    7. modules/ : shared local module libraries consumed by lambda-functions
    8. package.json : package definition for server (includes all devdepencencies of the lambda-functions)
    9. resources/ : cloudformation snippets of resources required by backend
    10. setup.sh : script for initializing the server development env
    11. tests/ : api endpoint tests

The lambda-functions directories have the following structure
    
    1. cloudformation_resource.json : the cloudformation snippet for the lambda-function (defines memory, etc...)
    2. gulpfile.js : the gulp file used to build / test / deploy the lambda-function (copy of gulpfile_functions.js) 
    3. lambdaenv.json : config file for lambda (defines the region)
    4. package.json : package definitions (put all dev dependencies into the server level file)
    5. src/ : module sources (index.js as entry point, actual function in lambdaFunction.js)
    6. tests/ : module tests

## Working with single lambda-functions
    
Lambda functions can be developed locally without interim deployments to AWS. Initialize your env first with the setup.sh script (server level).

### Testing single lambda functions locally

Lambda functions can be tested locally using 

    > gulp test

This runs all the tests that are defined in the tests/ directory

### Deploying single lambda functions

To deploy a single Lambda function, use

    > gulp deploy

This will lookup for functions that match the package name in the cloudformation stack defined by env variable $STACK_NAME.
If one is found, it will replace that function. Otherwise, it will create a new function with the name ${STACK_NAME}_{package name} 
(e.g. dev_lambdaFunction)   

## Building

### Prerequisites

    1. AWS Command Line Interface
    2. Node.js (v. 0.12)
    3. AWS credentials / config set up (e.g. aws configure)
    4. An S3 bucket in AWS 
    5. aws-api-import built & installed (from https://github.com/awslabs/aws-apigateway-importer)
    
### Development environment setup

 > npm run setup (runs npm install in current dir + lambda-functions directories)

### Building cloudformation stack

 > export STACK_NAME = your_stack_name (e.g. dev, test, prod)
 > export RESOURCES_BUCKET = your_bucket_name
 > npm run build

This will produce a cloudformation definition file

### Deploy resources

Upload the build resources into AWS

 > npm run upload
 
First deployment

 > npm run createStack (deploys to stack defined by $STACK_NAME)

Update of existing deployment

 > npm run updateStack

Note that this will give an error in case no updates are required

### Building and deploying the API

  > npm run buildAPI

Creates a swagger file to dist/.
Deploy the API (first time) with the command:

  > aws-api-import.sh -c  -p your_aws_profile --deploy v1 dist/swaggerApi_HappyOrNotWebshop_HoN_0.9.1.json

To update the API, run the following:

  > aws apigateway get-rest-apis --region eu-west-1 (this will give you the API id for the next command)
  > aws-api-import.sh -u api_id -p your_aws_profile --deploy v1 dist/swaggerApi__HappyOrNotWebshop_HoN_0.9.1.json

### Testing

To test all lambda-functions, run

   > npm run test

To test the api endpoints (from tests/), initialize APITEST_ENDPOINT environment variable to point to your api gateway endpoint address
and run the tests

    > export APITEST_ENDPOINT=https://{apiID}.execute-api.{region}.amazonaws.com/{stage}/
    > npm run testAPI

