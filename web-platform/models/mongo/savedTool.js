var mongoose = require('mongoose');

var toolSchema = mongoose.Schema({
    user: String,
    date: {type: Date, default: Date.now}
}, {strict: false});

module.exports = mongoose.model('SavedTool', toolSchema);
