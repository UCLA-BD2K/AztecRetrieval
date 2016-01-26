var Bookshelf = require('../../bookshelf.js');
Bookshelf.plugin('registry');

var Tool = require('./tool.js');

// define the schema for our tool model
var platformSchema = Bookshelf.Model.extend({

    tableName: 'PLATFORM',
    idAttribute: 'PLATFORM_ID',
    tool: function () {
        return this.belongsToMany('ToolInfo', 'TOOL_PLATFORM', 'PLATFORM_ID', 'AZID');
    }

});

// methods ======================


// create the model for tools and expose it to our app
module.exports = Bookshelf.model("Platform", platformSchema);
