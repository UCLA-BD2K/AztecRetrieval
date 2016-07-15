var mongoose = require('mongoose');

var linkSchema = mongoose.Schema({
    name: String,
    url: String
});

module.exports = mongoose.model('Link', linkSchema);
