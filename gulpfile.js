var gulp   = require('gulp'),
    uglify = require('gulp-uglify'),
    concat = require('gulp-concat'),
    less   = require('gulp-less'),
    minify = require('gulp-minify-css'),
    prefix = require('gulp-autoprefixer'),
    path   = require('path'),
    minJs  = 'main.min.js',
    minCss = 'main.min.css';

gulp.task('scripts', function() {
    var browserify = require('gulp-browserify');
    // Minify and concatenate all JavaScript files (except vendor scripts)
    return gulp
        .src(['./client/js/**/*.js', '!client/js/vendor/**'])
        .pipe(concat(minJs))
        .pipe(browserify({
        // debug inserts source mapping which makes the file twice as large
          //debug : !gulp.env.production
        }))
        //.pipe(uglify())
        .pipe(gulp.dest('./public/js'));
});

gulp.task('rpc-client', function() {
    var rename = require('gulp-rename');
    var browserify = require('gulp-browserify');
    //var client = require('oskari-rpc');

    // Single entry point to browserify 
    gulp.src('./public/js/rpc/rpc-client.js')
        .pipe(browserify({
        // debug inserts source mapping which makes the file twice as large
          //debug : !gulp.env.production
        }))
        .pipe(rename('rpc-client.min.js'))
        .pipe(gulp.dest('./public/js/rpc'))
});

gulp.task('stylesheets', function() {
    return gulp
        .src('./client/stylesheets/**/*.less')
        .pipe(less({
            paths: [path.join(__dirname, 'less', 'includes')]
        }))
        .pipe(concat(minCss))
        .pipe(minify())
        .pipe(prefix('last 2 versions', '> 1%', 'ie 8'))
        .pipe(gulp.dest('./public/css'));
});

gulp.task('livereload', function() {
    var lr     = require('gulp-livereload');
    var server = lr();
    gulp.watch([
        './public/**', './md/**', './views/**'
    ], function(file) {
        server.changed(file.path);
    });
});

// Rerun the task when a file changes
gulp.task('watch', function() {
    gulp.watch('./client/stylesheets/**', function(event) {
        console.log('File ' + event.path + ' was ' + event.type);
        gulp.run('stylesheets');
    });
    gulp.watch('./client/js/**', function(event) {
        console.log('File ' + event.path + ' was ' + event.type);
        gulp.run('scripts');
    });
});

// -------------- API GENERATOR -----------------------------------
var apiStructGenerator = require('./lib/gulp-oskariapi-structure');
var apiGenerator       = require('./lib/gulp-oskariapi');
var galleryStructGenerator = require('./lib/gulp-gallery-structure');
var galleryGenerator       = require('./lib/gulp-gallery');

/**
 * Returns the version for Oskari API
 * @return {String} version as string
 */
function getApiVersion() {
    var args = process.argv.slice(3);
    var version = 'latest';
    if(args.length) {
        version = args[0].substring(1);
    }
    return version;
}

function getOskariLocation() {
    return '../oskari-frontend/api/**';
}

function getApiDocLocation(version) {
    return 'generated/api/' + (version || getApiVersion());
}
function getJsDocLocation() {
    return 'generated/jsdoc/' + getApiVersion();
}
function getJsDocConfigLocation() {
    return 'jsdoc';
}
function getGalleryLocation() {
    return 'generated/gallery/';
}
function clearDir (directory, callback) {
    var rimraf = require("rimraf");
    rimraf(directory, callback);
}
function generateJsDocs (configPath, destination) {
    console.log(`Generating jsDoc to ${destination}`);
    var exec = require('child_process').exec;
    exec(`jsdoc -c ${configPath} -d ${destination}`, function (err, stdout, stderr) {
        if (stdout) {
            console.log(stdout);
        }
        if (stderr) {
            console.log(stderr);
        }
        console.log(`${configPath} processed`);
    });
}

gulp.task('oskari-api-struct', function(done) {
    console.log('oskari-api-struct creates api.json in ' + getApiDocLocation());

    var destPath = getApiDocLocation();
    var del = require('del');
    del([destPath]).then(function() {
        gulp.src(getOskariLocation())
            .pipe(apiStructGenerator())
            .pipe(gulp.dest(destPath))
            .on('end', function() {
                console.log('struct api done');
                done();
            });
    });
});

gulp.task('oskari-api', ['oskari-api-struct'], function() {
    console.log('oskari-api');

    // Clean the destPath
    var destPath = getApiDocLocation();
    var fs = require('fs');
    var index = JSON.parse(fs.readFileSync(destPath + '/api.json'));
    console.log('Creating documentation based on:', index);
    // create the docs and provide the index
    gulp.src(getOskariLocation())
        .pipe(apiGenerator(getApiVersion(), index))
        .pipe(gulp.dest(destPath));
    console.log('api done');

    console.log('Starting a child process to generate js docs.');
    var path = require('path');
    var jsDocConfigLocation = getJsDocConfigLocation();
    fs.readdir(jsDocConfigLocation, function (err, files) {
        if (err) {
            console.log(err);
            return;
        }
        files.forEach(function (file) {
            if (['.js', '.json'].indexOf(path.extname(file)) === -1) {
                console.log(`Filtered out jsdoc config ${file}. Only js and json config files are accepted.`);
                return;
            }
            var configPath = path.join(jsDocConfigLocation, file);
            var destination = path.join(getJsDocLocation(), path.parse(file).name);
            console.log(`Cleaning destination folder for ${configPath}.`);
            clearDir(destination, function (err) {
                if (err) {
                    return;
                }
                generateJsDocs(configPath, destination);
            });
        })
    });
});

gulp.task('oskari-gallery-struct', function(done) {
    console.log('oskari-gallery-struct creates gallery.json in ' + getGalleryLocation());

    var destPath = getGalleryLocation();
    var del = require('del');
    del([destPath]).then(function() {
        gulp.src('./community/gallery/*')
            .pipe(galleryStructGenerator())
            .pipe(gulp.dest(destPath))
            .on('end', function() {
                console.log('struct gallery done');
                done();
            });
    });
});

gulp.task('oskari-gallery', ['oskari-gallery-struct'], function() {
    console.log('oskari-gallery');

    var destPath = getGalleryLocation();
    var fs = require('fs');
    var index = JSON.parse(fs.readFileSync(destPath + '/gallery.json'));
    console.log('Creating gallery based on:', index);
    // create the docs and provide the index
    gulp.src('./community/gallery/*')
        .pipe(galleryGenerator(index))
        .pipe(gulp.dest(destPath));
    console.log('gallery done');
});

// The default task (called when you run `gulp` from cli)
gulp.task('default', ['scripts', 'stylesheets', 'livereload', 'watch']);
// The build task
gulp.task('build', ['scripts', 'stylesheets']);
