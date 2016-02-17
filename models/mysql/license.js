var Bookshelf = require('../../bookshelf.js');
Bookshelf.plugin('registry');

var License = Bookshelf.Model.extend({
    tableName: 'TOOL_LICENSE',
    idAttribute: 'LICENSE_ID',
    tool: function () {
        return this.hasMany('ToolInfo');
    }
});

module.exports = Bookshelf.model('License', License);
