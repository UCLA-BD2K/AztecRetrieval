var mongoose = require('mongoose');

var missing_instSchema = mongoose.Schema({
    new_institution: String
});

module.exports = mongoose.model('Missing_Inst', missing_instSchema);
