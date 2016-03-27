var mongoose = require('mongoose');

var maintainerSchema = mongoose.Schema({
    first_name: String,
    last_name: String,
    maintainer_email: String
});

module.exports = mongoose.model('Maintainer', maintainerSchema);
