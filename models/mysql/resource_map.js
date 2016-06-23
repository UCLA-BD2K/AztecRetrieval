var Bookshelf = require('../../config/bookshelf.js');
Bookshelf.plugin('registry');

var ResourceMap = Bookshelf.Model.extend({
    tableName: 'TOOL_RESOURCE',
    tool: function () {
        return this.hasMany(Tool, 'TR_ID');
    }
});

module.exports = Bookshelf.model('ResourceMap', ResourceMap);
