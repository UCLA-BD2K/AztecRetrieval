var Bookshelf = require('../../config/bookshelf.js');
Bookshelf.plugin('registry');

var Tag = Bookshelf.Model.extend({
    tableName: 'TAG',
    idAttribute: 'TAG_ID',
    tools: function () {
        return this.belongsToMany('ToolInfo', 'TOOL_TAG', 'TAG_ID', 'AZID');
    }
});

module.exports = Bookshelf.model('Tag', Tag);
