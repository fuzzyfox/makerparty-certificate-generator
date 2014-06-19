'use strict';

var Habitat = require( 'habitat' );
var express = require( 'express' );
var bodyParser = require( 'body-parser' );
var request = require( 'request' );
var moment = require( 'moment' );

// we'll ignore the next line in hinting as there is no redefinition
var open = require( 'open' ); // jshint ignore:line

var certUtils = require('./lib/certificate');

// get configs
var env = new Habitat();
Habitat.load();

// setup app
var app = express();
app.set( 'views', __dirname + '/views' );
app.set( 'view engine', 'ejs' );
app.use( bodyParser.urlencoded() );
app.use( bodyParser.json() );

// quick healtcheck
app.get( '/healthcheck', function( req, res ) {
  res.json({
    version: require( './package' ).version,
    http: 'okay'
  });
});

app.get( '/', function( req, res) {
  // list completed events
  request.get({
    uri: env.get( 'events_platform' ) + '/events',
    qs: {
      after: env.get( 'events_after' ),
      before: env.get( 'events_before' )
    }
  }, function( err, response, body ) {
    if( !err && response.statusCode === 200 ) {
      var data = JSON.parse( body );

      var events = [];

      data.forEach( function( event, idx ) {
        if( moment( event.beginDate ) <=  moment() ) {
          event.humanDate = moment( event.beginDate ).format( 'YYYY-MM-DD' );
          events.push( event );
        }
      });

      res.render( 'list', {
        title: 'Candidates',
        events: events
      });
    }
    console.log( err );
  });
});

app.get( '/generate', function( req, res ) {
  res.render( 'form', {
    title: 'Generate Certificate',
    query: req.query
  });
});

app.post( '/generate', function( req, res ) {
  // prevent caching
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });

  // generate svg certificate
  var svgCert = certUtils.generate({
    recipient: req.body.recipient,
    issuer: req.body.issuerName,
    issuerRole: req.body.issuerRole
  });

  if( req.body.outputFormat === 'svg' ) {
    res.set( 'Content-Type', 'image/svg+xml' );
    return res.send( svgCert );
  }

  certUtils.remoteConvert( svgCert, req.body.outputFormat, env.get( 'svable_key' ), function( err, convertedCert ) {
    if( req.body.outputFormat === 'png' ) {
      res.set( 'Content-Type', 'image/png' );
    }
    else {
      res.set( 'Content-Type', 'application/pdf' );
    }
    res.send( convertedCert );
  });
});

var server = app.listen( env.get( 'port' ) || 3000, function() {
  console.log( 'Now listening on %d', server.address().port );
  if( env.get( 'open_on_startup' ) ) {
    open( 'http://' + server.address().address + ':' + server.address().port );
  }
});
