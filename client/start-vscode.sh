#!/usr/bin/env bash

npm run compile
code --extensionDevelopmentPath=$PWD ${1}
