var mongoose = require('mongoose');

var fundingSchema = mongoose.Schema({
    agency_id: Number,
    funding_agency: String,
    funding_grant: String
});

module.exports = mongoose.model('Funding', fundingSchema);
