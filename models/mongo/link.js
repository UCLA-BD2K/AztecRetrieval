var mongoose = require('mongoose');

var linkSchema = mongoose.Schema({
    link_name: String,
    link_url: String
});

module.exports = mongoose.model('Link', linkSchema);
