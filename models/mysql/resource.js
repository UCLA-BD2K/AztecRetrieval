var Bookshelf = require('../../config/bookshelf.js');
Bookshelf.plugin('registry');

var Resource = Bookshelf.Model.extend({
    tableName: 'RESOURCE_TYPE',
    idAttribute: 'RESOURCE_TYPE',
});

module.exports = Bookshelf.model('Resource', Resource);
