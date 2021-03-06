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
var localHostStore = {};

/**
 * Get all saved hosts
 *
 * @param  {Function} done Is passed an error if there was one, and an Array of known hosts
 */
function get( done ) {
  redisClient.get( redisKey, function( err, res ) {
    if( err ) {
      return done( err, {} );
    }

    debug( '[db]: get hosts from db' );

    var hosts = {};

    if( res !== null ){
      hosts = JSON.parse( res );
    }

    localHostStore = hosts;

    return done( err, hosts );
  });
}

/**
 * Get a hostObj by their hostId
 *
 * IF done is not passed the check is done against an in-memory copy of the hosts stored in the db,
 * only pass in a `done` function IF you cannot trust the in-memmory array.
 *
 * @param  {String}   hostId The host to search for
 * @param  {Function} [done] Called w/ error if there was one, and hostObj
 * @return {Object}          The host's hostObj
 */
function getById( hostId, done ) {
  if( typeof done === 'function' ) {
    get( function( err, hosts ) {
      return done( err, hosts[ hostId ] );
    });
  }

  return JSON.parse( JSON.stringify( localHostStore[ hostId ] ) );
}

/**
 * Save hosts array to db.
 *
 * This is a dumb save, the contents of `hosts` will replace ALL
 * existing hosts in the db.
 *
 * @param  {Object} hosts Object containing and Array of hostIds + individual host objects to save.
 */
function save( hosts ) {
  redisClient.set( redisKey, JSON.stringify( hosts ) );

  debug( '[db]: update hosts in db' );

  // update local if monitor not working
  if( !module.exports.monitorActive ) {
    localHostStore = hosts;
  }
}

/**
 * Check if host is already in db
 *
 * IF done is not passed the check is done against an in-memory copy of the hosts stored in the db,
 * only pass in a `done` function IF you cannot trust the in-memmory array.
 *
 * @param  {String}   hostId The id of the host to check for
 * @param  {Function} [done] Called w/ error if there was one, and Boolean to indicate if host found
 */
function isStored( hostId, done ) {
  if( typeof done === 'function' ) {
    // get saved hosts
    return get( function( err, hosts ) {
      // call done w/ boolean as result (true if indexof is > -1 )
      return done( err, ( Object.keys( hosts ).indexOf( hostId ) > -1 ) );
    });
  }

  return ( Object.keys( localHostStore ).indexOf( hostId ) > -1 );
}

/**
 * Add host to the db
 *
 * Once a host has been set it cannot be changed using the `add()` function.
 *
 * @param {Object}   hostObj  A host object to store `{ id: String, issueDate: Date, issuer: String }`
 * @param {Function} [done]   Called w/ error if there was one, and the updated Array of host ids
 */
function add( hostObj, done ) {
  done = done || function(){};

  get( function( err, hosts ) {
    if( Object.keys( hosts ).indexOf( hostObj.id ) === -1 ) {
      // add host to store
      hosts[ hostObj.id ] = hostObj;

      // save updated array
      save( hosts );

      // call done w/ new hosts
      return done( err, hosts );
    }

    // host already saved, just pretend to save
    return done( err, hosts );
  });
}

/**
 * Update a host record in the db
 *
 * The record to update is determined by the hostObj.id property
 *
 * @param  {Object}   hostObj A new host object to store for the host (id must be the same)
 * @param  {Function} done    Called w/ error if there was one, and the update hosts
 */
function update( hostObj, done ) {
  get( function( err, hosts ) {
    if( Object.keys( hosts ).indexOf( hostObj.id ) > 1 ) {
      // host found, update
      hosts[ hostObj.id ] = hostObj;

      // save the update
      save( hosts );

      // call w/ updated hosts object
      return done(err, hosts );
    }
    else if( !err ) {
      err = new Error( 'Cannot find host to update it' );
    }

    // host not found call done w/ errors + unmodified hosts
    return done( err, hosts );
  });
}

/**
 * Remove a host from the db
 *
 * @param  {String}   hostId The id of the host to remove
 * @param  {Function} [done] Called w/ error if there was one, and the updated Array of host ids
 */
function remove( hostId, done ) {
  done = done || function(){};

  get( function( err, hosts ) {
    if( err ) {
      return done( err, hosts );
    }

    // check if we actually need to do any work
    if( Object.keys( hosts ).indexOf( hostId ) > -1 ) {
      // host found, remove them
      delete hosts[ hostId ];

      // save changes
      save( hosts );

      // call done w/ updated hosts array
      return done( err, hosts );
    }

    // host wasn't saved pretend to remove
    return done( err, hosts );
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
      debug( '[db monitor]: ', args );

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
  getById: getById,
  add: add,
  update: update,
  remove: remove,
  monitorActive: false
};
