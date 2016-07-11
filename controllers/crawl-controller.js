/**
 * 	crawl-controller.js
 * 	author: Vincent Kyi <vincekyi@gmail.com>
 *
 * This file is the crawl controller for all routing related to extracting metadata from registries and updating the Aztec database.
 */

// Dependencies
var mongoose = require('mongoose');
var bookshelf = require('../config/bookshelf');
var BioJSPackages = require('../models/BioJSPackages.js');
var BioconductorPackages = require('../models/BioconductorPackages.js');
var CytoscapeServices = require('../CytoscapeServices.js');
/**
 * CrawlController
 * @constructor
 * Controller object declaration; this controller handles requests for retrieving and updating metadata from registries.
 */
function CrawlController(){

  // private member variables
  var self = this;

  // public member functions
  this.retrieve = function(req, res){ return self._retrieve(self, req, res); };

};

/**
 * HoneController._home
 * [Retrieves the home page; displays status of connections to all databases]
 * @param  {Object} self [Reference to controller object]
 * @param  {Request} req  [Incoming HTTP Request object]
 * @param  {Response} res  [HTTP Response object]
 * @return {HTTP Response}      [HTTP response; i.e. res.json, res.send]
 */
CrawlController.prototype._retrieve = function(self, req, res){
  var callback = function(err, message){
    if(!err){
      return res.send(message);
    }
    else{
      console.log(err);
      return res.send("Retrieval error.");
    }
  };

  return new CytoscapeServices().retrieve(callback);

};

module.exports = new CrawlController();
