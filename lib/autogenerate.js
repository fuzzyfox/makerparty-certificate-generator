'use strict';

// load env
var shared = require( '../shared' );
var env = shared.env;
var debug = shared.debug;

// get modules
var hatchet = require( 'hatchet' );
var moment = require( 'moment' );

module.exports = function( candidatesUtil, recipientsDB ) {
  // auto generation method
  function generate() {
    debug( '%s: Polling for new candidates + cert generations.', moment().toISOString() );

    // when running auto generate always check for new
    candidatesUtil.forceUpdate( function( candidates ) {
      // filter out anyone who's already had an email
      candidates = candidates.filter( function( candidate ) {
        return ! recipientsDB.isStored( candidate );
      });

      // for each remaining generate a cert + send email
      candidatesUtil.forEach( function( candidate ) {
        recipientsDB.add({
          id: candidate,
          issueDate: moment().format( 'MMMM Do, YYYY' ),
          issuer: env.get( 'default_issuer' )
        }, function( err ) {
          if( err ) {
            return console.error( 'Error: could not store candidate %s when autogenerating certs.', candidate );
          }

          hatchet.send( 'mp_cert_generated', {
            certificateURL: env.get( 'app_url' ) + '/' + candidate + '.png',
            username: candidate,
            email: candidatesUtil.getCandidateDetails( candidate ).email,
            locale: candidatesUtil.getCandidateDetails( candidate ).prefLocale
          }, function( err, data ) {
            if( err ) {
              console.error( 'Error: failed to send hatchet event.', err, data );
            }
          });
        });
      });
    });
  }

  // poll interval
  var pollInterval;

  // return methods to trigger OR stop polling
  return {
    setInterval: function( interval ) {
      pollInterval = setInterval( generate, interval );
      return pollInterval;
    },
    clearInterval: function( interval ) {
      clearInterval( interval || pollInterval );
    }
  };
};
