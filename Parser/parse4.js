var fs = require('fs'),
 xml2js = require('xml2js');
const util = require('util')

var parser = new xml2js.Parser();
fs.readFile('bpmn/pizza.bpmn', function(err, data) {
    parser.parseString(data, function (err, result) {
        console.dir(result);
        console.log(util.inspect(result, false, null))
        console.log('Done');
    });
});