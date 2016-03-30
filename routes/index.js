var express = require('express');
var router = express.Router();
var updater = require('../update.js');
var mongoose = require('mongoose');

/* GET home page. */
router.get('/', function (req, res, next) {
    // Verify database connections
    var bookshelfStatus = "UNKNOWN"; // TODO: Get Bookshelf status
    var mongoStatus = mongoose.connection.readyState ? "READY" : "CONNECTION FAILED";
    var solrStatus = "UNKNOWN"; // TODO: Get Solr status

    res.render('index', {
        title: 'Aztec Retrieval',
        bookshelfStatus: bookshelfStatus,
        mongoStatus: mongoStatus,
        solrStatus: solrStatus});
});

router.get('/update', function (req, res, next) {
    updater.update();
    res.send("Updating all resources.");
});

module.exports = router;
