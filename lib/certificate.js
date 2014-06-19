'use strict';

var fs = require( 'fs' );
var tmp = require( 'tmp' );
var request = require( 'request' );
var moment = require( 'moment' );
var spawn = require( 'child_process' ).spawn;

// setup
tmp.setGracefulCleanup(); // nice garbage collection for temp files
var baseFile = fs.readFileSync( __dirname + '/../certificate.svg', 'utf-8' );

function generate( details, fileName, callback ) {
  details = details || {};
  details = {
    recipient: details.recipient || 'Joe Bloggs',
    issuer: details.issuer || 'J Smith',
    issuerRole: details.issuerRole || 'Maker of stuff',
    date: details.date || moment().format( 'MMMM Do YYYY' )
  };

  var rtn = baseFile;
  rtn = rtn.replace( '{{ recipient }}', details.recipient );
  rtn = rtn.replace( '{{ issuer }}', details.issuer );
  rtn = rtn.replace( '{{ issuerRole }}', details.issuerRole );
  rtn = rtn.replace( '{{ date }}', details.date );

  if( typeof fileName === 'string' && typeof callback === 'function' ) {
    fs.writeFile( fileName, rtn, callback );
  }

  return rtn;
}

function localConvert( fileName, outputFormat, callback ) {
  outputFormat = outputFormat || 'pdf';
  tmp.tmpName( function( err, tmpFileName ) {
    var convertor = spawn( 'rsvg-convert', [ '-o', tmpFileName, '-f', outputFormat, fileName ] );

    convertor.on( 'close', function( code ) {
      if( code === 0 ) {
        callback( fs.readFileSync( tmpFileName ), outputFormat );
      }
    });
  });
}

function remoteConvert( file, outputFormat, apiKey, callback ) {
  outputFormat = outputFormat || 'pdf';

  tmp.tmpName( function( err, tmpFileName ) {
    // we need a tmp file to write the converted file to
    var tmpFileStream = fs.createWriteStream( tmpFileName );
    tmpFileStream.on( 'error', function( err ) {
      console.error( err );
    });

    var req = request.post({
      uri: 'https://svable.com/api/convert',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: file,
        format: outputFormat
      })
    }).pipe( tmpFileStream );

    req.on( 'finish', function() {
      callback( err, fs.readFileSync( tmpFileName ) );
    });
  });
}

module.exports = {
  generate: generate,
  localConvert: localConvert,
  remoteConvert: remoteConvert
};
