var express = require('express');
var fs = require('fs');
var path = require('path');
var BiocatalogServices = require('../BiocatalogServices.js');

var router = express.Router();

router.get(['/','/latest'], function(req, res, next) {
    var latest = BiocatalogServices.latest();
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

router.get('/retrieve', function(req, res, next) {
    res.send(BiocatalogServices.retrieve());
});

module.exports = router;
