'use strict';

var paths = {
  dest: './dist'
}

var defaultConfig = {
  formats: ['es6', 'umd'],
  outputFolder: paths.dest,
  moduleNameJS: 'Sift',
  mapsDest: '.',
  externalMappings: {},
  useNormalizeCSS: true
}

var siftBaseConfig = {
  mainJS: {
    name: 'sift-base',
    indexFile: './src/index.js'
  }
};

var siftBaseTestConfig = {
  mainJS: {
    name: 'sift-base-test',
    indexFile: './test/test-app.js'
  }
};

var bundles = [
  merge(defaultConfig, siftBaseConfig),
  merge(defaultConfig, siftBaseTestConfig)
];

module.exports = bundles;

function merge(obj1, obj2) {
  var newObj = JSON.parse(JSON.stringify(obj1));
  Object.keys(obj1).forEach(function(key) { newObj[key] = obj1[key]; });
  Object.keys(obj2).forEach(function(key) { newObj[key] = obj2[key]; });
  return newObj;
}
