var fs = require("fs");
var ToolInfo = require('../models/mysql/tool.js');
var M_tool = require('../models/mongo/tool.js');
var util = require('../utilities/toolUtils.js');
var solrClient = require("../config/solr.js");

function ToolController() {
    var self = this;
    this.OUTFILE_DIRECTORY = "public/solr/";
    this.show = function(req, res) {
        return self._show(self, req, res);
    };
    this.showAll = function(req, res) {
        return self._showAll(self, req, res);
    };
    this.toSolrFile = function(req, res) {
      return self._toSolrFile(self, req, res);
    };

}

ToolController.prototype._show = function(self, req, res) {
    var id = req.params.id;
    ToolInfo.forge()
        .where({
            AZID: id
        })
        .fetchAll({
            withRelated: ['domains', 'platforms', 'tags', 'resources', 'languages', 'institutions', 'users', 'licenses']
        })
        .then(function(thisTool) {
            M_tool.findOne({
                azid: id
            }, function(err, misc) {
                if (err || thisTool.length == 0) {
                    var response = {
                        status: 'error',
                        error: id + ' not found'
                    }
                    return res.send(response);
                }

                var returnTool = thisTool.toJSON()[0];

                console.log('tool',thisTool.toJSON());

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
                var result = util.mysql2solr(returnTool);
                return res.send(result);
            });
        })
        .catch(function(err) {
            console.log(err);
            var response = {
                status: 'error',
                error: JSON.stringify(err)
            }
            return res.send(response);
        });
};

ToolController.prototype._showAll = function(self, req, res) {
    ToolInfo.forge()
        .query(function(qb) {
            qb.orderBy('AZID');
            qb.limit(10);
        })
        .fetchAll({
            withRelated: ['domains', 'platforms', 'tags', 'resources', 'languages', 'institutions']
        })
        .then(function(tools) {
            var returnTools = [];
            var toolsArr = tools.toJSON();
            for (var i = 0; i < toolsArr.length; i++) {
                var tool = toolsArr[i];
                var returnTool = tool;
                var id = tool.id;
                M_tool.findOne({
                    azid: id
                }, function(err, misc) {
                    if (err || tools.length == 0) {
                        var response = {
                            status: 'error',
                            error: id + ' not found'
                        }
                        return res.send(response);
                    }

                    //console.log('tool',thisTool.toJSON());

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
                    var formatJson = util.mysql2rest(returnTool);
                    console.log(formatJson);
                    returnTools.push(formatJson);
                });
            }
            return res.send(returnTools);
        })
        .catch(function(err) {
            console.log(err);
            var response = {
                status: 'error',
                error: JSON.stringify(err)
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

ToolController.prototype._toSolrFile = function(self, req, res) {
  // Create directories if necessary
  if (!fs.existsSync(self.OUTFILE_DIRECTORY)) {
      fs.mkdirSync(self.OUTFILE_DIRECTORY);
  }

  // Generate new timestamped output file
  var date = new Date();
  var entries = [];

  ToolInfo.count().then(function(total){
    if(!total){
      var response = {
          status: 'error',
          error: 'Count error'
      }
      return res.send(response);
    }
    var callback = function(message){
      entries.push(message);
    };

    var promises = [];
    for(var i = 1; i <= total; i++){
        promises.push(getTool(i, util.mysql2solr));
    }
    Promise.all(promises).then(function(data){
      fs.appendFileSync(self.OUTFILE_DIRECTORY + "solr_"+date.toISOString().replace(/:/g, "-") + ".json", JSON.stringify(data, null, 1));
      //console.log(data);
      return res.send({total: total});
    }).catch(function(err){
      return res.send(err);
    });

  });
};

function getTool(id, format){
  return new Promise(function(resolve, reject){
    ToolInfo.forge()
        .where({
            AZID: id
        })
        .fetchAll({
            withRelated: ['domains', 'platforms', 'tags', 'resources', 'languages', 'institutions', 'users', 'licenses']
        })
        .then(function(thisTool) {
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
                var result = format(returnTool);
                return resolve(result);
            });
        })
        .catch(function(err) {
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
