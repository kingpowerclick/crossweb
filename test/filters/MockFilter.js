var MockFilter = {
  name: 'Mock Filter',
  pass: true,
  invoke: false,
  
  setup: function (configPath) {
    
  },
  
  check: function (request, callback) {
    this.invoke = true;
    callback(null, this.pass);
  },
  
  fail: function (request, response) {
    
  }
}

exports.MockFilter = MockFilter;