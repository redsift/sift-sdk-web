'use strict';

var paths = {
  dest: './dist'
}

var defaultConfig = {
  formats: ['es6', 'umd'],
  outputFolder: paths.dest,
  moduleNameJS: 'Redsift',
  mapsDest: '.',
  externalMappings: {},
  useNormalizeCSS: true
}

var sdkConfig = {
  mainJS: {
    name: 'sift-sdk-web',
    indexFile: './src/index.js'
  }
};

var testConfig = {
  mainJS: {
    name: 'sift-sdk-web-test',
    indexFile: './test/test-app.js'
  }
};

var bundles = [
  merge(defaultConfig, sdkConfig),
  merge(defaultConfig, testConfig)
];

module.exports = bundles;

function merge(obj1, obj2) {
  var newObj = JSON.parse(JSON.stringify(obj1));
  Object.keys(obj1).forEach(function(key) { newObj[key] = obj1[key]; });
  Object.keys(obj2).forEach(function(key) { newObj[key] = obj2[key]; });
  return newObj;
}
