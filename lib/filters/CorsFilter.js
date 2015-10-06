var fs = require('fs'),
    log4js = require('log4js');

var logger = log4js.getLogger('crossweb');

var FrameworkError = require('../error.js').FrameworkError;
var ErrorCode = require('../error.js').ErrorCode;
var ErrorDomain = require('../error.js').ErrorDomain;
var _cors = null;

var CorsFilter = {
	setup: function (configPath, callback) {
		callback = callback || function () {};

		var config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    _cors = config.cors;
    logger.info(_cors);

    callback();
	},

	check: function (request, response, callback) {
		var configOrigin = request.origin;

		var method = request.method;

		var setOrigin = function (req, res, cors) {
			var whiteList = cors.whiteList || cors.defaultOrigin;
			if (!Array.isArray(whiteList)) {
				whiteList = [whiteList];
			}
			
			var requestOrigin = req.headers.origin;
			
			if (whiteList.indexOf(requestOrigin) != -1) {
				res.setHeader('Access-Control-Allow-Origin', requestOrigin);	
			}	
			else {
				res.setHeader('Access-Control-Allow-Origin', cors.defaultOrigin);	
			}
		}
		if (method === 'OPTIONS') {
			
			setOrigin(request, response, _cors);
			response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT');
			response.setHeader('Access-Control-Allow-Credentials', true);
			response.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
			
			response.writeHead(200, {});
			response.end();
		}
		else {
			setOrigin(request, response, _cors);
			response.setHeader('Access-Control-Allow-Credentials', true);
			response.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');	
			callback(null, true);
		}
		
	},

	fail: function (request, response) {

	}
};

exports.CorsFilter = CorsFilter;