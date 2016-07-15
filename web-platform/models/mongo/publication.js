var mongoose = require('mongoose');

var publicationSchema = mongoose.Schema({
    pub_doi: String,
    primary: {type: Boolean, default: false}
});

module.exports = mongoose.model('Publication', publicationSchema);
