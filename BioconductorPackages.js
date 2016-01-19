/*
 * Bioconductor packages handler.
 * Created by AK on 11/9/2015.
 */

var request = require("request");
var path = require("path");
var fs = require("fs");


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
var BioconductorPackages = function () {

};

var TOOL_TYPE = "bioconductor";
var VERSION = "3.1";
var URL = "http://bioconductor.org/packages/" + VERSION + "/bioc/VIEWS";

var OUTFILE_DIRECTORY = "public/bioconductor/";
var OUTFILE_TEMP_DIRECTORY = OUTFILE_DIRECTORY + "temp/";
var OUTFILE_BASE_NAME = "bioconductor_packages";

/**
 * Returns the latest outfile.
 * @returns {string|String}
 */
BioconductorPackages.latest = function () {
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
 * Retrieves packages from bioconductor.org and stores as a JSON file in OUTFILE_DIRECTORY.
 */
BioconductorPackages.retrieve = function () {
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

    request(
        {
            url: URL,
            json: true
        },
        function (error, response, body) {
            if (!error && response.statusCode === 200) {

                // Split into individual packages
                var all_packages = body.split("\n\n");
                if (all_packages.length > 0) {
                    // Write initial data
                    fs.appendFileSync(OUTFILE_TEMP_DIRECTORY + outfileName,
                        "{\n" +
                        "\"type\": \"" + TOOL_TYPE + "\",\n" +
                        "\"date\": \"" + date.toISOString() + "\",\n" +
                        "\"data\": [\n");

                    for (var i = 0; i < all_packages.length; i++) {
                        console.log("Package " + i);

                        var pkg = {};
                        pkg.id = i;
                        pkg.linkDescriptions = [];
                        pkg.linkUrls = [];
                        pkg.platforms = [];
                        pkg.domains = [];
                        pkg.types = ["Tool"];
                        pkg.language = "R";
                        pkg.logo = "http://bioconductor.org/images/logo_bioconductor.gif";
                        pkg.source = "BioConductor";

                        var authorsTxt = "";
                        var maintainersTxt = "";
                        var dependencies = "";
                        var licenses = "";
                        var tags = "";

                        var package_info = all_packages[i].split("\n");
                        if (package_info == "") {
                            console.log("Package " + i + " empty");
                            continue;
                        }

                        // Iterate through each line
                        var attribute_key = "";
                        for (var k = 0; k < package_info.length; k++) {
                            // Name
                            if (package_info[k].match(new RegExp("^Package:*", "i"))) {
                                attribute_key = "name";
                                pkg.name = package_info[k].match(new RegExp("^Package:* (.*)", "i"))[1];

                                // Homepage URL
                                pkg.linkDescriptions.push("homepage");
                                pkg.linkUrls.push("http://bioconductor.org/packages/release/bioc/html/" + pkg.name + ".html");
                            }

                            // Version number
                            else if (package_info[k].match(new RegExp("^Version:*", "i"))) {
                                attribute_key = "versionNum";
                                pkg.versionNum = package_info[k].match(new RegExp("^Version:* (.*)", "i"))[1];
                            }

                            // Dependency
                            else if (package_info[k].match(new RegExp("^Depends:* (.*)", "i"))) {
                                attribute_key = "dependencies";
                                dependencies += package_info[k].match(new RegExp("^Depends:* (.*)", "i"))[1];
                            } else if (package_info[k].match(new RegExp("^SystemRequirements:* (.*)", "i"))) {
                                attribute_key = "dependencies";
                                dependencies += package_info[k].match(new RegExp("^SystemRequirements:* (.*)", "i"))[1];
                            } else if (package_info[k].match(new RegExp("^Depends:*", "")) || package_info[k].match(new RegExp("^SystemRequirements:*", "i"))) {
                                attribute_key = "dependencies";
                            }

                            // License
                            else if (package_info[k].match(new RegExp("^License:* (.*)", "i"))) {
                                attribute_key = "licenses";
                                licenses += package_info[k].match(new RegExp("^License:* (.*)", "i"))[1];
                            } else if (package_info[k].match(new RegExp("^License:*", "i"))) {
                                attribute_key = "licenses";
                            }

                            // Description
                            else if (package_info[k].match(new RegExp("^Description:* (.*)", "i"))) {
                                attribute_key = "description";
                                pkg.description = package_info[k].match(new RegExp("^Description:* (.*)", "i"))[1];
                            } else if (package_info[k].match(new RegExp("^Description:*", "i"))) {
                                attribute_key = "description";
                            }

                            // Tags
                            else if (package_info[k].match(new RegExp("^biocViews:* (.*)", "i"))) {
                                attribute_key = "tags";
                                tags += package_info[k].match(new RegExp("^biocViews:* (.*)", "i"))[1];
                            } else if (package_info[k].match(new RegExp("^biocViews:*", "i"))) {
                                attribute_key = "tags";
                            }

                            // Authors
                            else if (package_info[k].match(new RegExp("^Author:*", "i"))) {
                                attribute_key = "authors";
                                authorsTxt += package_info[k].match(new RegExp("^Author:* (.*)", "i"))[1];
                            }

                            // Maintainer
                            else if (package_info[k].match(new RegExp("^Maintainer:*", "i"))) {
                                attribute_key = "maintainers";
                                maintainersTxt += package_info[k].match(new RegExp("^Maintainer:* (.*)", "i"))[1];
                            }

                            // Source Code
                            else if (package_info[k].match(new RegExp("^source\.ver:*", "i"))) {
                                attribute_key = "sourceCodeURL";
                                pkg.sourceCodeURL = "http://bioconductor.org/packages/release/bioc/" + package_info[k].match(new RegExp("^source\.ver:* (.*)", "i"))[1];
                                pkg.platforms.push("Linux (Unix)");
                            }

                            // Platform
                            else if (package_info[k].match(new RegExp("^win\.binary\.ver", "i"))) {
                                attribute_key = "platforms";
                                pkg.platforms.push("Windows 32");
                            } else if (package_info[k].match(new RegExp("^win64\.binary\.ver", "i"))) {
                                attribute_key = "platforms";
                                pkg.platforms.push("Windows 64");
                            } else if (package_info[k].match(new RegExp("^mac\.binary\.ver", "i"))) {
                                attribute_key = "platforms";
                                pkg.platforms.push("Mac OS X 10.6");
                            } else if (package_info[k].match(new RegExp("^mac\.binary\.mavericks\.ver", "i"))) {
                                attribute_key = "platforms";
                                pkg.platforms.push("Mac OS X 10.9");
                            }

                            // Documentation
                            else if (package_info[k].match(new RegExp("^vignettes:* (.*)", "i"))) {
                                attribute_key = "documentation";
                                pkg.linkDescriptions.push("documentation");
                                pkg.linkUrls.push("http://bioconductor.org/packages/release/bioc/" + package_info[k].match(new RegExp("^vignettes:* (.*)", "i"))[1]);
                            } else if (package_info[k].match(new RegExp("^BugReports:* (.*)", "i"))) {
                                attribute_key = "documentation";
                                pkg.linkDescriptions.push("bug");
                                pkg.linkUrls.push(package_info[k].match(new RegExp("^BugReports:* (.*)", "i"))[1]);
                            } else if (package_info[k].match(new RegExp("^vignettes:*", "i")) || package_info[k].match(new RegExp("^BugReports:*", "i"))) {
                                attribute_key = "documentation";
                            } else if (package_info[k].match(new RegExp("^vignettes:", "i"))) {
                                attribute_key = "documentation";
                            }

                            // Video
                            else if (package_info[k].match(new RegExp("^Video:* (.*)", "i"))) {
                                attribute_key = "video";
                                pkg.linkDescriptions.push("video");
                                pkg.linkUrls.push(package_info[k].match(new RegExp("^Video:* (.*)", "i"))[1]);
                            } else if (package_info[k].match(new RegExp("^Video:*", "i"))) {
                                attribute_key = "video";
                            }

                            // Handle cases where we don't do anything about it
                            else if (package_info[k].match(new RegExp("^Suggests:*", "i")) ||
                                package_info[k].match(new RegExp("^MD5sum:*", "i")) ||
                                package_info[k].match(new RegExp("^Archs:*", "i")) ||
                                package_info[k].match(new RegExp("^NeedsCompilation:*", "i")) ||
                                package_info[k].match(new RegExp("^Title:*", "i")) ||
                                package_info[k].match(new RegExp("^vignetteTitles:*", "i")) ||
                                package_info[k].match(new RegExp("^hasREADME:*", "i")) ||
                                package_info[k].match(new RegExp("^hasNEWS:*", "i")) ||
                                package_info[k].match(new RegExp("^hasINSTALL:*", "i")) ||
                                package_info[k].match(new RegExp("^hasLICENSE:*", "i")) ||
                                package_info[k].match(new RegExp("^Rfiles:*", "i")) ||
                                package_info[k].match(new RegExp("^VignetteBuilder:*", "i")) ||
                                package_info[k].match(new RegExp("^dependsOnMe:*:q", "i")) ||
                                package_info[k].match(new RegExp("^importsMe:*", "i")) ||
                                package_info[k].match(new RegExp("^suggestsMe:*", "i")) ||
                                package_info[k].match(new RegExp("^Imports:*", "i")) ||
                                package_info[k].match(new RegExp("^LinkingTo:*", "i")) ||
                                package_info[k].match(new RegExp("^URL:*", "i")) ||
                                package_info[k].match(new RegExp("^htmlTitles:*", "i")) ||
                                package_info[k].match(new RegExp("^htmlDocs:*", "i")) ||
                                package_info[k].match(new RegExp("^License_restricts_use:*", "i")) ||
                                package_info[k].match(new RegExp("^OS_type:*", "i")) ||
                                package_info[k].match(new RegExp("^Enhances:*", "i"))
                            ) {
                                attribute_key = "reset";
                            }

                            // filling the rest of the info
                            else {
                                var info = package_info[k].trim();

                                if (attribute_key === "dependencies") {
                                    dependencies += " " + info;
                                } else if (attribute_key === "licenses") {
                                    licenses += " " + info;
                                } else if (attribute_key === "description") {
                                    pkg.description += " " + info;
                                } else if (attribute_key === "tags") {
                                    tags += " " + info;
                                } else if (attribute_key === "authors") {
                                    authorsTxt += " " + info;
                                } else if (attribute_key === "maintainers") {
                                    maintainersTxt += " " + info;
                                } else if (attribute_key === "documentation") {
                                    info = info.split(",")[0];
                                    if (info.match(new RegExp("^vignettes"))) {
                                        pkg.linkDescriptions.push("documentation");
                                        pkg.linkUrls.push("http://bioconductor.org/packages/release/bioc/" + info);
                                    }
                                    attribute_key = "reset";
                                } else if (attribute_key === "video") {
                                    pkg.linkDescriptions.push("video");
                                    pkg.linkUrls.push(info);
                                    attribute_key = "reset";
                                }
                            }
                        }

                        // Put everything together
                        pkg.dependencies = dependencies.split(",");
                        pkg.licenses = licenses.split(", ");
                        pkg.licenseUrls = [];
                        for (var l = 0; l < pkg.licenses.length; l++) {
                            pkg.licenseUrls.push("");
                        }
                        pkg.tags = tags.split(", ");

                        // Authors
                        pkg.authors = [];
                        pkg.authorEmails = [];
                        var authors_info = authorsTxt.split(/, | and |; |,|>/);
                        for (var au = 0; au < authors_info.length; au++) {
                            var author_with_emails = authors_info[au].match(new RegExp("([A-Z].*) (<.*@.*)"));
                            var author_wo_emails = authors_info[au].match(new RegExp("([A-Z].*)([A-Z].*)"));

                            if (author_with_emails) {
                                pkg.authors.push(author_with_emails[1]);
                                pkg.authorEmails.push(author_with_emails[2] + ">");
                            } else if (author_wo_emails) {
                                pkg.authors.push(author_wo_emails[1] + author_wo_emails[2]);
                                pkg.authorEmails.push("");
                            }
                        }

                        // Maintainers
                        pkg.maintainers = [];
                        pkg.maintainerEmails = [];
                        var maintainer_info = maintainersTxt.split(/, | and |; |,|>/);
                        for (var ma = 0; ma < maintainer_info.length; ma++) {
                            var maintainer_with_emails = maintainer_info[ma].match(new RegExp("([A-Z].*) *(<.*@.*)"));
                            var maintainer_wo_emails = maintainer_info[ma].match(new RegExp("([A-Z].*)([A-Z].*)"));

                            if (maintainer_with_emails) {
                                pkg.maintainers.push(maintainer_with_emails[1]);
                                pkg.maintainerEmails.push(maintainer_with_emails[2] + ">");
                            }
                            else if (maintainer_wo_emails) {
                                pkg.maintainers.push(maintainer_wo_emails[1] + maintainer_wo_emails[2]);
                                pkg.maintainerEmails.push("");
                            }
                        }

                        // Biological domain
                        if (tags.match(new RegExp("gene", "i")) ||
                            tags.match(new RegExp("dna", "i")) ||
                            tags.match(new RegExp("rna", "i")) ||
                            tags.match(new RegExp("genome", "i")) ||
                            tags.match(new RegExp("genomic", "i")) ||
                            tags.match(new RegExp("microarray", "i"))) {
                            pkg.domains.push("Genomics");
                        }

                        if (tags.match(new RegExp("peptide", "i")) ||
                            tags.match(new RegExp("protein", "i")) ||
                            tags.match(new RegExp("proteome", "i")) ||
                            tags.match(new RegExp("proteomic", "i"))) {
                            pkg.domains.push("Proteomics");
                        }

                        if (tags.match(new RegExp("metabolite", "i")) ||
                            tags.match(new RegExp("metabolomic", "i")) ||
                            tags.match(new RegExp("metabolome", "i"))) {
                            pkg.domains.push("Metabolomics");
                        }

                        if (tags.match(new RegExp("methylation", "i")) ||
                            tags.match(new RegExp("epigenomic", "i")) ||
                            tags.match(new RegExp("epigenome", "i")) ||
                            (pkg.description && ( pkg.description.match(new RegExp("epigenom", "i")) ||
                            pkg.description.match(new RegExp("histone", "i"))))) {
                            pkg.domains.push("Epigenomics");
                        }

                        if (tags.match(new RegExp("microbiome", "i")) ||
                            tags.match(new RegExp("metagenom", "i")) ||
                            (pkg.description && (pkg.description.match(new RegExp("metagenom", "i")) ||
                            pkg.description.match(new RegExp("histone", "i"))))) {
                            pkg.domains.push("Metagenomics");
                        }

                        // Remove tags
                        var proteomic_index = pkg.tags.indexOf("proteomics");
                        var proteomics_index = pkg.tags.indexOf("proteomic");
                        var genomic_index = pkg.tags.indexOf("genomic");
                        var genomics_index = pkg.tags.indexOf("genomics");
                        var metabolomic_index = pkg.tags.indexOf("metabolomic");
                        var metabolomics_index = pkg.tags.indexOf("metabolomics");
                        var metagenomic_index = pkg.tags.indexOf("metagenomic");
                        var metagenomics_index = pkg.tags.indexOf("metagenomics");
                        var biomedical_index = pkg.tags.indexOf("biomedical");

                        if (proteomic_index >= 0) {
                            pkg.tags.splice(proteomic_index, 1);
                        }

                        if (proteomics_index >= 0) {
                            pkg.tags.splice(proteomics_index, 1);
                        }

                        if (genomic_index >= 0) {
                            pkg.tags.splice(genomic_index, 1);
                        }

                        if (genomics_index >= 0) {
                            pkg.tags.splice(genomics_index, 1);
                        }

                        if (metabolomic_index >= 0) {
                            pkg.tags.splice(metabolomic_index, 1);
                        }

                        if (metabolomics_index >= 0) {
                            pkg.tags.splice(metabolomics_index, 1);
                        }

                        if (metagenomic_index >= 0) {
                            pkg.tags.splice(metagenomic_index, 1);
                        }

                        if (metagenomics_index >= 0) {
                            pkg.tags.splice(metagenomics_index, 1);
                        }

                        if (biomedical_index >= 0) {
                            pkg.tags.splice(biomedical_index, 1);
                        }

                        // Append to file
                        if (pkg.name != null) {
                            // Write separator if necessary
                            if (i > 0) {
                                fs.appendFileSync(OUTFILE_TEMP_DIRECTORY + outfileName, ",\n");
                            }

                            fs.appendFileSync(OUTFILE_TEMP_DIRECTORY + outfileName, JSON.stringify(pkg));
                        }
                    }

                    // Write closing brackets and braces
                    fs.appendFileSync(OUTFILE_TEMP_DIRECTORY + outfileName, "\n]\n}\n");

                    // Move file out of temp directory when complete
                    fs.renameSync(OUTFILE_TEMP_DIRECTORY + outfileName,
                        OUTFILE_DIRECTORY + outfileName);
                    console.log("Complete: " + outfileName);
                } else {
                    return "No packages";
                }
            }
        }
    );

    return "Retrieving " + outfileName;
};

BioconductorPackages.update = function () {

    // Read JSON data
    var json = require(path.resolve(BioconductorPackages.latest()));
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
                    BioconductorPackages.updateTool(tool, data);
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
                            BioconductorPackages.updateTool(newTool, data);
                        });
                    } else {
                        BioconductorPackages.updateTool(tool, data);
                    }

                });
            }

        })(json.data[0]);

    }

};

BioconductorPackages.updateTool = function (tool, data) {

    console.log("Updating " + data.name);

    var azid = tool.get("AZID");

    // Attach language

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

    // Attach platforms

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

    //Save related links

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

    //Save domains

    for (var domainIndex in data.domains) {
        (function (domainName) {
            domainSchema.where({AZID: azid, DOMAIN: domainName}).fetch().then(function (domain) {
                if (!domain) {
                    domainSchema.forge({AZID: azid, DOMAIN: domainName}).save();
                }
            });
        })(data.domains[domainIndex]);
    }

    //save tools/resource type

    for (var typesIndex in data.types) {
        (function (typeName) {
            resourceSchema.where({AZID: azid, RESOURCE_TYPE: typeName}).fetch().then(function (type) {
                if (!type) {
                    resourceSchema.forge({AZID: azid, RESOURCE_TYPE: typeName}).save();
                }
            });
        })(data.types[typesIndex]);
    }

    //save licences

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

    //save tag

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

    //save authors

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


};


module.exports = BioconductorPackages;
