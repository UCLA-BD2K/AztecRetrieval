/**
 * Galaxy Repositories handler.
 * Created by AK on 11/30/2015.
 */

var cheerio = require("cheerio");
var fs = require("fs");
var request = require("request");

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

module.exports = GalaxyRepositories;
