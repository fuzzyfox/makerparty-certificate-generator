'use strict';

var express = require( 'express' );
var shared = require( './shared' );
var env = shared.env;
var bodyParser = require( 'body-parser' );
var cookieParser = require( 'cookie-parser' );
var session = require( 'express-session' );
var request = require( 'request' );
var moment = require( 'moment' );
var helmet = require( 'helmet' );
var certUtils = require('node-mp-cert-generator');
var nunjucks = require( 'nunjucks' );
var fs = require( 'fs' );
var hosts = require( './lib/hosts' );
var candidates = require( './lib/candidates' );

// setup app
var app = express();
app.disable( 'x-powered-by' );
app.use( express.static( __dirname + '/public' ) );
app.set( 'views', __dirname + '/views' );
app.set( 'view engine', 'ejs' );
app.use( express.static( __dirname + '/public' ) );
app.use( bodyParser.json() );
app.use( bodyParser.urlencoded() );
app.use( cookieParser() );
app.use( session( { secret: env.get( 'session_secret' ) } ) );
app.use( helmet.xssFilter() );
app.use( helmet.nosniff() );
app.use( helmet.xframe( 'sameorigin' ) );

// force ssl ?
if( env.get( 'force_ssl' ) ) {
  app.enable( 'trust proxy' );
  // force https
  app.use( require('express-enforces-ssl')() );
  app.use( helmet.hsts() );
}

// start scheduling auto generation
require( './lib/autogenerate' )( candidates, hosts );
// initial fetch of candidates
candidates.forceUpdate();

// persona setup
require( 'express-persona' )( app, {
  audience: env.get( 'persona_audience' )
});

// setup nunjucks
var nunjucksEnv = nunjucks.configure( 'views', {
  autoescape: true
});

// add nunjucks to res.render
nunjucksEnv.express( app );

// quick healtcheck
app.get( '/healthcheck', function( req, res ) {
  res.json({
    version: require( './package' ).version,
    http: 'okay'
  });
});

app.get( '/:username.:format', function( req, res ) {
  if( ! hosts.isStored( req.params.username ) || ! /^(png|pdf)$/i.test( req.params.format ) ) {
    return res.status( 404 ).send( req.url + ' not found' );
  }

  var host = hosts.getById( req.params.username );

  // set issuer
  var issuer = __dirname + '/assets/issuers/amira.svg'; // default issuer
  if( fs.existsSync( __dirname + '/assets/issuers/' + host.issuer + '.svg' ) ) {
    issuer = __dirname + '/assets/issuers/' + host.issuer + '.svg';
  }

  var svgCert = certUtils.render( req.params.username, issuer, host.issueDate );

  // pdf/png requested so lets convert and send back
  certUtils.convert( svgCert, req.params.format, env.get( 'svable_key' ), function( convertedCert ) {
    if( req.params.format === 'png' ) {
      res.set( 'Content-Type', 'image/png' );
    }
    else {
      res.set( 'Content-Type', 'application/pdf' );
    }
    res.send( convertedCert );
  });
});

// landing page route
app.get( '/', function( req, res ) {
  res.render( 'landing.html', { title: 'Ooops!'} );
});

// login route
app.get( '/login', function( req, res ) {
  res.render( 'login.html', { title: 'Login pl0x' } );
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
app.get( '/list', function( req, res) {
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
      // also check that the event organizer is in the list of candidates
      data.forEach( function( event, idx ) {
        if( candidates.get().indexOf( event.organizerId ) === -1 ) {
          return;
        }

        if( moment( event.beginDate ) <=  moment() ) {
          // easier to add human date here for user display
          event.humanDate = moment( event.beginDate ).format( 'YYYY-MM-DD' );
          // also store flag if a cert has been generated for this user before
          event.organiserHasCert = hosts.isStored( event.organizerId );
          event.link = env.get( 'events_app' ) + '/#!/events/' + event.id;
          events.push( event );
        }
      });

      res.render( 'list.html', {
        title: 'Candidates',
        events: events
      });
    }
    else {
      res.status( 500 ).send( 'Error: could not get events' );
    }
  });
});

app.get( '/generate', function( req, res ) {
  res.render( 'manual-generate.html', {
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

  // set issuer
  var issuer = __dirname + '/assets/issuers/amira.svg'; // default issuer
  if( fs.existsSync( __dirname + '/assets/issuers/' + req.body.issuer + '.svg' ) ) {
    issuer = __dirname + '/assets/issuers/' + req.body.issuer + '.svg';
  }

  // generate svg certificate
  var svgCert = certUtils.render( req.body.recipient, issuer );

  // check if format requested is svg, if so return it now
  if( req.body.outputFormat === 'svg' ) {
    res.set( 'Content-Type', 'image/svg+xml' );
    return res.send( svgCert );
  }

  // pdf/png requested so lets convert and send back
  certUtils.convert( svgCert, req.body.outputFormat, env.get( 'svable_key' ), function( convertedCert ) {
    if( req.body.outputFormat === 'png' ) {
      res.set( 'Content-Type', 'image/png' );
    }
    else {
      res.set( 'Content-Type', 'application/pdf' );
    }
    res.send( convertedCert );
  });
});

// launch server
var server = app.listen( env.get( 'port' ) || 3000, function() {
  console.log( 'Now listening on %d', server.address().port );
});
