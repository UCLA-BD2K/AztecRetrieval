/**
 * Sourceforge Repositories handler.
 * Created by Brian Bleakley on 01/14/2016.
 */

var fs = require("fs");
var request = require("request");
var sf_miner = require("./sf_miner/sf_miner1");
var path = require("path");

var platformSchema = require("./models/mysql/platform");
var languageSchema = require("./models/mysql/language");
var relatedLinksSchema = require("./models/mysql/relatedLinks");
var toolSchema = require("./models/mysql/tool");
var domainSchema = require("./models/mysql/domain");
var resourceSchema = require("./models/mysql/resource");
var licenceSchema = require("./models/mysql/license");
var tagSchema = require("./models/mysql/tag");
var authorSchema = require("./models/mysql/author");

var OUTFILE_DIRECTORY = "public/sourceforge/";
var OUTFILE_TEMP_DIRECTORY = OUTFILE_DIRECTORY + "temp/";
var OUTFILE_BASE_NAME = "sourceforge_repositories";

var TOOL_TYPE = "sourceforge";

/**
 * @constructor
 */
var SourceforgeRepositories = function () {
};

// Write to file
var writeToFile = function() {
    // Write initial data
    fs.appendFileSync(OUTFILE_TEMP_DIRECTORY + outfileName,
        "{\n" +
        "\"type\": \"sourceforge\",\n" +
        "\"date\": \"" + date.toISOString() + "\",\n" +
        "\"data\": [\n");

    // Write data
    fs.appendFileSync(OUTFILE_TEMP_DIRECTORY + outfileName, results);

    // Write closing brackets and braces
    fs.appendFileSync(OUTFILE_TEMP_DIRECTORY + outfileName, "\n]\n}\n");

    // Move file out of temp directory when complete
    fs.renameSync(OUTFILE_TEMP_DIRECTORY + outfileName,
        OUTFILE_DIRECTORY + outfileName);
    console.log("Complete: " + outfileName);
}

/**
 * Returns the latest outfile.
 * @returns {string|String}
 */
SourceforgeRepositories.latest = function () {
    var latest = null;
    var files = fs.readdirSync(OUTFILE_DIRECTORY);

    for (var i = 0; i < files.length; i++) {
        // Check relevant files only
        if (files[i].slice(0, OUTFILE_BASE_NAME.length) != OUTFILE_BASE_NAME) {
            continue;
        }

        // Update latest file
        var current = OUTFILE_DIRECTORY + files[i];
        if (latest == null) {
            latest = current;
        } else {
            var curr_time = fs.statSync(current).mtime.getTime();
            var latest_time = fs.statSync(latest).mtime.getTime();
            if (curr_time > latest_time) {
                latest[i] = current;
            }
        }
    }

    return latest;
};

SourceforgeRepositories.retrieve = function () {
    // Create directories if necessary
    if (!fs.existsSync(OUTFILE_DIRECTORY)) {
        fs.mkdirSync(OUTFILE_DIRECTORY);
    }

    if (!fs.existsSync(OUTFILE_TEMP_DIRECTORY)) {
        fs.mkdirSync(OUTFILE_TEMP_DIRECTORY);
    }

    // Generate new timestamped outfile name
    var date = new Date();
    var outfileName = OUTFILE_BASE_NAME + "_" + date.toISOString().replace(/:/g, "-") + ".json";

    var category_hash = {};
    var results = "";

    // Run sf_miner1 and sf_miner2
    sf_miner.runRemotely();
                                                
};

SourceforgeRepositories.update = function () {

    // Read JSON data
    var json = require(path.resolve(SourceforgeRepositories.latest()));
    if (json.type != TOOL_TYPE || !json.data) {
        console.log(json.type);
        return false;
    }

    console.log(json.data.length);

    for (var i in json.data) {

        (function (data) {
                toolSchema.where({NAME: data.res_name}).fetch().then(function (tool) {
                    if (!tool) {
                        console.log("Inserting " + data.res_name);
                        toolSchema.forge({
                            NAME: data.res_name,
                            DESCRIPTION: data.res_desc,
                            SOURCE_LINK: data.dev.res_code_url,
                        }).save().then(function (newTool) {
                            SourceforgeRepositories.updateTool(newTool, data);
                        });
                    } else {
                        SourceforgeRepositories.updateTool(tool, data);
                    }

                });

        }) (json.data[i]);

    }
};

SourceforgeRepositories.updateTool = function (tool, data) {
    console.log("Updating " + data.res_name);

    var azid = tool.get("AZID");

    // Attach language
    if (data.dev.dev_lang[0]!= null) {
        languageSchema.where({NAME: data.dev.dev_lang[0]}).fetch().then(function (language) {
            if (language) {
                tool.languages().attach(language);
            } else {
                languageSchema.forge({NAME: data.dev.dev_lang[0]}).save().then(function (newLanguage) {
                    tool.languages().attach(newLanguage);
                });
            }
        });
    }

    // Attach platforms
    if (data.dev_platform != null) {
        for (var i in data.platforms) {
            (function (platformName) {
                platformSchema.where({NAME: platformName}).fetch().then(function (platform) {
                    if (platform) {
                        tool.platform().attach(platform);
                    } else {
                        platformSchema.forge({NAME: platformName}).save().then(function (newPlatform) {
                            tool.platform().attach(newPlatform);
                        });
                    }
                });
            })(data.platforms[i]);
        }
    }

    //Save related links
    if (data.links != null) {
        for (var linkIndex in data.links) {
            (function (linkName, linkURL) {
                relatedLinksSchema.where({AZID: azid, URL: linkURL}).fetch().then(function (link) {
                    if (!link) {
                        relatedLinksSchema.forge({AZID: azid, TYPE: linkName, URL: linkURL}).save();
                    }
                });
            })(data.links[linkIndex].link_name, data.links[linkIndex].link_url);
        }
    }

    //Sourceforge tools seem to have no domains

    //Sourceforge tools seem to have no resource type

    //save licences
    if (data.license.license!= null) {
        licenceSchema.where({NAME: data.license.license}).fetch().then(function (license) {
            if (license) {
                tool.license().attach(license);
            } else {
                licenceSchema.forge({NAME: data.license.license}).save().then(function (newLicense) {
                    tool.license().attach(newLicense);
                });
            }
        });
    }

    //save tag

    if (data.tags != null) {
        for (var tagsIndex in data.tags) {
            (function (tagName) {
                tagSchema.where({NAME: tagName}).fetch().then(function (tag) {
                    if (tag) {
                        tool.tags().attach(tag);
                    } else {
                        tagSchema.forge({NAME: tagName}).save().then(function (newTag) {
                            tool.tags().attach(newTag);
                        });
                    }
                });
            })(data.tags[tagsIndex].text);
        }
    }

    //save authors
    if (data.authors != null) {
        for (var authorsIndex in data.authors) {
            (function (authorName) {
                var names = authorName.split(/[ ,]+/);
                var first = names[0];
                var last = names[1];
                authorSchema.where({FIRST_NAME: first, LAST_NAME: last}).fetch().then(function (author) {
                    if (author) {
                        tool.authors().attach(author);
                    } else {
                        authorSchema.forge({
                            FIRST_NAME: first,
                            LAST_NAME: last,
                        }).save().then(function (newAuthor) {
                            tool.authors().attach(newAuthor);
                        });
                    }
                });
            })(data.authors[authorsIndex].author_name);
        }
    }

};

module.exports = SourceforgeRepositories;
