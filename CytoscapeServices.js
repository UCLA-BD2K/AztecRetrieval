/*
 * Cytoscape services handler.
 * Created by AK on 11/20/2015.
 */

var cheerio = require("cheerio");
var dateFormat = require('dateformat');
var fs = require("fs");
var request = require("request");
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

var RESOURCE_TYPE = "cytoscape";
var BASE_URL = "http://apps.cytoscape.org";

var OUTFILE_DIRECTORY = "public/cytoscape/";
var OUTFILE_TEMP_DIRECTORY = OUTFILE_DIRECTORY + "temp/";
var OUTFILE_BASE_NAME = "cytoscape_services";

/**
 * @constructor
 */
var CytoscapeServices = function () {

};

/**
 * Returns the latest outfile.
 * @returns {string|String}
 */
CytoscapeServices.latest = function () {
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
 * Retrieves cytoscape services from http://apps.cytoscape.org and stores them in a JSON file.
 * TODO Need to remove duplicate record from linux command:
 *      sort 01_cytoscape_temp.json | uniq > 01_cytoscape_widgets.json
 * This script is not stable, it may have different result sets at different runs
 */
CytoscapeServices.retrieve = function () {
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
    var complete = 0;
    var skipped = 0;

    request(
        {
            url: BASE_URL + "/apps/wall",
            json: true
        },
        function (error, response, body) {
            if (!error && response.statusCode === 200) {

                var $ = cheerio.load(body);
                var containers = cheerio.load($('table').html())('a');

                var retrieve_app = function (i) {
                    var app_link = containers[i]['attribs']['href']; // Getting the link of each app

                    request(
                        {url: BASE_URL + app_link, json: true},
                        function (error2, response2, body2) {
                            if (!error2 && response.statusCode === 200) {

                                var app = {};  // Use this to store the app information

                                var app_body2 = cheerio.load(body2); // Parsing html
                                var name_obj = app_body2('h2').attr('id', 'app-name');
                                if (name_obj.length != 0) {
                                    // Getting name and logo information
                                    var name = name_obj.html().trim();
                                    app.resourceID = name; // Use app name as resource ID
                                    app.name = name;	// App name
                                    app.description = name_obj.next().html(); // App description
                                    app.logo = BASE_URL + cheerio.load(name_obj.parent().prev().html())('img')
                                            .attr('src'); // App logo
                                    app.source = "Cytoscape";
                                    app.types = ["Widget"];

                                    // Links, maintainers publication == check text first before parsing, use while loop
                                    var resource_obj = app_body2('li.nav-header');
                                    var next_resource_obj = resource_obj.next();
                                    app.linkDescriptions = ['Cytoscape Link'];
                                    app.linkUrls = [BASE_URL + app_link];
                                    app.maintainers = [];
                                    app.maintainerEmails = [];

                                    while (next_resource_obj.text() !== "" || next_resource_obj.hasClass('divider')) {

                                        var subject = next_resource_obj.text().trim();

                                        if (subject === "Tutorial") {
                                            app.linkDescriptions.push("Tutorial");
                                            app.linkUrls.push(cheerio.load(next_resource_obj.html())('a').attr('href'))
                                        } else if (subject === "Cite this App") {
                                            var pubmed_url = cheerio.load(next_resource_obj.html())('a').attr('href')
                                                .split("/");
                                            app.pubmed_id = pubmed_url[pubmed_url.length - 1];
                                        } else if (subject === "Code Repository") {
                                            app.sourceCodeURL = cheerio.load(next_resource_obj.html())('a').attr('href')
                                        } else if (subject === "E-mail") {
                                            var help_contact = cheerio.load(next_resource_obj.html())('a').attr('href');
                                            app.maintainers.push(help_contact);
                                            app.maintainerEmails.push(help_contact);
                                        } else if (subject === "Website") {
                                            app.linkDescriptions.push("Website");
                                            app.linkUrls.push(cheerio.load(next_resource_obj.html())('a').attr('href'))
                                        } else if (subject === "Search posts") {
                                            app.linkDescriptions.push("Forum");
                                            app.linkUrls.push(cheerio.load(next_resource_obj.html())('a').attr('href'))
                                        }

                                        next_resource_obj = next_resource_obj.next()
                                    }

                                    // Version, release date, categories
                                    app.dependencies = [];
                                    app.licenses = [];
                                    app.licenseUrls = [];
                                    var version_obj = cheerio.load(app_body2('div.well').html())('p').first();
                                    while (version_obj.text() != "") {
                                        var version_text = version_obj.text().trim();
                                        if (version_text.match(new RegExp("^Version", "i"))) {
                                            app.versionNum = version_text.substr(8);
                                        } else if (version_text.match(new RegExp("^Released", "i"))) {
                                            app.versionDate = dateFormat(version_text.substr(9), "yyyy-mm-dd");
                                        } else if (version_text.match(new RegExp("^Works with", "i"))) {
                                            app.dependencies.push(version_text.substr(11));
                                        } else if (version_text.match(new RegExp("^License", "i"))) {
                                            var license_url = cheerio.load(version_obj.html())('a').attr('href');
                                            app.licenses.push(license_url);
                                            app.licenseUrls.push(license_url);
                                        }

                                        version_obj = version_obj.next();
                                    }

                                    // Authors, instituite, and  categories
                                    var author_obj = app_body2('div.tab-pane').attr('id', 'cy-app-details-tab')
                                        .children().first();
                                    app.authors = [];
                                    app.authorEmails = [];
                                    var institutions = [];
                                    app.tags = [];

                                    while (author_obj.text() != "") {
                                        var author_text = author_obj.text().trim();
                                        if (author_text.match(new RegExp("Author"))) {
                                            var author_list = cheerio.load(author_obj.html())('li').first();
                                            while (author_list.text() != "") {
                                                var info = author_list.text().split("(");
                                                var tmp_authors = info[0].trim().split(",");

                                                for (var c = 0; c < tmp_authors.length; c++) {
                                                    app.authors.push(tmp_authors[c]);
                                                    app.authorEmails.push("");
                                                }

                                                // Institution
                                                if (info[1]) {
                                                    // TODO Remove duplicates?
                                                    institutions.push(info[1].trim().slice(0, -1));
                                                }

                                                author_list = author_list.next();
                                            }
                                        }
                                        // Categories are tags
                                        else if (author_text.match(new RegExp("Categories"))) {
                                            var categories_list = cheerio.load(author_obj.html())('a').first();
                                            while (categories_list.text() != "") {
                                                app.tags.push(categories_list.text().trim());
                                                categories_list = categories_list.next();
                                            }
                                        }

                                        author_obj = author_obj.next();
                                    }


                                    // Remove duplicates
                                    app.institutions = institutions.filter(function (item, pos) {
                                        return institutions.indexOf(item) == pos;
                                    });

                                    // Ad-hoc parsing biological domains
                                    var detail = app_body2('div#cy-app-details-md').text();
                                    app.domains = [];

                                    if (detail.match(new RegExp("epigenomic", "i"))) {
                                        app.domains.push("Epigenomics");
                                    } else if (detail.match(new RegExp("metagenom", "i"))) {
                                        app.domains.push("Metagenomics");
                                    } else if (detail.match(new RegExp("gene", "i")) ||
                                        detail.match(new RegExp("genom", "i")) ||
                                        detail.match(new RegExp("dna", "i")) ||
                                        detail.match(new RegExp("rna", "i")) ||
                                        detail.match(new RegExp("nucleotide", "i"))) {
                                        app.domains.push("Genomics");
                                    }

                                    if (detail.match(new RegExp("protein", "i")) ||
                                        detail.match(new RegExp("proteom", "i")) ||
                                        detail.match(new RegExp("peptide", "i"))) {
                                        app.domains.push("Proteomics");
                                    }

                                    if (detail.match(new RegExp("metabolite", "i")) ||
                                        detail.match(new RegExp("metabolom", "i"))) {
                                        app.domains.push("Metabolomics");
                                    }

                                    if (detail.match(new RegExp("systems biology", "i"))) {
                                        app.domains.push("Systems Biology");
                                    }

                                    if (detail.match(new RegExp("medical", "i")) || detail.match(new RegExp("biomedical", "i"))) {
                                        app.domains.push("Biomedical");
                                    }

                                    // Write separator if necessary
                                    if (complete > 0) {
                                        fs.appendFileSync(OUTFILE_TEMP_DIRECTORY + outfileName, ",\n");
                                    }

                                    // Write JSON to outfile
                                    fs.appendFileSync(OUTFILE_TEMP_DIRECTORY + outfileName,
                                        JSON.stringify(app));

                                    complete++;

                                    // Data complete, write to file
                                    if (complete == (containers.length - skipped)) {
                                        // Write closing brackets and braces
                                        fs.appendFileSync(OUTFILE_TEMP_DIRECTORY + outfileName, "\n]\n}\n");

                                        // Move file out of temp directory when complete
                                        fs.renameSync(OUTFILE_TEMP_DIRECTORY + outfileName,
                                            OUTFILE_DIRECTORY + outfileName);
                                        console.log("Skipped " + skipped + " services");
                                        console.log("Complete: " + outfileName);
                                    }
                                } else {
                                    console.log(i + "\t\tBad name object\t\t" + name_obj);
                                    skipped++;
                                }
                            } else {
                                console.log(i + "\t\tBad response\t\t+" + app_link);
                                skipped++;
                            }
                        }
                    );

                    // Recurse
                    if (i < containers.length - 1) {
                        retrieve_app(i + 1);
                    }
                };

                // Write initial data
                fs.appendFileSync(OUTFILE_TEMP_DIRECTORY + outfileName,
                    "{\n" +
                    "\"type\": \"" + RESOURCE_TYPE + "\",\n" +
                    "\"date\": \"" + date.toISOString() + "\",\n" +
                    "\"data\": [\n");

                console.log(containers.length + " services found");
                retrieve_app(0);
            }
        }
    );

    return "Retrieving: " + outfileName.toString();
};

/**
 * Updates the Aztec database.
 */
CytoscapeServices.update = function () {
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

        var addMongo = function (m_tool, data) {
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

                        var m_author = new M_author;
                        m_author.first_name = first;
                        m_author.last_name = last;
                        m_author.author_email = authorEmail;
                        m_tool.authors.push(m_author);

                    })(data.authors[authorsIndex], data.authorEmails[authorsIndex]);
                }
            }

            //maintainers
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

            //Bioconductor has no institution information

            //save version
            if (data.versionNum != null) {
                var m_version = new M_version;
                m_version.version_number = data.versionNum;
                m_tool.versions.push(m_version);
            }

            //Bioconductor has no funding information

            //Related links
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

            //Bioconductor has no publication information

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

module.exports = CytoscapeServices;
