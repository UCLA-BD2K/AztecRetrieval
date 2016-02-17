var Bookshelf = require('../../bookshelf.js');
Bookshelf.plugin('registry');

var languageSchema = Bookshelf.Model.extend({
    tableName: 'LANGUAGE',
    idAttribute: 'LANG_ID',
    tools: function () {
        return this.belongsToMany('ToolInfo', 'TOOL_LANG', 'LANG_ID', 'AZID');
    }
});

module.exports = Bookshelf.model('Language', languageSchema);
