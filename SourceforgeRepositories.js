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
                var language = Language.forge({NAME: data.language});
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
                        }).save()
                            .then(function (newTool) {
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
