var fs = require('fs'),
    log4js = require('log4js'),
    uaParser = require('ua-parser');

var logger = log4js.getLogger('crossweb');

var Guard = require('../modules/guard.js');

var _guard = null;
var _locations = null;
var _sessionKey = 'session';
var _domain;

var GuardHandler = {
  
  /**
   * Setup GuardHandler to get guard
   *
   * @param {String} configPath, configuration path.
   * @param {Function} callback
   */
  setup: function (configPath, callback) {
    callback = callback || function () {};
    
    _guard = Guard.instance(configPath);
    
    var configObject = JSON.parse(fs.readFileSync(configPath));
    var guardConfig = configObject.guard;
    
    _locations = guardConfig.locations;
    _sessionKey = guardConfig.session;
    _domain = guardConfig.domain;
    
    callback();
  },
  
  /**
   * Authenticate request
   *
   * @param {Object} request, HTTP Request
   * @param {Object} response, HTTP Response
   */
  authenticate: function (request, response, callback) {
    callback = callback || function () {};
    
    var guard = _guard;
    var locations = _locations;
    
    if (guard) {
      
      if (request.session) {
        
        var session = request.session;
        guard.resume(session.id, function (error, updatedSession) {
          if (error) {
            var output = {
              message: error.message,
              domain: error.domain,
              code: error.code,
              action: false,
              error: error
            };

            response.writeHead(200, {});
            response.end(JSON.stringify(output));
          }
          else {
            var expiresText = GuardHandler.cookieTime(updatedSession.timestamp + 1314000000);
            var domain = '';
            if (request.headers.origin) {
              domain = 'Domain=' + GuardHandler.cookieDomain(request.headers.origin || '') + ';';
            }

            // Redirect to index immediatly
            response.writeHead(200, {
              'Set-Cookie': [
                _sessionKey + '=' + updatedSession.id + '; Expires=' + expiresText + '; Path=/;' + domain,
                'domain=' + request.headers.origin + ';'
              ]
            });
            response.end(JSON.stringify({ 
              action: 'authenticate',
              success: true,
              action: true,
              output: {}
            }));
          }

          callback();
          
        });

        
      } else {
        
        //Extract credential from request body
        var credential = request.body;

        if (credential) {
          
          // Append ip to credential to detect connection in authenticator.
          credential.ip = request.ip;
          
          // need user-agent for createdUser data
          var userAgent = (request.headers['user-agent'] || '').toLowerCase();
          if (userAgent == 'iphone' || userAgent == 'android') {
            credential.userAgent = userAgent;
          }
          else {
            credential.userAgent = uaParser.parse(request.headers['user-agent']);  
          }
          // end user-agent

          for (var key in credential) {
            credential[key] = unescape(credential[key]);
          }

          guard.authenticate(
            credential,
            function (error, session) {
              
              if (!error) {
                var expiresText = GuardHandler.cookieTime(session.timestamp + 1314000000);
                var domain = '';
                if (request.headers.origin) {
                  domain = 'Domain=' + GuardHandler.cookieDomain(request.headers.origin || '') + ';';
                }

                response.writeHead(200, {
                  'Set-Cookie': [
                    'user=' + JSON.stringify(session.user) + '; Expires=' + expiresText + '; Path=/;' + domain,
                    _sessionKey + '=' + session.id + '; Expires=' + expiresText +'; Path=/;' + domain,
                    'domain=' + request.headers.origin + ';'
                  ]
                });
                response.end(JSON.stringify({ 
                  action: 'authenticate',
                  success: true,
                  action: true,
                  output: {}
                }));
                
              } else {

                var output = {
                  message: error.message,
                  domain: error.domain,
                  code: error.code,
                  action: false,
                  error: error
                };

                response.writeHead(200, {});
                response.end(JSON.stringify(output));

              }
              
              callback();

            });

        } else {
          response.writeHead(503, {});
          response.end();
          
          callback();
        }
        
      }
      
    } else {
      response.writeHead(503, {});
      response.end();
      
      callback();
    }
  },
  
  /**
   * Signout from system and destroy their session and cookies.
   *
   * @param {Object} request, HTTP Request
   * @param {Object} response, HTTP REsponse
   */
  logout: function (request, response, callback) {
    callback = callback || function () {};
    
    var makeClientCookieExpire = function () {
      var locations = _locations;
      var expiresText = GuardHandler.cookieTime(0);
      response.writeHead(200, {
        'Set-Cookie': [
          'user=; Expires=' + expiresText + '; Path=/;',
          _sessionKey + '=; Expires=' + expiresText +'; Path=/;'
        ]
      });
      response.end(JSON.stringify({ 
        action: 'logout',
        success: true,
        action: true,
        output: {}
      }));

      callback();
    }
    
    var guard = _guard;
    if (request.session) {
      guard.expire(request.session.id, function () {
        makeClientCookieExpire();
      });
    }
    else {
      makeClientCookieExpire();
    }
    
    
  },
  
  /**
   * Change date timestamp to cookies time text.
   *
   * @param {Number} timestamp
   *
   * @return time string for use in cookies expire header
   */
  cookieTime: function (timestamp) {
    var expires = new Date(timestamp);
	
    var dayOfWeek = expires.getUTCDay() == 0 ? 'Sun' :
                    expires.getUTCDay() == 1 ? 'Mon' :
                    expires.getUTCDay() == 2 ? 'Tue' :
                    expires.getUTCDay() == 3 ? 'Wed' : 
                    expires.getUTCDay() == 4 ? 'Thu' :
                    expires.getUTCDay() == 5 ? 'Fri' : 'Sat';
    var monthOfYear = expires.getUTCMonth() == 0 ? 'Jan' :
                      expires.getUTCMonth() == 1 ? 'Feb' :
                      expires.getUTCMonth() == 2 ? 'Mar' :
                      expires.getUTCMonth() == 3 ? 'Apr' :
                      expires.getUTCMonth() == 4 ? 'May' :
                      expires.getUTCMonth() == 5 ? 'Jun' :
                      expires.getUTCMonth() == 6 ? 'Jul' :
                      expires.getUTCMonth() == 7 ? 'Aug' :
                      expires.getUTCMonth() == 8 ? 'Sep' :
                      expires.getUTCMonth() == 9 ? 'Oct' :
                      expires.getUTCMonth() == 10 ? 'Nov' : 'Dec';
    var expiresText = dayOfWeek + ', ' + 
                      (expires.getUTCDate() < 10 ? '0' + expires.getUTCDate() : expires.getUTCDate()) + '-' + 
                      monthOfYear + '-' +
                      expires.getUTCFullYear() + ' ' +
                      (expires.getUTCHours() < 10 ? '0' + expires.getUTCHours() : expires.getUTCHours()) + ':' +
                      (expires.getUTCMinutes() < 10 ? '0' + expires.getUTCMinutes() : expires.getUTCMinutes()) + ':' +
                      (expires.getUTCSeconds() < 10 ? '0' + expires.getUTCSeconds() : expires.getUTCSeconds()) + ' GMT';
    return expiresText;
  },

  cookieDomain: function (origin) {
    return _domain || origin.replace(/^(http|https):\/\//, '.');
  }

}

exports.GuardHandler = GuardHandler;

exports.setup = GuardHandler.setup;
exports.authenticate = GuardHandler.authenticate;
exports.logout = GuardHandler.logout;
