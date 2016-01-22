/**
 * Galaxy Repositories handler.
 * Created by AK on 11/30/2015.
 */

var cheerio = require("cheerio");
var fs = require("fs");
var request = require("request");
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
var GalaxyRepositories = function () {
};

var OUTFILE_DIRECTORY = "public/galaxy/";
var OUTFILE_TEMP_DIRECTORY = OUTFILE_DIRECTORY + "temp/";
var OUTFILE_BASE_NAME = "galaxy_repositories";

var TOOL_TYPE = "galaxy";
var URL = "https://toolshed.g2.bx.psu.edu/api/repositories";

/**
 * Returns the latest outfile.
 * @returns {string|String}
 */
GalaxyRepositories.latest = function () {
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

GalaxyRepositories.retrieve = function () {
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

    // Retrieve the first page
    request(
        {
            url: URL,
            json: true
        },
        function (error, response, body) {
            if (!error && response.statusCode === 200) {
                var retrieveGalaxy = function (i) {
                    var repos = {};
                    var id = body[i]["id"];
                    repos.name = body[i]["name"];
                    repos.description = body[i]["description"];
                    repos.logo = "http://evomicsorg.wpengine.netdna-cdn.com/wp-content/uploads/2011/11/galaxy_logo.png";

                    if (body[i]["remote_repository_url"] && body[i]["remote_repository_url"].match(
                            new RegExp("(http.*)", "i"))) {
                        repos.sourceCodeURL = body[i]["remote_repository_url"].match(new RegExp("(http.*)", "i"))[1];
                    }

                    // URLs
                    repos.linkDescriptions = ["Homepage"];
                    repos.linkUrls = ["https://toolshed.g2.bx.psu.edu/repository?repository_id=" + id];

                    // Authors
                    repos.authors = [body[i]['owner']];
                    repos.authorEmails = [""];

                    // Maintainers
                    repos.maintainers = [body[i]['owner']];
                    repos.maintainerEmails = [""];

                    // Tool types
                    repos.types = ["Tool"];

                    // Platform
                    repos.platforms = ["Web UI", "Linux, Unix"];

                    // Tags
                    var tags = body[i]["category_ids"];
                    repos.tags = tags;
                    for (var j = 0; j < tags.length; j++) {
                        category_hash[tags[j]] = "";
                    }

                    // Retrieve dependencies and version
                    request(
                        {
                            url: "https://toolshed.g2.bx.psu.edu/repository/view_repository?id=" + id,
                            json: true
                        },
                        function (error2, response2, body2) {
                            if (!error2 && response2.statusCode === 200) {
                                var $ = cheerio.load(body2);

                                console.log(i);
                                repos.dependencies = [];
                                // Version and dependencies

                                var dependencies_html = $('table');
                                for (var d = 0; d < dependencies_html.length; d++) {
                                    var table_id = cheerio.load(dependencies_html[d])('table').attr('id');
                                    if (table_id === "valid_tools") {
                                        repos.versionNum = cheerio.load(dependencies_html[d])('td').last().html();
                                    }

                                    else if (table_id === "tool_dependencies") {
                                        var tool_dep_details = cheerio.load(dependencies_html[d])('tr');
                                        for (var t = 2; t < tool_dep_details.length; t++) {
                                            var tool_dep_details_td = cheerio.load(tool_dep_details[t])('td');
                                            repos.dependencies.push(
                                                cheerio.load(tool_dep_details_td[0])('td').html().trim() + ": " +
                                                cheerio.load(tool_dep_details_td[1])('td').html().trim())
                                        }
                                    }

                                    else if (table_id === "repository_dependencies") {
                                        var repo_dep_details = cheerio.load(dependencies_html[d])('tr');
                                        for (var r = 1; r < repo_dep_details.length; r++) {
                                            var repo_dep_details_b = cheerio.load(repo_dep_details[r])('b');
                                            var repo_dep_info = cheerio.load(repo_dep_details_b[0])('b').html();

                                            var repo_dep_info_match = /_\d+/.exec(repo_dep_info);
                                            if (repo_dep_info_match) {
                                                var pkg_name = repo_dep_info.substring(0, repo_dep_info_match.index);
                                                var pkg_version = repo_dep_info.substring(repo_dep_info_match.index + 1);
                                                repos.dependencies.push(pkg_name, pkg_name.replace("package_", "") + ": " +
                                                    pkg_version.replace(new RegExp("_", "g"), "."));
                                            }
                                            else {
                                                repos.dependencies.push(repo_dep_info);
                                            }

                                        }
                                    }
                                }
                            }

                            if (i == body.length-1) {
                                var retrieveCategoryNames = function (c) {
                                    console.log("cat");
                                    var catID = Object.keys(category_hash)[c];
                                    request(
                                        {
                                            url: "https://toolshed.g2.bx.psu.edu/repository/browse_repositories_in_category?id=" + catID,
                                            json: true
                                        },
                                        function (error2, response2, body2) {
                                            if (!error2 && response2.statusCode === 200) {
                                                var re = new RegExp("<title>Repositories in Category (.*?)</title>", "i");
                                                var category_name = body2.match(re)[1];
                                                var re2 = new RegExp(catID, "g");
                                                results = results.replace(re2, category_name);

                                                // Recursively calling itself until there is no more category id in the hash
                                                if (c < Object.keys(category_hash).length - 1) {
                                                    retrieveCategoryNames(c + 1);
                                                }

                                                // Write to file
                                                else {
                                                    // Write initial data
                                                    fs.appendFileSync(OUTFILE_TEMP_DIRECTORY + outfileName,
                                                        "{\n" +
                                                        "\"type\": \"" + TOOL_TYPE + "\",\n" +
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
                                            }
                                        }
                                    )
                                };

                                retrieveCategoryNames(0);
                            }
                        }
                    );

                    results += JSON.stringify(repos) + ",\n";

                    // Recursive call
                    if (i + 1 < body.length) {
                        retrieveGalaxy(i + 1);
                    }
                };

                // Begin recursion
                retrieveGalaxy(1);
                return "Retrieving: " + outfileName.toString();
            }
        }
    );
};

GalaxyRepositories.update = function () {

    // Read JSON data
    var json = require(path.resolve(GalaxyRepositories.latest()));
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
                    GalaxyRepositories.updateTool(tool, data);
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
                            GalaxyRepositories.updateTool(newTool, data);
                        });
                    } else {
                        GalaxyRepositories.updateTool(tool, data);
                    }

                });
            }

        })(json.data[i]);

    }
};

GalaxyRepositories.updateTool = function (tool, data) {

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

module.exports = GalaxyRepositories;
