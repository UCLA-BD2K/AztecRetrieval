var ToolInfo = require('../models/mysql/tool.js');
var M_tool = require('../models/mongo/tool.js');
var util = require('../utilities/toolUtils.js');
var solrClient = require("../config/solr.js");

function ToolController() {
    var self = this;
    this.show = function(req, res) {
        return self._show(self, req, res);
    };
    this.showAll = function(req, res) {
        return self._showAll(self, req, res);
    };
    this.insertAll2Solr = function(req, res) {
        return self._insertAll2Solr(self, req, res);
    };
    this.insertTool2Solr = function(req, res) {
        return self._insertTool2Solr(self, req, res);
    };
}

ToolController.prototype._show = function(self, req, res) {
    var id = req.params.id;
    ToolInfo.forge()
        .where({
            AZID: id
        })
        .fetchAll({
            withRelated: ['domains', 'platforms', 'tags', 'resources', 'languages', 'institutions', 'users']
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

                //console.log('tool',thisTool.toJSON());

                if (misc != undefined && misc != null) {
                    console.log('misc', misc);

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
                var result = util.mysql2rest(returnTool);
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

ToolController.prototype._insertAll2Solr = function(self, req, res) {
    var response;
    M_tool.count({}, function(err, count) {
        if (err) {
            response = {
                status: 'error',
                error: JSON.stringify(err)
            };
            console.log(err);
            return res.send(response);
        }
        for (var id = 1; id <= count; id++) {
            ToolInfo.forge()
                .where({
                    AZID: id
                })
                .fetchAll({
                    withRelated: ['domains', 'platforms', 'tags', 'resources', 'languages', 'institutions']
                })
                .then(function(thisTool) {
                    M_tool.findOne({
                        azid: id
                    }, function(err, misc) {
                        if (err || thisTool.length == 0) {
                            console.log(id, err);
                        } else {

                            var returnTool = thisTool.toJSON()[0];

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
                            var result = util.mysql2solr(returnTool);
                            solrClient.add(result, function(err, obj) {
                                if (err) {
                                    console.log(err);
                                } else {
                                    console.log("Inserting", result.id);
                                }
                            });
                        }
                    });
                })
                .catch(function(err) {
                    console.log(err);
                    response = {
                        status: 'error',
                        error: JSON.stringify(err)
                    }
                    return res.send(response);
                });
        }
        console.log("Updating Solr");
        response = {
            status: 'success',
            message: "Updating Solr"
        }
        return res.send(response);
    });

};

ToolController.prototype._insertTool2Solr = function(self, req, res) {
    var id = req.params.id;
    var response;

    ToolInfo.forge()
        .where({
            AZID: id
        })
        .fetchAll({
            withRelated: ['domains', 'platforms', 'tags', 'resources', 'languages', 'institutions']
        })
        .then(function(thisTool) {
            M_tool.findOne({
                azid: id
            }, function(err, misc) {
                if (err || thisTool.length == 0) {
                    console.log(id, err);
                    response = {
                        status: 'error',
                        message: "Tool not found"
                    };
                    return res.json(response);
                } else {

                    var returnTool = thisTool.toJSON()[0];

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
                    var result = util.mysql2solr(returnTool);
                    solrClient.add(result, function(err, obj) {
                        if (err) {
                            console.log(err);
                            response = {
                                status: 'error',
                                message: "Error updating Solr"
                            };
                            return res.json(response);
                        } else {
                            console.log("Inserting", result.id);
                            solrClient.commit(function(err, result) {
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
                                        message: "Successfully inserted tool"
                                    };
                                    return res.json(response);
                                }
                            });
                        }
                    });
                }
            });
        })
        .catch(function(err) {
            console.log(err);
            response = {
                status: 'error',
                error: JSON.stringify(err)
            }
            return res.send(response);
        });
    console.log("Updating Solr", id);

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


module.exports = new ToolController();
