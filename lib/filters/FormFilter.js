var formidable = require('formidable'),
    fs = require('fs'),
    log4js = require('log4js'),
    querystring = require('querystring'),
    url = require('url');
    
var logger = log4js.getLogger('crossweb');

var FormFilter = {
  
  /**
   * Setup filter from configuration file.
   *
   * @param {String} configPath, configuration file path.
   * @param {Function} callback, filter callback function.
   */
  setup: function (configPath, callback) {
    callback = callback || function () {};
    
    var self = this;
    fs.readFile(configPath, 'utf8', function (error, data) {
      var config = JSON.parse(data);
      var formConfig = config.form || {};
      self._uploadPath = formConfig.uploadPath;
      
      callback();
    });
  },
  
  /**
   * Parse request and construct key-value attribute on request.
   *
   * @param {Object} request, HTTP request
   * @param {Function(error, Boolean)} callback
   */
  check: function (request, response, callback) {
    var method = request.method;
    
    if (method == 'GET' || method == 'HEAD') {
      
      var body = { _: [] };
      
      var query = url.parse(request.url, true).query;
      for (var key in query) {
        if (query[key].length > 0) {
          body[key] = query[key];
        } else {
          body._.push(key);
        }
      }
      
      request.body = body;
      callback(null, true);
      
    } else {
      
      var headers = request.headers || {};
      var type = (headers['content-type'] || '').split(';')[0];
      
      var body = {};
      var query = url.parse(request.url, true).query;
      for (var key in query) {
        if (query[key].length > 0) {
          body[key] = query[key];
        } else {
          body._.push(key);
        }
      }
      request.body = body;

      var _pullData = function (request, callback) {
        var buffer = '';
        request.setEncoding('utf8');
        request.on('data', function (chunk) {
          buffer += chunk;
        });
        
        request.on('end', function () {
          callback(buffer);
        });
      }

      
      if (type == 'application/json') {
        _pullData(request, function (buffer) {
          try {
            var body = JSON.parse(buffer);
            for (var key in body) {
              request.body[key] = body[key];
            }
          } catch (e) {
            logger.debug ('Invalid form data. ');
            logger.debug (buffer);
            
            request.body = {};
          }
          
          callback(null, true);
        });
      } else if (type == 'application/x-www-form-urlencoded') {
        _pullData(request, function (buffer) {
          // Don't auto unescape output!
          logger.trace('buffer: ' + buffer);

          var output = {};
          var queries = buffer.split('&');
          logger.trace ('queries: ' + queries);
          queries.forEach(function (query) {
            var keyValue = query.split('=');
            if (keyValue.length == 2) {
              output[keyValue[0]] = keyValue[1];
            }
          });

          for (var key in output) {
            request.body[key] = output[key];
          }
          logger.trace(output);
          
          callback(null, true);
        });
      } else {

        var form = new formidable.IncomingForm();
        if (this._uploadPath) {
          form.uploadDir = this._uploadPath;
        }
        
        form.parse(request, function (error, fields, files) {
          
          if (error) {
            request.body = {};
          } else {
            for (var key in fields) {
              request.body[key] = fields[key];
            }

            for (var key in files) {
              request.body[key] = files[key];
            }
          }
          
          callback(null, true);
        });
        
      }
      
    }
    
  },
  
  /**
   * It's never fail. 
   */
  fail: function (request, response) {
    response.writeHead(302, { 'Location': '/' });
  }
  
};

exports.FormFilter = FormFilter;