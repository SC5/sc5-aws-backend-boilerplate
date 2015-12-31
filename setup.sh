#!/bin/bash

npm install
for func in $(ls lambda-functions | grep HoN)
do 
    pushd lambda-functions/$func
    npm install
    echo '{ "region": "eu-west-1" }' > lambdaenv.json
    cp ../../gulpfile_functions.js gulpfile.js
    popd
done
