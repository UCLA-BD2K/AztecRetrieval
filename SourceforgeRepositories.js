/**
 * Sourceforge Repositories handler.
 * Created by Brian Bleakley on 01/14/2016.
 */

var fs = require("fs");
var request = require("request");
var sf_miner = require("./sf_miner/sf_miner1");
var path = require("path");

var Domain = require("./models/mysql/domain");
var Institution = require("./models/mysql/institution");
var Platform = require("./models/mysql/platform");
var Language = require("./models/mysql/language");
var License = require("./models/mysql/license");
var Resource = require("./models/mysql/resource");
var Tag = require("./models/mysql/tag");
var Tool = require("./models/mysql/tool");

var M_tool = require('./models/mongo/toolMisc.js');
var M_author = require('./models/mongo/author.js');
var M_funding = require('./models/mongo/funding.js');
var M_link= require('./models/mongo/link.js');
var M_maintainer= require('./models/mongo/maintainer.js');
var M_missing_inst = require('./models/mongo/missing_inst.js');
var M_publication= require('./models/mongo/publication.js');
var M_version = require("./models/mongo/version.js");

var OUTFILE_DIRECTORY = "public/sourceforge/";
var OUTFILE_TEMP_DIRECTORY = OUTFILE_DIRECTORY + "temp/";
var OUTFILE_BASE_NAME = "sourceforge_repositories";

var RESOURCE_TYPE = "sourceforge";

/**
 * @constructor
 */
var SourceforgeRepositories = function () {
};

// Write to file
var writeToFile = function () {
    // Write initial data
    fs.appendFileSync(OUTFILE_TEMP_DIRECTORY + outfileName,
        "{\n" +
        "\"type\": \"" + RESOURCE_TYPE + "\",\n" +
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
};

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
                latest = current;
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

/**
 * Updates the Aztec database.
 */
SourceforgeRepositories.update = function () {
    // Read JSON data
    var json = require(path.resolve(this.latest()));
    var resourceType = json.type;
    if (resourceType != RESOURCE_TYPE || !json.data) {
        console.log("Wrong type: " + json.type);
        return false;
    }

    Promise.all(json.data.map(function (data) {
        // For each data entry
        console.log("Processing " + data.res_name);

        // Helper function to update each tool
        // TODO: Relations are likely to be kept if attributes change. Investigate pruning invalid relations on update.
        var updateTool = function (tool, data) {
            console.log("Updating " + data.res_name);
            var azid = tool.get("AZID");

            // Domains (MySQL)
            if (data.domains != null) {
                Promise.all(data.domains.map((function (domainName) {
                    Domain.where({AZID: azid, DOMAIN: domainName}).fetch()
                        .then(function (domain) {
                            if (domain == null) {
                                domain = new Domain({AZID: azid, DOMAIN: domainName}).save();
                            }

                            return domain;
                        })
                })));
            }

            // TODO: Institutions (Mongo+MySQL)
            if (data.institutions != null) {
                Promise.all(data.institutions.map((function (institutionName) {
                    var institution = Institution.forge({NAME: institutionName});
                    institution.save()
                        .catch(function (err) {
                            // Suppress duplicate errors
                            if (err.code != "ER_DUP_ENTRY") {
                                console.log(err);
                            }
                        });

                    institution.fetch()
                        .then(function (result) {
                            tool.institutions().attach(result)
                                .catch(function (err) {
                                    // Suppress duplicate errors for preexisting relations
                                    if (err.code != "ER_DUP_ENTRY") {
                                        console.log(err);
                                    }
                                });
                        });
                })));
            }

            // Language (MySQL)
            if (data.dev.dev_lang != null) {
                Promise.all(data.dev.dev_lang.map((function (langName) {
                    var language = Language.forge({NAME: langName});
                    language.save()
                        .catch(function (err) {
                            //Suppress duplicate errors
                            if (err.code != "ER_DUP_ENTRY") {
                                console.log(err);
                            }
                        });

                    language.fetch().then(function (result) {
                        tool.languages().attach(result)
                            .catch(function (err) {
                                // Suppress duplicate errors for preexisting relations
                                if (err.code != "ER_DUP_ENTRY") {
                                    console.log(err);
                                }
                            });
                    });
                })));
            }

            // Licenses (MySQL)
            if (data.licenses != null) {
                for (var licenseIndex in data.licenses) {
                    (function (licenseName, licenseLink) {
                        if (licenseLink == "") {
                            licenseLink = null;
                        }

                        // Use link as name if necessary
                        if (licenseName == null || licenseName == "") {
                            if (licenseLink != null) {
                                licenseName = licenseLink;
                            } else {
                                console.log("Invalid license for " + data.res_name);
                                return null;
                            }
                        }

                        License.where({AZID: azid, NAME: licenseName}).fetch()
                            .then(function (license) {
                                if (license == null) {
                                    new License({
                                        AZID: azid,
                                        NAME: licenseName,
                                        LINK: licenseLink
                                    }).save();
                                }
                            });
                    })(data.licenses[licenseIndex], data.licenseUrls[licenseIndex]);
                }
            }

            // Platforms (MySQL)
            if (data.dev.dev_platform != null) {
                Promise.all(data.dev.dev_platform.map((function (platformName) {
                    if (platformName == 'OS Portable (Source code to work with many OS platforms)')
                        platformName = 'OS Portable';
                    if (platformName == 'OS Independent (Written in an interpreted language)')
                        platformName = 'OS Independent';
                    if (platformName == 'All BSD Platforms (FreeBSD/NetBSD/OpenBSD/Apple Mac OS X)')
                        platformName = 'All BSD Platforms';
                    if (platformName = 'Modern (Vendor-Supported) Desktop Operating Systems')
                        platformName = 'Linux';

                    var platform = Platform.forge({NAME: platformName});
                    platform.save()
                        .catch(function (err) {
                            // Suppress duplicate errors
                            if (err.code != "ER_DUP_ENTRY") {
                                console.log(err);
                            }
                        });

                    platform.fetch()
                        .then(function (result) {
                            tool.platforms().attach(result)
                                .catch(function (err) {
                                    // Suppress duplicate errors for preexisting relations
                                    if (err.code != "ER_DUP_ENTRY") {
                                        console.log(err);
                                    }
                                });
                        });
                })));
            }

            // Types (MySQL)
            if (data.types != null) {
                Promise.all(data.types.map((function (resourceType) {
                    var resource = Resource.forge({RESOURCE_TYPE: resourceType});
                    resource.save()
                        .catch(function (err) {
                            // Suppress duplicate errors
                            if (err.code != "ER_DUP_ENTRY") {
                                console.log(err);
                            }
                        });

                    resource.fetch()
                        .then(function (result) {
                            tool.resources().attach(result)
                                .catch(function (err) {
                                    // Suppress duplicate errors for preexisting relations
                                    if (err.code != "ER_DUP_ENTRY") {
                                        console.log(err);
                                    }
                                });
                        });
                })));
            }

            // Tags (MySQL)
            if (data.tags != null) {
                Promise.all(data.tags.map((function (tagObject) {
                    tagName = tagObject.text;
                    var tag = Tag.forge({NAME: tagName});
                    tag.save()
                        .catch(function (err) {
                            // Suppress duplicate errors
                            if (err.code != "ER_DUP_ENTRY") {
                                console.log(err);
                            }
                        });

                    tag.fetch()
                        .then(function (result) {
                            tool.tags().attach(result)
                                .catch(function (err) {
                                    // Suppress duplicate errors for preexisting relations
                                    if (err.code != "ER_DUP_ENTRY") {
                                        console.log(err);
                                    }
                                });
                        });
                })));
            }
        };

        var addMongo = function (m_tool, data) {
            //save authors
            if (data.authors != null) {
                for (var authorsIndex in data.authors) {
                    (function (authorName) {
                        if (authorEmail == '') {
                            authorEmail = null;
                        }
                        var names = authorName.split(/[ ,]+/);
                        var first = names[0];
                        var last = names[1];

                        var m_author = new M_author;
                        m_author.first_name = first;
                        m_author.last_name = last;
                        m_author.author_email = null;
                        m_tool.authors.push(m_author);

                    })(data.authors[authorsIndex].author_name);
                }
            }

            //Sourceforge has no maintainer information

            //Sourceforge has no version information

            //Sourceforge has no funding information

            //Related links
            if (data.links != null) {
                for (var linkIndex in data.links) {
                    (function (linkDescription, linkURL) {
                        var m_link = new M_link;
                        m_link.link_name = linkDescription;
                        m_link.link_url = linkURL;
                        m_tool.links.push(m_link);
                    })(data.links[linkIndex].link_name, data.links[linkIndex].link_url);
                }
            }

            //Sourceforge has no publication information

            m_tool.save(function (err) {
                if (err) {
                    console.log("mongo error");
                }
            });
        };

        // Check for prexisting resource
        var resourceID = data.resourceID;
        if (resourceType != null && data.res_name != null) {
            Tool.where({SOURCE: resourceType, NAME: data.res_name})
                .fetch()
                .then(function (tool) {
                    if (tool == null) {
                        console.log("Creating " + resourceType + "." + data.res_name);
                        console.log(data.res_name);
                        new Tool({
                            SOURCE: resourceType,
                            NAME: data.res_name,
                            LOGO_LINK: data.res_logo,
                            DESCRIPTION: data.res_desc,
                            SOURCE_LINK: data.dev.res_code_url,
                            PRIMARY_PUB_DOI: data.publicationDOI
                        }).save().then(function (newTool) {
                            M_tool({
                                azid: newTool.get("AZID")
                            }).save().then(function (m_tool) {
                                addMongo(m_tool, data)
                            });
                            updateTool(newTool, data);
                        });
                    } else {
                        // Update prexisting resource
                        updateTool(tool, data);
                    }
                });
        }
    }));
};

module.exports = SourceforgeRepositories;
