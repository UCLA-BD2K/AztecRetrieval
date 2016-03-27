var mongoose = require('mongoose');

var versionSchema = mongoose.Schema({
    version_number: String,
    version_date: Date,
    version_description: String,
    latest: {type: Boolean, default: false}
});

module.exports = mongoose.model('Version', versionSchema);
