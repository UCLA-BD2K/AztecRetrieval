/**
 * 	app.js
 * 	author: Vincent Kyi <vincekyi@gmail.com>
 *
 * This file is the main server file for starting the web application.
 */

//  Dependencies
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');


var app = express();

// view engine setup
app.use('/public', express.static('public'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

// log setup
app.use(logger('dev'));

// request body parser setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

// cookie parser setup
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// routes setup
var routes = require('./routes/index');
app.use('/', routes);

// mongoose (MongoDB handler framework) setup
var mongoose = require('mongoose');
var configMongo = require('./config/mongo.js');
mongoose.connect(configMongo.url); // connect to our database

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        return res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    return res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;
