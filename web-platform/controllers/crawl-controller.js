/**
 * 	crawl-controller.js
 * 	author: Vincent Kyi <vincekyi@gmail.com>
 *
 * This file is the crawl controller for all routing related to extracting metadata from registries and updating the Aztec database.
 */

// Dependencies
var mongoose = require('mongoose');
var bookshelf = require('../config/bookshelf');
var BioJSPackages = require('../models/registries/BioJSPackages');
var BioconductorPackages = require('../models/registries/BioconductorPackages');
var CytoscapeServices = require('../models/registries/CytoscapeServices');
var SourceforgeRepositories = require('../models/registries/SourceforgeRepositories');
/**
 * CrawlController
 * @constructor
 * Controller object declaration; this controller handles requests for retrieving and updating metadata from registries.
 */
function CrawlController(){

  // private member variables
  var self = this;

  // public member functions
  this.retrieve = function(registry){ return function(req, res){ return self._retrieve(self, registry, req, res);} };
  this.update = function(registry){ return function(req, res){ return self._update(self, registry, req, res);} };

};

/**
 * CrawlController._retrieve
 * [Retrieves the metadata from specified registry]
 * @param  {Object} self [Reference to controller object]
 * @param {String} registry [Name of the regsitry]
 * @param  {Request} req  [Incoming HTTP Request object]
 * @param  {Response} res  [HTTP Response object]
 * @return {HTTP Response}      [HTTP response; i.e. res.json, res.send]
 */
CrawlController.prototype._retrieve = function(self, registry, req, res){
  var callback = function(err, message){
    if(!err){
      return res.send(message);
    }
    else{
      console.log(err);
      return res.send("Retrieval error.");
    }
  };
  var retriever = null;
  switch(registry){
    case 'bioconductor':
      retriever = new BioconductorPackages();
      break;
    case 'biojs':
      retriever = new BioJSPackages();
      break;
    case 'cytoscape':
        retriever = new CytoscapeServices();
        break;
    case 'sourceforge':
      retriever = new SourceforgeRepositories();
      break;
    default:
      return res.send("Invalid registry name.");
  }

  return retriever.retrieve(callback);

};

/**
 * CrawlController._update
 * [Updates the MySQL with metadata from specified registry]
 * @param  {Object} self [Reference to controller object]
 * @param {String} registry [Name of the regsitry]
 * @param  {Request} req  [Incoming HTTP Request object]
 * @param  {Response} res  [HTTP Response object]
 * @return {HTTP Response}      [HTTP response; i.e. res.json, res.send]
 */
CrawlController.prototype._update = function(self, registry, req, res){
  var callback = function(err, message){
    if(!err){
      return res.send(message);
    }
    else{
      console.log(err);
      return res.send("Retrieval error.");
    }
  };
  var updater = null;
  switch(registry){
    case 'bioconductor':
      retriever = new BioconductorPackages();
      break;
    case 'biojs':
      retriever = new BioJSPackages();
      break;
    case 'cytoscape':
        retriever = new CytoscapeServices();
        break;
    case 'sourceforge':
      retriever = new SourceforgeRepositories();
      break;
    default:
      return res.send("Invalid registry name.");
  }

  return retriever.update(callback);

};

module.exports = new CrawlController();
