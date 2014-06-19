'use strict';

var Habitat = require( 'habitat' );
var redis = require( 'redis' );

var env = new Habitat();
Habitat.load();

// custom debug function (console.log only when debug flag set)
function debug() {
  if( env.get( 'debug' ) || env.get( 'DEBUG' ) ) {
    return console.log.apply( null, arguments );
  }

  return;
}

// get redis client
function getRedisClient() {
  var redisConf = {};
  var db = {};

  if( env.get( 'rediscloud_url' ) ) {
    redisConf = require( 'url' ).parse( env.get( 'rediscloud_url' ) );
    db = redis.createClient( redisConf.port, redisConf.hostname, { no_ready_check: true} );
    db.auth( redisConf.auth.split( ':' )[ 1 ] );
    return db;
  }

  return redis.createClient();
}

module.exports = {
  env: env,
  debug: debug,
  redisClient: getRedisClient(),
  newRedisClient: getRedisClient
};
