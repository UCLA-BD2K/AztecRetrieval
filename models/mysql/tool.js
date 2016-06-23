var Bookshelf = require('../../config/bookshelf.js');
Bookshelf.plugin('registry');

var Platform = require('./platform.js');
var Tag = require('./tag.js');
var Resource = require('./resource_map.js');
var Language = require('./language.js');
var Institution = require('./institution.js');

var Tool = Bookshelf.Model.extend({
    tableName: 'TOOL_INFO',
    idAttribute: 'AZID',
    hasTimestamps: ['SUBMIT_DATE', 'LAST_UPDATED'],
    domains: function () {
        return this.hasMany('Domain', 'AZID');
    },
    institutions: function () {
        return this.belongsToMany('Institution', 'TOOL_INSTITUTION', 'AZID', 'INST_NAME');
    },
    languages: function () {
        return this.belongsToMany('Language', 'TOOL_LANG', 'AZID', 'LANG_ID');
    },
    platforms: function () {
        return this.belongsToMany('Platform', 'TOOL_PLATFORM', 'AZID', 'PLATFORM_ID');
    },
    resources: function () {
        return this.hasMany(Resource, 'AZID');
    },
    tags: function () {
        return this.belongsToMany('Tag', 'TOOL_TAG', 'AZID', 'TAG_ID');
    }
});

module.exports = Bookshelf.model('ToolInfo', Tool);
