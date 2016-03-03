/**
 * Sourceforge Repositories handler.
 * Created by Brian Bleakley on 01/14/2016.
 */

var fs = require("fs");
var HashMap = require('hashmap');
var request = require("request");
var path = require("path");

var Retriever = require("./Retriever");

var SourceforgeRepositories = function () {
    Retriever.call(this, "sourceforge");
};

SourceforgeRepositories.prototype = Object.create(Retriever.prototype);
SourceforgeRepositories.constructor = SourceforgeRepositories;

/**
 * Reads json file of sourceforge project names and downloads all information from the Sourceforge REST API.
 * Converts metadata to Aztec format and saves as json file.
 */
SourceforgeRepositories.prototype.retrieve = function () {
    var outfile = this.getNewFile();
    var base = this; // Declare for reference within closure scopes

    // Sourceforge categories to crawl
    var CATEGORIES = ['bioinformatics', 'medical', 'molecular-science'];
    // Blacklisted software TODO: Add to a database
    var BLACKLIST = ['lra', 'evolutiongame', 'gamer', 'agatca', 'caixadepandora', 'gameaccess', 'drinkandtrack',
        'lifeflight', 'gardenplot'];

    var projectMap = new HashMap(); // Prevent duplicate projects

    var categoryIndex = 0;
    var pageIndex = 1;
    var totalPages = 0;
    var searchCategories = function () {
        category = CATEGORIES[categoryIndex];
        request({
                url: 'http://sourceforge.net/directory/science-engineering/' + category + '/?page=' + pageIndex
            },
            function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    // Determine the total number of pages for the category
                    if (pageIndex == 1) {
                        console.log("Reading pages for " + category);
                        var regex0 = /<p id="result_count">\s+Showing page [0-9]+ of ([0-9]+).\s<\/p>/g;
                        totalPages = regex0.exec(body)[1];
                        console.log('Pages detected: ' + totalPages);
                    }

                    var regex1 = /<header><a href="\/projects\/([^\.]+)\/\?source=directory" itemprop="url" title="Find out more about .+"><span itemprop="name">(.+)<\/span><\/a><\/header>/g;

                    // Count the number of projects found on the page
                    var count = body.match(regex1).length;
                    console.log(count + ' (Page ' + pageIndex + ' / ' + totalPages + ')');

                    // Gather projects
                    for (var i = 0; i < count; i++) {
                        var project = {};

                        // First capture group is machine-readable name, second capture group is human-readable name
                        // We are ignoring all items with a '.' in the machine-readable name because these are imported
                        // from BerliOS and do not resolve with the REST API
                        var scan = regex1.exec(body);
                        project.human_readable_name = scan[2];
                        project.machine_readable_name = scan[1];
                        projectMap.set(project.machine_readable_name, project);
                    }

                    pageIndex++;
                    if (pageIndex <= totalPages) {
                        // Recurse
                        searchCategories();
                    } else {
                        categoryIndex++;
                        if (categoryIndex < CATEGORIES.length) {
                            pageIndex = 1;
                            searchCategories();
                        } else {
                            // All categories searched
                            // Remove all blacklisted software
                            for (var blacklisted in BLACKLIST) {
                                projectMap.remove(blacklisted);
                            }

                            var tools = projectMap.values(); // Identified projects
                            numProjects = tools.length;

                            // Iterate over each project
                            for (var i = 0; i < numProjects; i++) {
                                getProject(tools[i].machine_readable_name);
                            }
                        }
                    }
                }
            });
    };

    // Start recursion
    searchCategories();

    var restCount = 0;
    var numProjects = 0;
    var aztecEntries = [];
    var getProject = function (projectName) {
        request({
                url: 'https://sourceforge.net/rest/p/' + projectName,
                encoding: 'utf-8'
            },
            function (error, response, body) {
                if (!error && response.statusCode == 200) {

                    var raw = JSON.parse(body);

                    var tool = {};
                    tool.resourceID = raw.name;
                    tool.name = raw.name;
                    if (raw.icon_url != null)
                        tool.res_logo = raw.icon_url;
                    tool.description = raw.short_description;

                    if (raw.external_homepage != null)
                        tool.links = [{"link_name": "Homepage", "link_url": raw.external_homepage}];

                    tool.sourceCodeURL = raw.url;
                    tool.language = [];
                    for (var i = 0; i < raw.categories.language.length; i++)
                        tool.language.push(raw.categories.language[i].fullname);
                    tool.platforms = [];
                    for (var i = 0; i < raw.categories.environment.length; i++)
                        tool.platforms.push(raw.categories.environment[i].fullname);
                    for (var i = 0; i < raw.categories.os.length; i++)
                        tool.platforms.push(raw.categories.os[i].fullname);

                    tool.authors = [];
                    for (var i = 0; i < raw.developers.length; i++)
                        tool.authors.push({"author_name": raw.developers[i].name});

                    tool.license = {};
                    tool.license.license_type = "Open Source";
                    if (raw.categories.license.length > 0)
                        tool.license.license = raw.categories.license[0].fullname;
                    tool.tags = [];
                    for (var i = 0; i < raw.categories.topic.length; i++)
                        tool.tags.push(raw.categories.topic[i].fullname);

                    if (raw.moved_to_url != "") {
                        tool.sourceCodeURL = raw.moved_to_url;
                    } else {
                        // Check manually for tools that have moved to Github without updating the moved_to_url field
                        var githubRegex = /github.com\/[-\w]+\/[-\w]+/g;
                        if (raw.short_description.match(githubRegex)) {
                            tool.sourceCodeURL = raw.short_description.match(githubRegex)[0];
                        }
                    }

                    aztecEntries.push(tool);

                    restCount++;
                    if (restCount % 50 == 0 || restCount == numProjects) {
                        console.log(restCount + ' out of ' + numProjects);
                    }

                    if (restCount == numProjects) {
                        // All projects completed, write to file
                        var outputData = {};
                        outputData.type = base.RESOURCE_TYPE;
                        outputData.date = new Date().toISOString();
                        outputData.data = aztecEntries;

                        fs.writeFile(base.OUTFILE_TEMP_DIRECTORY + outfile, JSON.stringify(outputData, null, 1), function (err) {
                            if (err) {
                                return console.log(err);
                            }

                            fs.renameSync(base.OUTFILE_TEMP_DIRECTORY + outfile, base.OUTFILE_DIRECTORY + outfile);
                            console.log("Complete: " + outfile);
                        });
                    }

                } else {
                    console.log("error");
                    console.log("error " + response.statusCode);
                    console.log(response.client._httpMessage._header);
                }

                return ""
            })
    };

    return "Retrieving: " + outfile;
};

module.exports = SourceforgeRepositories;
