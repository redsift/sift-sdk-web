var gulp = require('gulp');
var RSBundler = require('@redsift/redsift-bundler');

var bundleConfig = require('./sift-sdk-web.config.js');

gulp.task('bundle-js',  RSBundler.loadTask(gulp, 'bundle-js',  bundleConfig));

gulp.task('build', ['bundle-js'], function(cb) {
  console.log('\n* Bundling complete:\n');
  RSBundler.printBundleSummary(bundleConfig);
});

gulp.task('default', ['build']);
