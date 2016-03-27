var mongoose = require('mongoose');
var Author = require('./author.js');
var Maintainer = require('./maintainer.js');
var Link = require('./link.js');
var Version = require('./version.js');
var Funding = require('./funding.js');
var Publication = require('./publication.js');
var MissingInst = require('./missing_inst.js');

var toolSchema = mongoose.Schema({
    azid: Number,
    authors: [Author.schema],
    maintainers: [Maintainer.schema],
    links: [Link.schema],
    publications: [Publication.schema],
    versions: [Version.schema],
    funding: [Funding.schema],
    missing_inst: [MissingInst.schema]

});

module.exports = mongoose.model('Tool', toolSchema);
