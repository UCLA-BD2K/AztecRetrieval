var mongoose = require('mongoose');

var fundingSchema = mongoose.Schema({
    agency_id: Number,
    agency: String,
    grant: String
});

module.exports = mongoose.model('Funding', fundingSchema);
