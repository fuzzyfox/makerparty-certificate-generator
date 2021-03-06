'use strict';

// utility function to parse/use query strings
window.query = document.query = (function(win, doc, undefined){
  var pairs = win.location.search.slice( 1 ).split( '&' ),
    result = {};

  pairs.forEach( function( pair ) {
    pair = pair.split( '=' );
    result[ pair[ 0 ] ] = decodeURIComponent( pair[ 1 ] || '' );
  });

  return JSON.parse(JSON.stringify(result));
})( window, document );

// login button? when clicked try login
var personaLoginBtns = Array.prototype.slice.call( document.querySelectorAll('.persona-login') );
personaLoginBtns.filter( function( btn ) {
  btn.addEventListener( 'click', function() {
    navigator.id.request();
  }, false);
});

// logout button? set to display current user + on click logout.
var personaLogoutBtns = Array.prototype.slice.call( document.querySelectorAll('.persona-logout') );
personaLogoutBtns.filter( function( btn ) {
  btn.addEventListener( 'click', function() {
    navigator.id.logout();
  }, false);
});

navigator.id.watch({
  onlogin: function(assertion) {
    var xhr = new XMLHttpRequest();
    xhr.open( 'POST', '/persona/verify', true );
    xhr.setRequestHeader( 'Content-Type', 'application/json' );
    xhr.addEventListener( 'loadend', function( e ) {
      var data = JSON.parse(this.responseText);
      if ( data && data.status === 'okay' ) {
        console.log( 'You have been logged in as: ' + data.email );

        if( window.query.redirect ) {
          location.href = window.query.redirect;
        }

        if( location.pathname === '/login') {
          location.href = '/list';
        }
      }
    }, false);

    xhr.send( JSON.stringify( {
      assertion: assertion
    } ) );
  },
  onlogout: function() {
    var xhr = new XMLHttpRequest();
    xhr.open( 'POST', '/persona/logout', true );
    xhr.addEventListener( 'loadend', function( e ) {
      console.log( 'You have been logged out' );

      personaLogoutBtns.filter( function( btn ) {
        btn.parentNode.remove( btn );
      });

      if( location.pathname !== '/login' ) {
        location.href = '/login';
      }
    });
    xhr.send();
  }
});
