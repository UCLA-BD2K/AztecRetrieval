// Dependencies
var fs = require("fs");

// Model Dependencies
var ToolInfo = require('../models/mysql/tool');
var M_tool = require('../models/mongo/tool');

// Utility
var util = require('../utilities/tool-utils');

// Configuration files
var solrClient = require("../config/solr");

/**
 * ToolController
 * @constructor
 * Controller object declaration; this controller handles requests for retrieving metadata for tool(s).
 */
function ToolController() {
    var self = this;
    this.OUTFILE_DIRECTORY = "public/solr/";
    this.show = function(req, res) {
        return self._show(self, req, res);
    };
    this.toSolrFile = function(req, res) {
        return self._toSolrFile(self, req, res);
    };

}

/**
 * ToolController._show
 * [This function displays the JSON for the specified tool.]
 * @param  {Object} self [Referece to controller object]
 * @param  {Request} req  [HTTP Request]
 * @param  {Response} res  [HTTP Response]
 * @return {HTTP Response}      [HTTP resonse i.e. res.send]
 */
ToolController.prototype._show = function(self, req, res) {
    var id = req.params.id;
    getTool(id, util.mysql2solr).then(function(tool) {
        if (tool) {
            return res.send(tool);
        }
        var response = {
            status: 'error',
            error: 'Tool not found'
        }
        return res.send(response);
    });
};




ToolController.prototype._commit = function(self, req, res) {
    solrClient.commit(function(err, result) {
        var response;
        if (err) {
            response = {
                status: 'error',
                message: "Error committing to Solr"
            };
            return res.json(response);
        }
        if (result) {
            response = {
                status: 'success',
                message: "Successfully committed to Solr"
            };
            return res.json(response);
        }
    });
};

/**
 * ToolController._toSolrFile
 * [This function exports all tools in the database to a JSON file.]
 * @param  {Object} self [Referece to controller object]
 * @param  {Request} req  [HTTP Request]
 * @param  {Response} res  [HTTP Response]
 * @return {HTTP Response}      [HTTP resonse i.e. res.send]
 */
ToolController.prototype._toSolrFile = function(self, req, res) {
    // Create directories if necessary
    if (!fs.existsSync(self.OUTFILE_DIRECTORY)) {
        fs.mkdirSync(self.OUTFILE_DIRECTORY);
    }

    // Generate new timestamped output file
    var date = new Date();
    var entries = [];

    // Get a count of the number of tools in the MySQL database
    ToolInfo.count().then(function(total) {
        if (!total) {
            var response = {
                status: 'error',
                error: 'Count error'
            }
            return res.send(response);
        }

        // Create an array of Promises that will query the database
        var promises = [];
        for (var i = 1; i <= total; i++) {
            promises.push(getTool(i, util.mysql2solr));
        }

        // For each tool, write the metadata to the JSON file
        Promise.all(promises).then(function(data) {
            fs.appendFileSync(self.OUTFILE_DIRECTORY + "solr_" + date.toISOString().replace(/:/g, "-") + ".json", JSON.stringify(data, null, 1));
            //console.log(data);
            return res.send({
                total: total
            });
        }).catch(function(err) {
            return res.send(err);
        });

    });
};

/**
 * getTool
 * [Helper function that queries the MySQL database for a specific tool's metadata]
 * @param  {Integer} id     [The ID of the tool]
 * @param  {Function} format [The function that will format the tool to a specific format (takes 1 paramter: tool data)]
 * @return {Promise}        [A promise function that resolves if a tool has been found, rejects if it is not found or if there is an error]
 */
function getTool(id, format) {
    // return Promise
    return new Promise(function(resolve, reject) {
        // Query MySQL database for tool with the specified ID
        ToolInfo.forge()
            .where({
                AZID: id
            })
            .fetchAll({ // fetch all relations
                withRelated: ['domains', 'platforms', 'tags', 'resources', 'languages', 'institutions', 'users', 'licenses']
            })
            .then(function(thisTool) {

                // Query MongoDB for denormalized metadata
                M_tool.findOne({
                    azid: id
                }, function(err, misc) {
                    if (err || thisTool.length == 0) {
                        var response = {
                            status: 'error',
                            error: id + ' not found'
                        }
                        return reject(Error(response));
                    }

                    // format the data queried from MongoDB
                    var returnTool = thisTool.toJSON()[0];
                    if (misc != undefined && misc != null) {
                        returnTool.authors = misc.authors;
                        returnTool.maintainers = misc.maintainers;
                        returnTool.links = misc.links;
                        returnTool.funding = misc.funding;
                        returnTool.version = misc.versions;
                        returnTool.publications = misc.publications;
                        if (returnTool.institutions == undefined || returnTool.institutions == null)
                            returnTool.institutions = [];
                        misc.missing_inst.forEach(function(inst) {
                            returnTool.institutions.push(inst);
                        });
                    }

                    // format the tool
                    var result = format(returnTool);
                    return resolve(result);
                });
            })
            .catch(function(err) { // handle errors
                console.log(err);
                var response = {
                    status: 'error',
                    error: JSON.stringify(err)
                }
                return reject(Error(response));
            });

    });
}


module.exports = new ToolController();
