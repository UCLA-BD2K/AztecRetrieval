var Bookshelf = require('../../config/bookshelf.js');
Bookshelf.plugin('registry');

var Tool = require('./tool.js');

var Institution = Bookshelf.Model.extend({
    tableName: 'INSTITUTION',
    idAttribute: 'INST_NAME',
    tools: function () {
        return this.belongsToMany(Tool, 'TOOL_INSTITUTION', 'INST_NAME', 'AZID');
    }
});

module.exports = Bookshelf.model('Institution', Institution);
