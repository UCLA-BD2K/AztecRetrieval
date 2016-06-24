var express = require('express');
var fs = require('fs');
var path = require('path');
var AztecInputs = require('../AztecUserInput.js');

var router = express.Router();

router.get(['/', '/latest'], function (req, res, next) {
    var latest = new AztecInputs().latest();
    if (latest == null) {
        res.json({});
    } else {
        fs.readFile(path.resolve(latest), "utf-8", function (err, data) {
            if (err) {
                return console.log(err);
            }

            return res.json(JSON.parse(data));
        });
    }
});

router.get('/retrieve', function (req, res, next) {
    res.send(new AztecInputs().retrieve());
});

router.get('/update', function (req, res, next) {
    res.send(new AztecInputs().update())
});

router.get('/retrieveAndUpdate', function (req, res, next) {
    res.send(new AztecInputs().retrieveAndUpdate());
});

module.exports = router;
