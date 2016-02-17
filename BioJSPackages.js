/*
 * BioJS packages handler.
 * Created by AK on 11/20/2015.
 */

// Load packages
var fs = require("fs");
var npmKeyword = require('npm-keyword');
var packageJson = require("package-json");
var path = require("path");

var Domain = require("./models/mysql/domain");
var Institution = require("./models/mysql/institution");
var Platform = require("./models/mysql/platform");
var Language = require("./models/mysql/language");
var License = require("./models/mysql/license");
var Resource = require("./models/mysql/resource");
var Tag = require("./models/mysql/tag");
var Tool = require("./models/mysql/tool");

/**
 * @constructor
 */
var BioJSPackages = function () {

};

// Output file
var RESOURCE_TYPE = "biojs";
var BASE_URL = "https://www.npmjs.com/package/";

var OUTFILE_DIRECTORY = "public/biojs/";
var OUTFILE_TEMP_DIRECTORY = OUTFILE_DIRECTORY + "temp/";
var OUTFILE_BASE_NAME = "biojs_packages";

/**
 * Returns the latest outfile.
 * @returns {string|String}
 */
BioJSPackages.latest = function () {
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

/**
 * Retrieves packages from npmjs.com using npm-keyword and stores as a JSON file in OUTFILE_DIRECTORY.
 */
BioJSPackages.retrieve = function () {
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

    npmKeyword('biojs').then(function (biojsPackages) {
        // Write initial data
        fs.appendFileSync(OUTFILE_TEMP_DIRECTORY + outfileName,
            "{\n" +
            "\"type\": \"" + RESOURCE_TYPE + "\",\n" +
            "\"date\": \"" + date.toISOString() + "\",\n" +
            "\"data\": [\n");

        console.log(biojsPackages.length + " packages found.");
        var data = [];
        for (var i = 0; i < biojsPackages.length; i++) {
            var pkg_name = biojsPackages[i]["name"];
            console.log("Retrieving " + pkg_name);

            // Retrieve json format
            packageJson(pkg_name, "latest").then(function (jsonPackage) {
                var pkg = {};
                pkg.resourceID = jsonPackage.name; // Use name as ID
                pkg.name = jsonPackage.name;
                pkg.versionNum = jsonPackage.version;
                pkg.description = jsonPackage.description;

                if ("author" in jsonPackage) {
                    pkg.authors = [jsonPackage.author.name];
                    pkg.authorEmails = [jsonPackage.author.email];
                }
                pkg.tags = jsonPackage.keywords;
                pkg.sourceCodeURL = jsonPackage.repository.url;
                pkg.linkDescriptions = ["Homepage", "Documentation", "Bugs"];
                pkg.linkUrls = [BASE_URL + jsonPackage.name, jsonPackage.homepage, jsonPackage.bugs.url];
                pkg.types = ["Widget"];
                pkg.platforms = ["Web UI"];
                pkg.language = "JavaScript";
                pkg.logo = "http://biojs.net/img/logo.png";

                pkg.licenses = [];
                pkg.licenseUrls = [];
                for (var l = 0; l < jsonPackage.licenses; l++) {
                    pkg.licenses.push(jsonPackage.licenses[l].type);
                    pkg.licenseUrls.push(jsonPackage.licenses[l].url);

                }

                pkg.dependencies = [];
                for (var k in jsonPackage.dependencies) {
                    pkg.dependencies.push(k + ": " + jsonPackage.dependencies[k]);
                }

                pkg.maintainers = [];
                pkg.maintainerEmails = [];

                for (var j = 0; j < jsonPackage.maintainers.length; j++) {
                    pkg.maintainers.push(jsonPackage.maintainers[j].name);
                    pkg.maintainerEmails.push(jsonPackage.maintainers[j].email);
                }

                pkg.source = "Biojs";
                pkg.tags = [];
                pkg.domains = [];

                var keywords = jsonPackage.keywords;
                // Hacky way to match biological domain
                if (keywords.indexOf("Medical") >= 0) {
                    pkg.domains.push("Medical");
                }

                if (keywords.indexOf("proteome") >= 0 || keywords.indexOf("proteomics") >= 0 || keywords.indexOf("proteomic") >= 0 || keywords.indexOf("protein") >= 0 || keywords.indexOf("proteins") >= 0) {
                    pkg.domains.push("Proteomics");
                }

                if (keywords.indexOf("genome") >= 0 || keywords.indexOf("genomic") >= 0 || keywords.indexOf("genomics") >= 0 || keywords.indexOf("genes") >= 0 || keywords.indexOf("dna") >= 0 || keywords.indexOf("rna") >= 0 || keywords.indexOf("plasmid") >= 0 || keywords.indexOf("rna-seq") >= 0) {
                    pkg.domains.push("Genomics");
                }

                if (keywords.indexOf("metabolome") >= 0 || keywords.indexOf("metabolomic") >= 0 || keywords.indexOf("metabolomics") >= 0 || keywords.indexOf("metabolite") >= 0 || keywords.indexOf("metabolites") >= 0) {
                    pkg.domains.push("Metabolomics");
                }

                if (keywords.indexOf("metagenomic") >= 0 || keywords.indexOf("metagenomics") >= 0) {
                    pkg.domains.push("Metagenomics");
                }

                if (keywords.indexOf("Medical") >= 0 || keywords.indexOf("biomedical") >= 0) {
                    pkg.domains.push("Biomedical");
                }

                // Remove certain keywords
                var biojs_index = keywords.indexOf("biojs");
                var proteomic_index = keywords.indexOf("proteomics");
                var proteomics_index = keywords.indexOf("proteomic");
                var genomic_index = keywords.indexOf("genomic");
                var genomics_index = keywords.indexOf("genomics");
                var metabolomic_index = keywords.indexOf("metabolomic");
                var metabolomics_index = keywords.indexOf("metabolomics");
                var metagenomic_index = keywords.indexOf("metagenomic");
                var metagenomics_index = keywords.indexOf("metagenomics");
                var biomedical_index = keywords.indexOf("biomedical");

                if (biojs_index >= 0) {
                    keywords.splice(biojs_index, 1);
                }

                if (proteomic_index >= 0) {
                    keywords.splice(proteomic_index, 1);
                }

                if (proteomics_index >= 0) {
                    keywords.splice(proteomics_index, 1);
                }

                if (genomic_index >= 0) {
                    keywords.splice(genomic_index, 1);
                }

                if (genomics_index >= 0) {
                    keywords.splice(genomics_index, 1);
                }

                if (metabolomic_index >= 0) {
                    keywords.splice(metabolomic_index, 1);
                }

                if (metabolomics_index >= 0) {
                    keywords.splice(metabolomics_index, 1);
                }

                if (metagenomic_index >= 0) {
                    keywords.splice(metagenomic_index, 1);
                }

                if (metagenomics_index >= 0) {
                    keywords.splice(metagenomics_index, 1);
                }

                if (biomedical_index >= 0) {
                    keywords.splice(biomedical_index, 1);
                }

                pkg.tags = keywords;

                // Append to data
                if (pkg.name != null) {
                    data.push(pkg);
                }

                // Write to file when last package has been retrieved
                if (data.length == biojsPackages.length) {
                    for (var dataIndex = 0; dataIndex < data.length; dataIndex++) {
                        // Write separator if necessary
                        if (dataIndex > 0) {
                            fs.appendFileSync(OUTFILE_TEMP_DIRECTORY + outfileName, ",\n");
                        }

                        fs.appendFileSync(OUTFILE_TEMP_DIRECTORY + outfileName, JSON.stringify(data[dataIndex]));
                    }

                    // Write closing brackets and braces
                    fs.appendFileSync(OUTFILE_TEMP_DIRECTORY + outfileName, "\n]\n}\n");

                    // Move file out of temp directory when complete
                    fs.renameSync(OUTFILE_TEMP_DIRECTORY + outfileName,
                        OUTFILE_DIRECTORY + outfileName);
                    console.log("Complete: " + outfileName);
                }
            });
        }
    });

    return "Retrieving " + outfileName;
};

/**
 * Updates the Aztec database.
 */
BioJSPackages.update = function () {
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

module.exports = BioJSPackages;
