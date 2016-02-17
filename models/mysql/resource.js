var Bookshelf = require('../../bookshelf.js');
Bookshelf.plugin('registry');

var Resource = Bookshelf.Model.extend({
    tableName: 'RESOURCE',
    idAttribute: 'RESOURCE_ID',
    tool: function () {
        return this.belongsToMany('ToolInfo', 'TOOL_RESOURCE', 'RESOURCE_ID', 'AZID');
    }
});

module.exports = Bookshelf.model('Resource', Resource);
