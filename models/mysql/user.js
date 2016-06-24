var Bookshelf = require('../../config/bookshelf.js');
var Tool = require('./tool.js');
Bookshelf.plugin('registry');

// define the schema for our tool model
var userSchema = Bookshelf.Model.extend({

    tableName: 'TOOL_USER',
    tools: function() {
      return this.hasMany(Tool, 'TU_ID');
    }

});

// methods ======================


// create the model for tools and expose it to our app
module.exports = Bookshelf.model('User', userSchema);
