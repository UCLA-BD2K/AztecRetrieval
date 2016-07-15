/**
 * index.js [Router]
 * author: Vincent Kyi <vincekyi@gmail.com>
 *
 * Main router file: This file contains all the routes (URLs) for this web applicatoin
 */

// Dependencies
var express = require('express');
var HomeController = require('../controllers/home-controller');
var ToolController = require('../controllers/tool-controller');
var CrawlController = require('../controllers/crawl-controller');


// Router object
var router = express.Router();

// GET home page
router.get('/', HomeController.home);

// RESTful API: Tool
router.get('/tool/:id', ToolController.show);
router.get('/solrFile', ToolController.toSolrFile);

// Retrieve tools from registries
router.get('/biojs/retrieve', CrawlController.retrieve("biojs"));
router.get('/bioconductor/retrieve', CrawlController.retrieve("bioconductor"));
router.get('/cytoscape/retrieve', CrawlController.retrieve("cytoscape"));
router.get('/sourceforge/retrieve', CrawlController.retrieve("sourceforge"));

// Updates tools to database
router.get('/biojs/update', CrawlController.update("biojs"));
router.get('/bioconductor/update', CrawlController.update("bioconductor"));
router.get('/cytoscape/update', CrawlController.update("cytoscape"));
router.get('/sourceforge/update', CrawlController.update("sourceforge"));


module.exports = router;
