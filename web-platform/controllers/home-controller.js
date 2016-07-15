/**
 * 	home-controller.js
 * 	author: Vincent Kyi <vincekyi@gmail.com>
 *
 * This file is the main controller for all routing related to accessing static pages.
 */

// Dependencies
var mongoose = require('mongoose');
var bookshelf = require('../config/bookshelf');

/**
 * HomeController
 * Controller object declaration; this controller handles requests for static pages.
 */
function HomeController(){

  // private member variables
  var self = this;

  // public member functions
  this.home = function(req, res){ return self._home(self, req, res); };

};

/**
 * HoneController._home
 * [Retrieves the home page; displays status of connections to all databases]
 * @param  {Object} self [Reference to controller object]
 * @param  {Request} req  [Incoming HTTP Request object]
 * @param  {Response} res  [HTTP Response object]
 * @return {HTTP Response}      [HTTP response; i.e. res.json, res.send]
 */
HomeController.prototype._home = function(self, req, res){
  // Verify database connections
  var bookshelfStatus = bookshelf.knex.connection().client.pool.available.length>0 ? "READY": "CONNECTION FAILED"; // Get Bookshelf status
  var mongoStatus = mongoose.connection.readyState ? "READY" : "CONNECTION FAILED";
  var solrStatus = "UNKNOWN"; // TODO: Get Solr status

  return res.render('index', {
      title: 'Aztec Retrieval',
      bookshelfStatus: bookshelfStatus,
      mongoStatus: mongoStatus,
      solrStatus: solrStatus});
};

module.exports = new HomeController();
