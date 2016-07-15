var Bookshelf = require('../../config/bookshelf.js');
Bookshelf.plugin('registry');

var Domain = Bookshelf.Model.extend({
    tableName: 'TOOL_DOMAINS',
    tools: function () {
        return this.hasMany('ToolInfo');
    }
});

module.exports = Bookshelf.model('Domain', Domain);
