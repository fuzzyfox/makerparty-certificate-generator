/* global $ */
'use strict';

$(function() {
  var preventSubmit = false;

  $( 'form' ).on( 'submit', function( event ) {
    var $frame = $( '#cert-result' );

    // prevent browser submitting form
    if( preventSubmit ) {
      event.preventDefault();
    }

    // prevent additional submitions till complete
    preventSubmit = true;

    // hide frame till loaded (if showing)
    $frame.removeClass( 'loaded' );

    // once frame is loaded bring it into view
    $frame.load( function() {
      // try and scale img to be full width
      if( $frame.contents().find( 'img' ) ) {
        $frame.contents().find( 'img' ).css({
          display: 'block',
          margin: 'auto'
        });
        $frame.contents().find( 'html, body' ).css({
          margin: 0,
          padding: 0
        });
      }

      $frame.addClass( 'loaded' );
      preventSubmit = false;
    });
  });
});
