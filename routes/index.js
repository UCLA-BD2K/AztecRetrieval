/**
 * index.js [Router]
 * author: Vincent Kyi <vincekyi@gmail.com>
 *
 * Main router file: This file contains all the routes (URLs) for this web applicatoin
 */

// Dependencies
var express = require('express');
var updater = require('../update');
var HomeController = require('../controllers/home-controller');
var ToolController = require('../controllers/tool-controller');
var CrawlController = require('../controllers/crawl-controller');


// Router object
var router = express.Router();

/* GET home page. */
router.get('/', HomeController.home);

router.get('/update', function (req, res, next) {
    updater.update();
    res.send("Updating all resources.");
});


// RESTful API: Tool
router.get('/tool/:id', ToolController.show);
router.get('/tool', ToolController.showAll);
router.get('/solrFile', ToolController.toSolrFile);
router.get('/biojs', CrawlController.retrieve);


module.exports = router;
