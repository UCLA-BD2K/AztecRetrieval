/*
 * BioJS packages handler.
 * Created by AK on 11/20/2015.
 */

// Load packages
var fs = require("fs");
var npmKeyword = require('npm-keyword');
var packageJson = require("package-json");
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


/**
 * @constructor
 */
var BioJSPackages = function () {

};

// Output file
var TOOL_TYPE = "biojs";
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
                latest[i] = current;
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
            "\"type\": \"" + TOOL_TYPE + "\",\n" +
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

BioJSPackages.update = function () {

    // Read JSON data
    var json = require(path.resolve(BioJSPackages.latest()));
    if (json.type != TOOL_TYPE || !json.data) {
        console.log(json.type);
        return false;
    }

    console.log(json.data.length);


    for (var i in json.data) {

        (function (data) {

            // Check for prexisting DOI if exists, then check for prexisting name
            if (data.publicationDOI != null && data.publicationDOI != "") {
                toolSchema.where({PRIMARY_PUB_DOI: data.publicationDOI}).fetch().then(function (tool) {
                    if (!tool) {
                        console.log("Inserting " + data.name);
                        tool = toolSchema.forge({
                            NAME: data.name,
                            LOGO_LINK: data.logo,
                            DESCRIPTION: data.description,
                            SOURCE_LINK: data.sourceCodeURL,
                            PRIMARY_PUB_DOI: data.publicationDOI
                        }).save();
                    }
                    BioJSPackages.updateTool(tool, data);
                });
            } else {
                toolSchema.where({NAME: data.name}).fetch().then(function (tool) {
                    if (!tool) {
                        console.log("Inserting " + data.name);
                        toolSchema.forge({
                            NAME: data.name,
                            LOGO_LINK: data.logo,
                            DESCRIPTION: data.description,
                            SOURCE_LINK: data.sourceCodeURL,
                            PRIMARY_PUB_DOI: data.publicationDOI
                        }).save().then(function (newTool) {
                            BioJSPackages.updateTool(newTool, data);
                        });
                    } else {
                        BioJSPackages.updateTool(tool, data);
                    }

                });
            }

        })(json.data[i]);

    }
};

BioJSPackages.updateTool = function (tool, data) {

    console.log("Updating " + data.name);

    var azid = tool.get("AZID");

    // Attach language
    if (data.language != null) {
        languageSchema.where({NAME: data.language}).fetch().then(function (language) {
            if (language) {
                tool.languages().attach(language);
                //tool.languages().updatePivot();
            } else {
                languageSchema.forge({NAME: data.language}).save().then(function (newLanguage) {
                    tool.languages().attach(newLanguage);
                });
            }
        });
    }

    // Attach platforms
    if (data.platforms != null) {
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
    if (data.linkUrls != null) {
        for (var linkIndex in data.linkUrls) {
            (function (linkURL, linkDescription) {
                if (data.linkUrls[linkIndex]) {
                    relatedLinksSchema.where({AZID: azid, URL: linkURL}).fetch().then(function (link) {
                        if (!link) {
                            relatedLinksSchema.forge({AZID: azid, TYPE: linkDescription, URL: linkURL}).save();
                        }
                    });
                }
            })(data.linkUrls[linkIndex], data.linkDescriptions[linkIndex]);
        }
    }

    //Save domains
    if (data.domains != null) {
        for (var domainIndex in data.domains) {
            (function (domainName) {
                domainSchema.where({AZID: azid, DOMAIN: domainName}).fetch().then(function (domain) {
                    if (!domain) {
                        domainSchema.forge({AZID: azid, DOMAIN: domainName}).save();
                    }
                });
            })(data.domains[domainIndex]);
        }
    }


    //save tools/resource type
    if (data.types != null) {
        for (var typesIndex in data.types) {
            (function (typeName) {
                resourceSchema.where({AZID: azid, RESOURCE_TYPE: typeName}).fetch().then(function (type) {
                    if (!type) {
                        resourceSchema.forge({AZID: azid, RESOURCE_TYPE: typeName}).save();
                    }
                });
            })(data.types[typesIndex]);
        }
    }


    //save licences
    if (data.licenses != null) {
        for (var licensesIndex in data.licenses) {
            (function (licenseName, licenseLink) {
                if (licenseLink == '') {
                    licenseLink = null;
                }
                licenceSchema.where({NAME: licenseName}).fetch().then(function (license) {
                    if (license) {
                        tool.license().attach(license);
                    } else {
                        licenceSchema.forge({
                            NAME: licenseName,
                            LINK: licenseLink,
                            OPEN: 1
                        }).save().then(function (newLicense) {
                            tool.license().attach(newLicense);
                        });
                    }
                });
            })(data.licenses[licensesIndex], data.licenseUrls[licensesIndex]);
        }
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
            })(data.tags[tagsIndex]);
        }
    }

    //save authors
    if (data.authors != null) {
        for (var authorsIndex in data.authors) {
            (function (authorName, authorEmail) {
                if (authorEmail == '') {
                    authorEmail = null;
                }
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
                            EMAIL: authorEmail
                        }).save().then(function (newAuthor) {
                            tool.authors().attach(newAuthor);
                        });
                    }
                });
            })(data.authors[authorsIndex], data.authorEmails[authorsIndex]);
        }
    }


};

module.exports = BioJSPackages;
