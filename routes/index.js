var express = require('express');
var router = express.Router();
var updater = require('../update.js');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Aztec Retrieval' });
});

router.get('/update', function(req, res, next) {
  updater.update();
  res.send("Updating all resources.");
});

module.exports = router;
