/*
 * Cytoscape services handler.
 * Created by AK on 11/20/2015.
 */

var cheerio = require("cheerio");
var dateFormat = require('dateformat');
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

var TOOL_TYPE = "cytoscape";
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
                latest[i] = current;
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
                                app.id = i;

                                var app_body2 = cheerio.load(body2); // Parsing html
                                var name_obj = app_body2('h2').attr('id', 'app-name');
                                if (name_obj.length != 0) {
                                    // Getting name and logo information
                                    app.name = name_obj.html().trim();	// App name
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
                    "\"type\": \"" + TOOL_TYPE + "\",\n" +
                    "\"date\": \"" + date.toISOString() + "\",\n" +
                    "\"data\": [\n");

                console.log(containers.length + " services found");
                retrieve_app(0);
            }
        }
    );

    return "Retrieving: " + outfileName.toString();
};

CytoscapeServices.update = function () {

    // Read JSON data
    var json = require(path.resolve(CytoscapeServices.latest()));
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
                    CytoscapeServices.updateTool(tool, data);
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
                            CytoscapeServices.updateTool(newTool, data);
                        });
                    } else {
                        CytoscapeServices.updateTool(tool, data);
                    }

                });
            }

        })(json.data[i]);

    }
};

CytoscapeServices.updateTool = function (tool, data) {

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

module.exports = CytoscapeServices;
