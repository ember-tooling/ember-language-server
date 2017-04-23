const lint = require('mocha-tslint');

lint('./tslint.json', ['src', 'test']);
