/**
 * Retriever.js [Retriever superclass]
 * author: Alan Kha on 3/2/2016.
 * updated by: Vincent Kyi <vincekyi@gmail.com>
 *
 * Retrieve super class used to extract metadata from sources and insert into MySQL database.
 */

// Dependencies
var fs = require("fs");
var path = require("path");

// MySQL models
var Domain = require("./models/mysql/domain");
var Institution = require("./models/mysql/institution");
var Platform = require("./models/mysql/platform");
var Language = require("./models/mysql/language");
var License = require("./models/mysql/license");
var Resource = require("./models/mysql/resource");
var ResourceMap = require("./models/mysql/resource_map");
var Tag = require("./models/mysql/tag");
var User = require("./models/mysql/user");
var Tool = require("./models/mysql/tool");

// Mongo models
var M_tool = require('./models/mongo/tool');
var M_author = require('./models/mongo/author');
var M_link = require('./models/mongo/link');
var M_maintainer = require('./models/mongo/maintainer');
var M_version = require('./models/mongo/version');

var solrClient = require('./config/solr');

/**
 * Retriever [Model for retrieving and updating MySQL database. Acts as superclass]
 * @constructor
 * @param {String} resourceType [The name of the registry in which information is being extracted.]
 */
function Retriever(resourceType) {
    var self = this;

    // member variables
    this.RESOURCE_TYPE = resourceType;
    this.OUTFILE_DIRECTORY = "public/" + resourceType + "/";
    this.OUTFILE_TEMP_DIRECTORY = this.OUTFILE_DIRECTORY + "temp/";


    // member functions
    this.retrieveAndUpdate = function(callback){ return self._retrieveAndUpdate(self, callback); };
    this.latest = function(){ return self._latest(self); };
    this.update = function(callback){ return self._update(self, callback); };
    this.getNewFile = function(){ return self._getNewFile(self); };
};

/**
 * Retriever.retrieve
 * [The "virtual" function that must be implemented by the subclass. This function should extract metadata from the source.]
 * @param  {Object} self [Reference to Retriever object]
 * @param  {Function} callback [ A callback function that takes in 2 paramters:
 *                             		1 An error object
 *                               	2 The result message (string or object) ]
 * @return {Function}            [The callback function]
 */
Retriever.prototype.retrieve = function(callback) {
    // by default, return error
    return callback(new Error("Retriever.retrieve() not implemented"), null);
};

/**
 * Retriever._retrieveAndUpdate
 * [This function retrieves the metadata from the source and updates the metadata to the MySQL database]
 * @param  {Object} self [Reference to Retriever object]
 * @param  {Function} callback [ A callback function that takes in 2 paramters:
 *                             		1 An error object
 *                               	2 The result message (string or object) ]
 * @return {Function}            [The callback function]
 */
Retriever.prototype.retrieveAndUpdate = function(self, callback) {
    self.retrieve(function(err, data) {
        if (!err) {
            return self.update(callback);
        }
        else{
          return callback(new Error("Retrieval error"), null);
        }
    });
};

/**
 * Retriever._latest
 *
 * [This function retrieves the metadata file that is the most up-to-date based on the file's creation time.]
 * @param  {Object} self [Reference to Retriever object]
 * @return {String} [Path to the new file generated]
 */
Retriever.prototype.latest = function(self) {
    var latest_file = null;
    var files = fs.readdirSync(self.OUTFILE_DIRECTORY);

    for (var i = 0; i < files.length; i++) {
        // Check relevant files only
        if (files[i].slice(0, self.RESOURCE_TYPE.length) != self.RESOURCE_TYPE) {
            continue;
        }

        // Update latest file
        var current = self.OUTFILE_DIRECTORY + files[i];
        if (latest_file == null) {
            latest_file = current;
        } else {
            var curr_time = fs.statSync(current).mtime.getTime();
            var latest_time = fs.statSync(latest).mtime.getTime();
            // get the latest file based on creation time
            if (curr_time > latest_time) {
                latest_file = current;
            }
        }
    }

    return latest_file;
};

/**
 * [This function updates the MySQL database using the latest file retrieved from the registry.]
 * @param  {Object} self [Reference to Retriever object]
 * @param  {Function} callback [Callback function that runs after the update. Takes in 2 paramters:
 *                             		1 An error object
 *                               	2 The result message (string or object) ]
 * @return {Function}            [The callback function]
 */
Retriever.prototype._update = function(self, callback) {
    // Read JSON data
    var json = require(path.resolve(this.latest()));
    if(!json){
      return callback(new Error("Cannot find metadata JSON file for "+self.RESOURCE_TYPE), null);
    }
    // type checking for the file
    var resourceType = typeof json;
    if (resourceType != "object") {
        return callback(new Error("Invalid type for metadata JSON file for "+self.RESOURCE_TYPE), null);
    }

    // iterate through each resource in metadata JSON file
    Promise.all(json.map(function(data) {

        // Helper function to update each tool
        // TODO: Relations are likely to be kept if attributes change. Investigate pruning invalid relations on update.
        var updateTool = function(tool, data) {
            console.log("Updating " + self.RESOURCE_TYPE + "." + data.name);
            var azid = tool.get("AZID");

            // Create Mongo object
            var mongoTool = M_tool({
                azid: azid
            });



            // Authors (Mongo)
            if (data.authors != null) {
                for (var authorsIndex in data.authors) {
                    // extract email
                    var authorEmail = null;
                    if (data.authorEmails != null) {
                        authorEmail = data.authorEmails[authorsIndex];
                        if (authorEmail == '') {
                            authorEmail = null;
                        }
                    }

                    // extract author name
                    var authorName = data.authors[authorsIndex];
                    var first = null,
                        last = null;
                    if (authorName != null) {
                        var names = authorName.split(/[ ,]+/);
                        first = names[0];
                        last = names[1];
                    }

                    // create Mongo model for author
                    var m_author = new M_author;
                    m_author.first_name = first;
                    m_author.last_name = last;
                    m_author.email = authorEmail;
                    mongoTool.authors.push(m_author);
                }

            }

            // Domains (MySQL)
            if (data.domains != null) {
                Promise.all(data.domains.map((function(domainName) {
                    Domain.where({
                            AZID: azid,
                            DOMAIN: domainName
                        }).fetch()
                        .then(function(domain) {
                            if (domain == null) {
                                domain = new Domain({
                                    AZID: azid,
                                    DOMAIN: domainName
                                }).save();
                            }
                        })
                })));
            }

            // Institutions (MySQL)
            if (data.institutions != null) {
                Promise.all(data.institutions.map((function(institutionName) {
                    var institution = Institution.forge({
                        INST_NAME: institutionName
                    });
                    // add new institutions to MySQL database
                    institution.save()
                        .catch(function(err) {
                            // Suppress duplicate errors
                            if (err.code != "ER_DUP_ENTRY") {
                                console.log(err);
                            }
                        });
                    // attach insitutions to tool model
                    institution.fetch()
                        .then(function(result) {
                            tool.institutions().attach(result)
                                .catch(function(err) {
                                    // Suppress duplicate errors for preexisting relations
                                    if (err.code != "ER_DUP_ENTRY") {
                                        console.log(err);
                                    }
                                });
                        });
                })));

            }

            // Language (MySQL)
            if (data.language != null) {
                // Convert single strings to an array if necessary
                var languages = [data.language];
                if (Object.prototype.toString.call(data.language) === "[object Array]") {
                    languages = data.language;
                }
                // add new lanaguages to MySQL database
                if (languages.length > 0) {
                    Promise.all(languages.map((function(languageName) {
                        if (languageName != null && languageName != "") {
                            var language = Language.forge({
                                NAME: languageName
                            });
                            language.save()
                                .catch(function(err) {
                                    // Suppress duplicate errors
                                    if (err.code != "ER_DUP_ENTRY") {
                                        console.log(err);
                                    }
                                });
                            // attach languages to tool model
                            language.fetch()
                                .then(function(result) {
                                    tool.languages().attach(result)
                                        .catch(function(err) {
                                            // Suppress duplicate errors for preexisting relations
                                            if (err.code != "ER_DUP_ENTRY") {
                                                console.log(err);
                                            }
                                        });
                                });
                        }
                    })));

                }
            }

            // Licenses (MySQL)
            if (data.licenses != null) {
                for (var licenseIndex in data.licenses) {
                    (function(licenseName) {
                        // Use link as name if necessary
                        if (licenseName == null || licenseName == "") {
                            console.log("Invalid license for " + data.name);
                            return null;
                        }

                        License.where({
                                AZID: azid,
                                NAME: licenseName
                            }).fetch()
                            .then(function(license) {
                                if (license == null) {
                                    new License({
                                        AZID: azid,
                                        NAME: licenseName,
                                    }).save();
                                }
                            });
                    })(data.licenses[licenseIndex]);
                }

            }

            // Maintainers (Mongo)
            if (data.maintainers != null) {
                for (var maintainerIndex in data.maintainers) {
                    (function(maintainerName, maintainerEmail) {
                        if (maintainerEmail == '') {
                            maintainerEmail = null;
                        }
                        var names = maintainerName.split(/[ ,]+/);
                        var first = names[0];
                        var last = names[1];

                        var m_maintainer = new M_maintainer;
                        m_maintainer.first_name = first;
                        m_maintainer.last_name = last;
                        m_maintainer.email = maintainerEmail;
                        mongoTool.maintainers.push(m_maintainer);

                    })(data.maintainers[maintainerIndex], data.maintainerEmails[maintainerIndex]);
                }

            }

            // Platforms (MySQL)
            if (data.platforms != null) {
                Promise.all(data.platforms.map((function(platformName) {
                    if (platformName == 'OS Portable (Source code to work with many OS platforms)') {
                        platformName = 'OS Portable';
                    } else if (platformName == 'OS Independent (Written in an interpreted language)') {
                        platformName = 'OS Independent';
                    } else if (platformName == 'All BSD Platforms (FreeBSD/NetBSD/OpenBSD/Apple Mac OS X)') {
                        platformName = 'All BSD Platforms';
                    } else if (platformName = 'Modern (Vendor-Supported) Desktop Operating Systems') {
                        platformName = 'Linux';
                    }

                    var platform = Platform.forge({
                        NAME: platformName
                    });
                    platform.save()
                        .catch(function(err) {
                            // Suppress duplicate errors
                            if (err.code != "ER_DUP_ENTRY") {
                                console.log(err);
                            }
                        });

                    platform.fetch()
                        .then(function(result) {
                            tool.platforms().attach(result)
                                .catch(function(err) {
                                    // Suppress duplicate errors for preexisting relations
                                    if (err.code != "ER_DUP_ENTRY") {
                                        console.log(err);
                                    }
                                });
                        });
                })));
            }

            // Related links (Mongo)
            if (data.linkUrls != null) {
                for (var linkIndex in data.linkUrls) {
                    (function(linkURL, linkDescription) {
                        var m_link = new M_link;
                        m_link.name = linkDescription;
                        m_link.url = linkURL;
                        mongoTool.links.push(m_link);
                    })(data.linkUrls[linkIndex], data.linkDescriptions[linkIndex]);
                }
            }

            // Types (MySQL)
            if (data.types != null) {
                Promise.all(data.types.map((function(resourceType) {
                    var resource = Resource.forge({
                        RESOURCE_TYPE: resourceType
                    });
                    resource.save()
                        .catch(function(err) {
                            // Suppress duplicate errors
                            if (err.code != "ER_DUP_ENTRY") {
                                console.log(err);
                            }
                        });

                    resource.fetch()
                        .then(function(result) {
                            if (result != null) {
                                var resourceMap = {};
                                resourceMap.AZID = azid;
                                resourceMap.RESOURCE_TYPE = result.attributes.RESOURCE_TYPE;
                                ResourceMap.forge(resourceMap)
                                    .save()
                                    .catch(function(err) {
                                        // Suppress duplicate errors for preexisting relations
                                        if (err.code != "ER_DUP_ENTRY") {
                                            console.log(err);
                                        }
                                    });
                            }
                        });
                })));
            }

            // Users (MySQL)
            if (data.owners != null) {
                Promise.all(data.owners.map((function(owner) {
                    var tool_user = User.forge({
                        AZID: azid,
                        USER: owner
                    });
                    tool_user.save()
                        .catch(function(err) {
                            // Suppress duplicate errors
                            if (err.code != "ER_DUP_ENTRY") {
                                console.log(err);
                            }
                        });
                })));
            }

            // Tags (MySQL)
            if (data.tags != null) {
                // TODO: Filter for repeat tags
                Promise.all(data.tags.map((function(tagName) {
                    var tag = Tag.forge({
                        NAME: tagName
                    });
                    // add new tags to MySQL database
                    tag.save()
                        .catch(function(err) {
                            // Suppress duplicate errors
                            if (err.code != "ER_DUP_ENTRY") {
                                console.log(err);
                            }
                        });
                    // attach tags to tool model
                    tag.fetch()
                        .then(function(result) {
                            tool.tags().attach(result)
                                .catch(function(err) {
                                    // Suppress duplicate errors for preexisting relations
                                    if (err.code != "ER_DUP_ENTRY") {
                                        console.log(err);
                                    }
                                });
                        });
                })));

            }

            // Version (Mongo)
            if (data.versionNum != null) {
                var m_version = new M_version;
                m_version.version = data.versionNum;
                m_version.date = data.versionDate;
                mongoTool.versions.push(m_version);
            }

            // insert/update tool in Mongo
            var toolToUpdate = {};
            toolToUpdate = Object.assign(toolToUpdate, mongoTool._doc);
            toolToUpdate._id = null;

            M_tool.findOneAndUpdate({
                'azid': azid
            }, toolToUpdate, {
                upsert: true
            }, function(err, doc) {
                if (err) {
                  console.log(err);
                }
            });
        }; // end helper function

        // Check for prexisting resource
        var source = data.source;
        var sourceID = data.sourceID; //resourceID for cytoscape

        if (source != null && sourceID != null) {
            Tool.where({
                    SOURCE: source,
                    SOURCE_ID: sourceID
                })
                .fetch()
                .then(function(tool) {
                    if (tool == null) {
                        console.log("Creating " + self.RESOURCE_TYPE + "." + sourceID);
                        new Tool({
                            SOURCE: source,
                            SOURCE_ID: sourceID,
                            NAME: data.name,
                            LOGO_LINK: data.logo,
                            DESCRIPTION: data.description,
                            SOURCE_LINK: data.sourceCodeURL,
                            PRIMARY_PUB_DOI: data.publicationDOI,
                            TOOL_DOI: data.toolDOI || null
                        }).save().then(function(newTool) {
                            updateTool(newTool, data);
                        });
                    } else {
                        // Update prexisting resource
                        new Tool({
                            AZID: tool.attributes.AZID,
                            NAME: data.name,
                            LOGO_LINK: data.logo,
                            DESCRIPTION: data.description,
                            SOURCE_LINK: data.sourceCodeURL,
                            PRIMARY_PUB_DOI: data.publicationDOI,
                            TOOL_DOI: data.toolDOI || null,
                            LAST_UPDATED: (new Date())
                        }).save().then(function(updatedTool) {
                            if (updatedTool)
                                console.log('Successfully updated: ', updatedTool.attributes.AZID);
                        });
                        updateTool(tool, data);
                    }
                });
        } else if (source == 'USER INPUT') {
            new Tool({
                SOURCE: source,
                SOURCE_ID: sourceID,
                NAME: data.name,
                LOGO_LINK: data.logo,
                DESCRIPTION: data.description,
                SOURCE_LINK: data.sourceCodeURL,
                PRIMARY_PUB_DOI: data.publicationDOI,
                TOOL_DOI: data.toolDOI || null
            }).save().then(function(newTool) {
                updateTool(newTool, resourceType, data);
            });
        }
    })).then(function(){
      return callback(null, "Update complete.");
    }) // end of Promise

};

/**
 * Retriever.getNewFile
 * [This function returns a new timestamped file name.]
 * @param  {Object} self [Reference to Retriever object]
 * @return {String}      [The name of the new file]
 */
Retriever.prototype._getNewFile = function(self) {
    // Create directories if necessary
    if (!fs.existsSync(self.OUTFILE_DIRECTORY)) {
        fs.mkdirSync(self.OUTFILE_DIRECTORY);
    }

    if (!fs.existsSync(self.OUTFILE_TEMP_DIRECTORY)) {
        fs.mkdirSync(self.OUTFILE_TEMP_DIRECTORY);
    }

    // Generate new timestamped outfile name
    var date = new Date();
    var outfile = self.RESOURCE_TYPE + "_" + date.toISOString().replace(/:/g, "-") + ".json";


    return outfile;
};

module.exports = Retriever;
