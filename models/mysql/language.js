var Bookshelf = require('../../bookshelf.js');
Bookshelf.plugin('registry');

var Tool = require('./tool.js');

// define the schema for our tool model
var languageSchema = Bookshelf.Model.extend({

    tableName: 'LANGUAGE',
    idAttribute: 'LANG_ID',
    tools: function () {
        return this.belongsToMany('ToolInfo', 'TOOL_LANG', 'LANG_ID', 'AZID');
    }
});

// methods ======================


// create the model for tools and expose it to our app
module.exports = Bookshelf.model("Language", languageSchema);
