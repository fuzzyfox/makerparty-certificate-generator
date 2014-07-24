module.exports = function( grunt ) {
  'use strict';

  grunt.initConfig({
    pkg: grunt.file.readJSON( 'package.json' ),

    // hint the JS
    jshint: {
      options: {
        'globals': {
          'module': false,
          'angular': false,
          'console': false,
          'google': false,
          'WebmakerAuthClient': false
        },
        'bitwise': true,
        'browser': true,
        'curly': true,
        'eqeqeq': true,
        'freeze': true,
        'immed': true,
        'indent': 2,
        'latedef': true,
        'node': true,
        'newcap': true,
        'noempty': true,
        'quotmark': 'single',
        'trailing': true,
        'undef': true,
        'unused': 'vars'
      },
      files: [
        'Gruntfile.js',
        '*.js',
        'bin/*.js',
        'lib/*.js'
      ]
    },

    // run local dev server
    express: {
      dev: {
        options: {
          script: './server.js',
          args: [ '--debug' ],
          port: 4224
        }
      }
    },

    // bump version numbers
    bump: {
      options: {
        files: [ 'package.json', 'bower.json' ],
        commitMessage: 'version bump to v%VERSION%',
        push: false
      }
    },

    // validate svg files
    validation: {
      options: {
        // always run all svg file tests
        reset: true,
        // we don't 100% need the xml content type for our SVGs
        relaxerror: [ 'Non-XML Content-Type: .' ],
        // fail the task if other errors found
        failhard: true,
        // prevent report file generation
        reportpath: false
      },
      files: {
        src: [ 'assets/issuers/*.svg' ]
      }
    },

    // running `grunt watch` will watch for changes
    watch: {
      files: [ '*.js', '*/**.js' ],
      tasks: [ 'jshint', 'express:dev' ],
      express: {
        files: [ '*.js', '*/**.js' ],
        tasks:  [ 'express:dev' ],
        options: {
          spawn: false
        }
      }
    }
  });

  // load tasks
  grunt.loadNpmTasks( 'grunt-contrib-jshint' );
  grunt.loadNpmTasks( 'grunt-express-server' );
  grunt.loadNpmTasks( 'grunt-contrib-watch' );
  grunt.loadNpmTasks( 'grunt-html-validation' );
  grunt.loadNpmTasks( 'grunt-bump' );

  // register tasks
  grunt.registerTask( 'default', [ 'jshint', 'express:dev', 'watch' ] );
  grunt.registerTask( 'test', [ 'jshint', 'validation' ] );
};
