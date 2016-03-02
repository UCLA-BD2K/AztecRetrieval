var express = require('express');
var fs = require('fs');
var path = require('path');
var BiocatalogServices = require('../BiocatalogServices.js');

var router = express.Router();

router.get(['/','/latest'], function(req, res, next) {
    var latest = new BiocatalogServices().latest();
    if (latest == null) {
        res.json({});
    } else {
        fs.readFile(path.resolve(latest), "utf-8", function(err, data) {
            if (err) {
                return console.log(err);
            }

            res.json(JSON.parse(data));
        });
    }
});

router.get('/update', function(req, res, next) {
    res.send(new BiocatalogServices().update())
});

router.get('/retrieve', function(req, res, next) {
    res.send(new BiocatalogServices().retrieve());
});

module.exports = router;
