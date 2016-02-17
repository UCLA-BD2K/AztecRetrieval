var Bookshelf = require('../../bookshelf.js');
Bookshelf.plugin('registry');

var Tool = require('./tool.js');

var Institution = Bookshelf.Model.extend({
    tableName: 'INSTITUTION',
    idAttribute: 'INST_ID',
    tools: function () {
        return this.belongsToMany(Tool, 'TOOL_INSTITUTION', 'INST_ID', 'AZID');
    }
});

module.exports = Bookshelf.model('Institution', Institution);
