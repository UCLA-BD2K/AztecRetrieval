/**
 * Retriever superclass.
 * Created by Alan Kha on 3/2/2016.
 */

var fs = require("fs");
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
var M_link = require('./models/mongo/link.js');
var M_maintainer = require('./models/mongo/maintainer.js');
var M_version = require("./models/mongo/version.js");

var Retriever = function (resourceType) {
    this.RESOURCE_TYPE = resourceType;
    this.OUTFILE_DIRECTORY = "public/" + resourceType + "/";
    this.OUTFILE_TEMP_DIRECTORY = this.OUTFILE_DIRECTORY + "temp/";
};

/**
 * Returns the latest crawl file.
 * @returns {string|String}
 */
Retriever.prototype.latest = function () {
    var latest = null;
    var files = fs.readdirSync(this.OUTFILE_DIRECTORY);

    for (var i = 0; i < files.length; i++) {
        // Check relevant files only
        if (files[i].slice(0, this.RESOURCE_TYPE.length) != this.RESOURCE_TYPE) {
            continue;
        }

        // Update latest file
        var current = this.OUTFILE_DIRECTORY + files[i];
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

/**
 * Updates the Aztec databases.
 */
Retriever.prototype.update = function () {
    // Read JSON data
    var json = require(path.resolve(this.latest()));
    var resourceType = json.type;
    if (resourceType != this.RESOURCE_TYPE || !json.data) {
        console.log("Wrong type: " + json.type);
        return false;
    }

    Promise.all(json.data.map(function (data) {
        // For each data entry
        console.log("Processing " + data.name);

        // Helper function to update each tool
        // TODO: Relations are likely to be kept if attributes change. Investigate pruning invalid relations on update.
        var updateTool = function (tool, data) {
            console.log("Updating " + data.name);
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
            if (data.language != null) {
                // Convert single strings to an array if necessary
                var languages = [data.language];
                if (Object.prototype.toString.call(data.language) === "[object Array]") {
                    languages = data.language;
                }

                if (languages.length > 0) {
                    Promise.all(languages.map((function (languageName) {
                        if (languageName != null && languageName != "") {
                            var language = Language.forge({NAME: languageName});
                            language.save()
                                .catch(function (err) {
                                    // Suppress duplicate errors
                                    if (err.code != "ER_DUP_ENTRY") {
                                        console.log(err);
                                    }
                                });

                            language.fetch()
                                .then(function (result) {
                                    tool.languages().attach(result)
                                        .catch(function (err) {
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
                    (function (licenseName, licenseLink) {
                        if (licenseLink == "") {
                            licenseLink = null;
                        }

                        // Use link as name if necessary
                        if (licenseName == null || licenseName == "") {
                            if (licenseLink != null) {
                                licenseName = licenseLink;
                            } else {
                                console.log("Invalid license for " + data.name);
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

            // TODO: Maintainers (Mongo)

            // Platforms (MySQL)
            if (data.platforms != null) {
                Promise.all(data.platforms.map((function (platformName) {
                    if (platformName == 'OS Portable (Source code to work with many OS platforms)') {
                        platformName = 'OS Portable';
                    } else if (platformName == 'OS Independent (Written in an interpreted language)') {
                        platformName = 'OS Independent';
                    } else if (platformName == 'All BSD Platforms (FreeBSD/NetBSD/OpenBSD/Apple Mac OS X)') {
                        platformName = 'All BSD Platforms';
                    } else if (platformName = 'Modern (Vendor-Supported) Desktop Operating Systems') {
                        platformName = 'Linux';
                    }

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

            // TODO: Related links (Mongo)

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
                // TODO: Filter for repeat tags
                Promise.all(data.tags.map((function (tagName) {
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
            // Authors
            if (data.authors != null) {
                for (var authorsIndex in data.authors) {
                    (function (authorName, authorEmail) {
                        if (authorEmail == '') {
                            authorEmail = null;
                        }
                        var names = authorName.split(/[ ,]+/);
                        var first = names[0];
                        var last = names[1];

                        var m_author = new M_author;
                        m_author.first_name = first;
                        m_author.last_name = last;
                        m_author.author_email = authorEmail;
                        m_tool.authors.push(m_author);

                    })(data.authors[authorsIndex], data.authorEmails[authorsIndex]);
                }
            }

            // Maintainers
            if (data.maintainers != null) {
                for (var maintainerIndex in data.maintainers) {
                    (function (maintainerName, maintainerEmail) {
                        if (maintainerEmail == '') {
                            maintainerEmail = null;
                        }
                        var names = maintainerName.split(/[ ,]+/);
                        var first = names[0];
                        var last = names[1];

                        var m_maintainer = new M_maintainer;
                        m_maintainer.first_name = first;
                        m_maintainer.last_name = last;
                        m_maintainer.maintainer_email = maintainerEmail;
                        m_tool.maintainers.push(m_maintainer);

                    })(data.maintainers[maintainerIndex], data.maintainerEmails[maintainerIndex]);
                }
            }

            // Save version
            if (data.versionNum != null) {
                var m_version = new M_version;
                m_version.version_number = data.versionNum;
                m_tool.versions.push(m_version);
            }

            // Related links
            if (data.linkUrls != null) {
                for (var linkIndex in data.linkUrls) {
                    (function (linkURL, linkDescription) {
                        var m_link = new M_link;
                        m_link.link_name = linkDescription;
                        m_link.link_url = linkURL;
                        m_tool.links.push(m_link);
                    })(data.linkUrls[linkIndex], data.linkDescriptions[linkIndex]);
                }
            }

            m_tool.save(function (err) {
                if (err) {
                    console.log("mongo error");
                }
            });
        };

        // Check for prexisting resource
        var resourceID = data.resourceID;
        if (resourceType != null && resourceID != null) {
            Tool.where({SOURCE: resourceType, SOURCE_ID: resourceID})
                .fetch()
                .then(function (tool) {
                    if (tool == null) {
                        console.log("Creating " + resourceType + "." + resourceID);
                        new Tool({
                            SOURCE: resourceType,
                            SOURCE_ID: resourceID,
                            NAME: data.name,
                            LOGO_LINK: data.logo,
                            DESCRIPTION: data.description,
                            SOURCE_LINK: data.sourceCodeURL,
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

/**
 * Returns a new timestamped file name.
 */
Retriever.prototype.getNewFile = function () {
    // Create directories if necessary
    if (!fs.existsSync(this.OUTFILE_DIRECTORY)) {
        fs.mkdirSync(this.OUTFILE_DIRECTORY);
    }

    if (!fs.existsSync(this.OUTFILE_TEMP_DIRECTORY)) {
        fs.mkdirSync(this.OUTFILE_TEMP_DIRECTORY);
    }

    // Generate new timestamped outfile name
    var date = new Date();
    var outfile = this.RESOURCE_TYPE + "_" + date.toISOString().replace(/:/g, "-") + ".json";

    // Write initial data
    fs.appendFileSync(this.OUTFILE_TEMP_DIRECTORY + outfile,
        "{\n" +
        "\"type\": \"" + this.RESOURCE_TYPE + "\",\n" +
        "\"date\": \"" + date.toISOString() + "\",\n" +
        "\"data\": [\n");

    return outfile;
};

module.exports = Retriever;
