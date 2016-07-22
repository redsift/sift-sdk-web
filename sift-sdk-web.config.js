'use strict';

var paths = {
  dest: './dist'
}

var defaultConfig = {
  formats: ['es', 'umd'],
  outputFolder: paths.dest,
  moduleNameJS: 'Redsift',
  mapsDest: '.',
  externalMappings: {}
}

var sdkConfig = {
  mainJS: {
    name: 'sift-sdk',
    indexFile: './src/sdk.js'
  }
};

var bundles = [
  merge(defaultConfig, sdkConfig)
];

module.exports = bundles;

function merge(obj1, obj2) {
  var newObj = JSON.parse(JSON.stringify(obj1));
  Object.keys(obj1).forEach(function(key) { newObj[key] = obj1[key]; });
  Object.keys(obj2).forEach(function(key) { newObj[key] = obj2[key]; });
  return newObj;
}
