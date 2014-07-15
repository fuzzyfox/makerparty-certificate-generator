'use strict';

var shared = require('../shared');
var redisClient = shared.redisClient;
var env = shared.env;
var debug = shared.debug;

var redisKey = 'hosts';

if( env.get( 'redis_prefix' ) ) {
  redisKey = env.get( 'redis_prefix' ) + ':' + redisKey;
}

// we also store a version in memory so we can do some sync checks
var localHostIds = [];

/**
 * Get all saved hosts
 *
 * @param  {Function} done Is passed an error if there was one, and an Array of known hosts
 */
function get( done ) {
  redisClient.get( redisKey, function( err, res ) {
    if( err ) {
      return done( err, [] );
    }

    debug( '[app]: get hosts from db' );

    var hosts = [];

    if( res !== null ){
      hosts = JSON.parse( res );
    }

    localHostIds = hosts;

    done( err, hosts );
  });
}

/**
 * Save hosts array to db.
 *
 * This is a dumb save, the contents of `hosts` will replace ALL
 * existing hosts in the db.
 *
 * @param  {Array} hosts Array of hosts to save.
 */
function save( hosts ) {
  redisClient.set( redisKey, JSON.stringify( hosts ) );

  debug( '[app]: update hosts in db' );

  // update local if monitor not working
  if( !module.exports.monitorActive ) {
    localHostIds = hosts;
  }
}

/**
 * Check if host is already in db
 *
 * IF done is not passed the check is done against an in-memory copy of the hosts stored in the db,
 * only pass in a `done` function IF you cannot trust the in-memmory array.
 *
 * @param  {String}   hostId The id of the host to check for
 * @param  {Function} done   Called w/ error if there was one, and Boolean to indicate if host found
 */
function isStored( hostId, done ) {
  if( typeof done === 'function' ) {
    // get saved hosts
    return get( function( err, hosts ) {
      // call done w/ boolean as result (true if indexof is > -1 )
      done( err, ( hosts.indexOf( hostId ) > -1 ) );
    });
  }

  return ( localHostIds.indexOf( hostId ) > -1 );
}

/**
 * Add host to the db
 *
 * @param {String}   hostId The id of the host to store
 * @param {Function} done   Called w/ error if there was one, and the updated Array of host ids
 */
function add( hostId, done ) {
  done = done || function(){};

  get( function( err, hosts ) {
    if( hosts.indexOf( hostId ) === -1 ) {
      // add host to array
      hosts.push( hostId );

      // save updated array
      save( hosts );

      // call done w/ new hosts
      done( err, hosts );
    }

    // host already saved, just pretend to save
    done( err, hosts );
  });
}

/**
 * Remove a host from the db
 *
 * @param  {String}   hostId The id of the host to remove
 * @param  {Function} done   Called w/ error if there was one, and the updated Array of host ids
 */
function remove( hostId, done ) {
  done = done || function(){};

  get( function( err, hosts ) {
    if( err ) {
      return done( err, [] );
    }

    // check if we actually need to do any work
    if( hosts.indexOf( hostId ) > -1 ) {
      // host found, remove them
      hosts.splice( hosts.indexOf( hostId ), 1 );

      // save changes
      save( hosts );

      // call done w/ updated hosts array
      done( err, hosts );
    }

    // host wasn't saved pretend to remove
    done( err, hosts );
  });
}

/*
  Initial load
 */

// get data from reids NOW to make sure we're up-to-date
get( function(){} );

// setup a monitor to keep localHostIds in sync w/ remote db
var redisMonitor = shared.newRedisClient();
redisMonitor.monitor( function( err, res ) {
  if( !err ) {
    module.exports.monitorActive = true;

    return redisMonitor.on( 'monitor', function( time, args ) {
      debug( '[redis monitor]: ', args );

      if( args[ 0 ] === 'set' && args[ 1 ] === redisKey ) {
        get( function(){} );
      }
    });
  }

  console.error( err );
});

/*
  Exports
 */
module.exports = {
  message: function() {},
  isStored: isStored,
  get: get,
  add: add,
  remove: remove,
  monitorActive: false
};
