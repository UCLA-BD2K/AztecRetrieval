var mongoose = require('mongoose');

var versionSchema = mongoose.Schema({
    version: String,
    date: Date,
    description: String,
    latest: {type: Boolean, default: false}
});

module.exports = mongoose.model('Version', versionSchema);
