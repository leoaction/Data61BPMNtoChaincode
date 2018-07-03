/* 
  This provides restful api for server
  @by700git
*/

// require database
var mysql   = require("mysql");
var fs = require("fs");
var crypto = require('crypto');
var parse = require("../Translator/parser.js");

const getPortSync = require('get-port-sync');

var num_peers;



function REST_ROUTER(router,connection) {
    var self = this;
    self.handleRoutes(router,connection);
}


// Define the routes. A route is a path taken through the code dependent upon contents of the URL
REST_ROUTER.prototype.handleRoutes= function(router,connection) {

    // GET with no specifier - returns system version information
    // req paramdter is the request object
    // res parameter is the response object
    router.get("/",function(req,res){
        res.json({"Message":"BPMN Translation Server Version 1.0"});
    });


    // Index page used for testing
    router.get("/index",function(req,res){
        query = "SELECT * FROM bpmn";
        connection.query(query, function (err, result) {
            if (err) throw err;
            console.log("Query all networks");
            res.render('index',{
                                uniqle_id: "N/A",
                                all_networks: result,
                                translate_results: "N/A",
                                compile_results: "N/A",
                                deploy_results: "N/A",
                                invoke_results: "N/A"
            });
        });        
        //res.sendFile( __dirname + "/public/index.html" );
    });
    
    /*
    // list all created or deployed networks
    router.get("/api/v1/list",function(req,res){
        var query = "SELECT * FROM bpmn";
        connection.query(query, function (err, result) {
            
            console.log("Query all networks");
        });
        res.render('index',{
                            all_networks: "N/A",
                            translate_results: "N/A",
                            compile_results: "N/A",
                            deploy_results: "N/A",
                            invoke_results: "N/A"
        });
    });
    */


    
    // POST /api/v1/translate
    // req paramdter is the request object
    // res parameter is the response object
    /*
    POST format
    {
        //  The BPMN    model   in  XML
        "xmlModel":
                "<?xml  version=\"1.0\" encoding=\"UTF-8\"?><bpmn:definitions>...</bpmn:definitions>",
        //  The BPMN    process name
        "processName":  "IncidentManagement",
        //  Whether or  not to  use Petri-net   method  (BPMN2Solidity  translator  option)
        "usePetriMethod":   true
    }
    */
    router.post("/api/v1/translate",function(req,res){
        console.log("Translating the BPMN file" );
        
        receive = {
          xmlModel:req.body.xmlModel,
        };
        console.log(receive);

        var uniqle_id = crypto.createHash('md5').update(receive.xmlModel).digest('hex').substring(0, 5);
        console.log("uniqle_id created: " + uniqle_id); 
        filename = "tmp/" + uniqle_id + ".bpmn";

        fs.writeFile(filename, receive.xmlModel, function (err) {
            if (err) {
                console.log(err);
            }


            num_peers = parse(filename,uniqle_id);

            translate_results = fs.readFileSync(filename);

            query = "INSERT INTO bpmn (uniqle_id, status) VALUES (?,?)";
            table = [uniqle_id,0];
            query = mysql.format(query,table);
            connection.query(query, function (err, result) {
                if (err) throw err;
                console.log("Adding new entries");
            });


            query = "SELECT * FROM bpmn";
            connection.query(query, function (err, result) {
                if (err) throw err;
                console.log("Query all networks");
                // send response
                res.render('index',{
                                uniqle_id: uniqle_id,
                                all_networks: result,
                                translate_results: translate_results,
                                compile_results: "N/A",
                                deploy_results: "N/A",
                                invoke_results: "N/A"
                });
            });
        });
        //res.end(JSON.stringify(response));
    });

    //POST /api/v1/compile
    // req paramdter is the request object
    // res parameter is the response object
    /*
    POST format
    {
        // The only uniqle_id
        "uniqle_id": 
        // The chaincode
        "chaincode":     
    }
    */
    router.post("/api/v1/compile",function(req,res){
        console.log("Deploying Smart Contract" );
        
        receive = {
          uniqle_id:req.body.uniqle_id,
          chaincode:req.body.chaincode
        };
        console.log(receive);
        filename = "../../out/" + receive.uniqle_id + "/chaincode/chaincode.go";

        // save in out/uniqle_id/chaincode/*.go
        fs.writeFile(filename, receive.chaincode, function (err) {
            if (err) {
                console.log(err);
            }

            var compile = require("../Compiler/compiler.js");
            var compile_status = compile(filename);

            query = "SELECT * FROM bpmn";
            connection.query(query, function (err, result) {
                if (err) throw err;
                console.log("Query all networks");
                // send response
                res.render('index',{
                                uniqle_id: receive.uniqle_id,
                                all_networks: result,
                                translate_results: "N/A",
                                compile_results: compile_status,
                                deploy_results: "N/A",
                                invoke_results: "N/A"
                });
            });
        });
        //res.end(JSON.stringify(response));
    });

    //POST /api/v1/deploy
    // req paramdter is the request object
    // res parameter is the response object
    /*
    POST format
    {
        // The only uniqle_id
        "uniqle_id": 
        // The chaincode
        "chaincode":     
    }
    */
    router.post("/api/v1/deploy",function(req,res){
        console.log("Deploying Smart Contract" );
        var ports = [];
        for(var iter=0;iter<2*num_peers + 1;iter++){
            ports.push(getPortSync());
        }

        receive = {
          uniqle_id:req.body.uniqle_id,
          chaincode:req.body.chaincode
        };
        console.log(receive);
 
        var status;
        query = "SELECT * FROM bpmn WHERE uniqle_id=?";
        table = [receive.uniqle_id];
        query = mysql.format(query,table);
        status = connection.query(query)[0].status;
        status = deploy(receive.uniqle_id,status,ports);

        query = "UPDATE bpmn SET status = ? WHERE uniqle_id = ?";
        table = [status,receive.uniqle_id];
        query = mysql.format(query,table);
        connection.query(query, function (err, result) {
            if (err) throw err;
            console.log("Update new status");
        });

        query = "SELECT * FROM bpmn";
        connection.query(query, function (err, result) {
            if (err) throw err;
            console.log("Query all networks");
            // send response
            res.render('index',{
                            uniqle_id: receive.uniqle_id,
                            all_networks: result,
                            translate_results: "N/A",
                            compile_results: "N/A",
                            deploy_results: deploy_results,
                            invoke_results: "N/A"

            });
        });

        //res.end(JSON.stringify(response));
    });

    //POST /api/v1/invoke
    // req paramdter is the request object
    // res parameter is the response object
    /*
    POST format
    {
        // The only uniqle_id
        "uniqle_id": 
        // The chaincode
        "function_name":
        // The parameters, a list of parameters
        "parameters"    
    }
    */
    router.post("/api/v1/invoke",function(req,res){
        console.log("Invoking Smart Contract: function " + req.body.function_name);
        
        receive = {
          uniqle_id:req.body.uniqle_id,
          function_name:req.body.function_name,
          parameters:req.body.parameters
        };

        console.log(receive);
        
        invoke_results = invoke(receive.uniqle_id, function_name, parameters);     

        query = "SELECT * FROM bpmn";
        connection.query(query, function (err, result) {
            if (err) throw err;
            console.log("Query all networks");
            // send response
            res.render('index',{
                            uniqle_id: receive.uniqle_id,
                            all_networks: result,
                            translate_results: "N/A",
                            compile_results: "N/A",
                            deploy_results: deploy_results,
                            invoke_results: "N/A"

            });
        });
    });
}

// Makes this module available
module.exports = REST_ROUTER;