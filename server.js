'use strict';

var express = require( 'express' );
var bodyParser = require( 'body-parser' );
var cookieParser = require( 'cookie-parser' );
var session = require( 'express-session' );
var request = require( 'request' );
var moment = require( 'moment' );
// we'll ignore the next line in hinting as there is no redefinition
var certUtils = require('./lib/certificate');
var hosts = require( './lib/hosts' );
var shared = require( './shared' );
var env = shared.env;

// setup app
var app = express();
app.set( 'views', __dirname + '/views' );
app.set( 'view engine', 'ejs' );
app.use( express.static( __dirname + '/public' ) );
app.use( bodyParser.json() );
app.use( bodyParser.urlencoded() );
app.use( cookieParser() );
app.use( session( { secret: env.get( 'session_secret' ) } ) );

// persona setup
require( 'express-persona' )( app, {
  audience: env.get( 'persona_audience' )
});

// quick healtcheck
app.get( '/healthcheck', function( req, res ) {
  res.json({
    version: require( './package' ).version,
    http: 'okay'
  });
});

// login route
app.get( '/login', function( req, res ) {
  res.render( 'login', { title: 'Login pl0x' } );
});

// enforce persona login for all protected routes
app.all( '*', function( req, res, next ) {
  // enforce login
  if( !req.session.email ) {
    return res.redirect( '/login?redirect=' + req.url );
  }

  // enforce mofo email
  if( !/@mozillafoundation\.org$/.test( req.session.email ) ) {
    return res.redirect( '/login?mofo=false&redirect=' + req.url );
  }

  // these are not the droids you're looking for...
  return next();
});

// listing of certificate candidates
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

      // go through and check if event would have started yet (only show those that have)
      data.forEach( function( event, idx ) {
        if( moment( event.beginDate ) <=  moment() ) {
          // easier to add human date here for user display
          event.humanDate = moment( event.beginDate ).format( 'YYYY-MM-DD' );
          // also store flag if a cert has been generated for this user before
          event.organiserHasCert = hosts.isStored( event.organizerId );
          event.link = env.get( 'events_app' ) + '/#!/events/' + event.id;
          events.push( event );
        }
      });

      res.render( 'list', {
        title: 'Candidates',
        events: events
      });
    }
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

  // we've now generated a cert for the user, lets remember this
  hosts.add( req.body.recipientUsername );

  // check if format requested is svg, if so return it now
  if( req.body.outputFormat === 'svg' ) {
    res.set( 'Content-Type', 'image/svg+xml' );
    return res.send( svgCert );
  }

  // pdf/png requested so lets convert and send back
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
});
