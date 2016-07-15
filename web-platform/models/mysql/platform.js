var Bookshelf = require('../../config/bookshelf.js');
Bookshelf.plugin('registry');

var Platform = Bookshelf.Model.extend({
    tableName: 'PLATFORM',
    idAttribute: 'PLATFORM_ID',
    tool: function () {
        return this.belongsToMany('ToolInfo', 'TOOL_PLATFORM', 'PLATFORM_ID', 'AZID');
    }
});

module.exports = Bookshelf.model('Platform', Platform);
