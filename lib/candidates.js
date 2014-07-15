#!/usr/bin/env node
'use strict';

// libs
var request = require( 'request' );
var moment = require( 'moment' );
var UserClient = require( 'webmaker-user-client' );

// shared config
var shared = require( '../shared' );
var env = shared.env;

// user client config
var userClient = new UserClient({
  endpoint: env.get( 'login_url' )
});

// tmp stores
var events = []; // events from the event api
var eventHosts = []; // unique array of event hosts
var userDetails = {}; // details for each event host { host: details }
var candidates = []; // list of candidates that meet all criteria

/*
  Functions for each task to perform while refining event hosts into
  certificate candidates list
 */

// gets a users details from login db
var getUserDetails = function( username, done ) {
  userClient.get.byUsername( username, function( err, user ) {
    if( err ) {
      done();
      return console.log( err );
    }

    userDetails[ username ] = user.user;
    return done();
  });
};

// Filter event hosts list down to just those who we can send engagements to
var filterEventHostsBySendEngagements = function( done ) {
  eventHosts = eventHosts.filter( function( host ) {
    return ( userDetails[ host ] && userDetails[ host ].sendEngagements );
  });

  // TODO change this out to check for extra event details provided
  candidates = eventHosts;

  // call done
  done();
};

// get events in range
var getEventHosts = function( done ) {
  request.get({
    uri: env.get( 'events_platform' ) + '/events',
    qs: {
      after: env.get( 'events_after' ),
      before: env.get( 'events_before' )
    }
  }, function( err, res, eventsJSON ) {
    if( !err && res.statusCode === 200 ) {
      /*
        Get event hosts who have ended events
       */
      events = JSON.parse( eventsJSON );

      // add all unique event hosts to array
      events.forEach( function( event ) {
        if( eventHosts.indexOf( event.organizerId ) === -1 ) {
          // if we have an end date AND its in the past
          if( event.endDate && moment( event.endDate ) <= moment() ) {
            eventHosts.push( event.organizerId );
          }
          // if we dont have an end date but a begin date, its the past
          else if( event.beginDate && moment( event.beginDate ) <= moment() ) {
            eventHosts.push( event.organizerId );
          }

          // anything else we can ignore
        }
      });

      done();
    }
    else if( err ) {
      console.error( 'Failed to get events.', err );
    }
  });
};

/*
  Actually generate the candidates list
 */
var updateCandidateList = function( done ) {
  getEventHosts( function() {
    // used to syncify some async
    var usersToGetDetailsFor = eventHosts.length;
    var gotUserDetails = function() {
      usersToGetDetailsFor = usersToGetDetailsFor - 1;

      if( usersToGetDetailsFor === 0 ) {
        // once all user details have been fetched this runs
        filterEventHostsBySendEngagements( function(){
          if( typeof done === 'function' ) {
            done( candidates );
          }
        });
      }
    };

    // get details for each host`
    eventHosts.forEach( function( host ) {
      getUserDetails( host, gotUserDetails );
    });
  });
};
// fire initial grab
updateCandidateList();

/*
  Set an update interval
    default to every 12 hrs
 */
var updateInterval = setInterval( updateCandidateList, 43200000 );

/*
  Make this work as a library too.
 */
module.exports = {
  forceUpdate: updateCandidateList,
  setUpdateInterval: function( interval ) {
    clearInterval( updateInterval );
    updateInterval = setInterval( updateCandidateList, interval );
    updateCandidateList();
  },
  get: function() {
    return JSON.parse( JSON.stringify( candidates ) );
  }
};

