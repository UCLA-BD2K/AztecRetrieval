/**
 * Cytoscape services handler.
 * Created by AK on 11/20/2015.
 */

var cheerio = require("cheerio");
var dateFormat = require('dateformat');
var fs = require("fs");
var request = require("request");

var Retriever = require("./Retriever");

/**
 * @constructor
 */
var CytoscapeServices = function () {
    Retriever.call(this, "cytoscape");
};

CytoscapeServices.prototype = Object.create(Retriever.prototype);
CytoscapeServices.constructor = CytoscapeServices;

/**
 * Retrieves cytoscape services from http://apps.cytoscape.org and stores them in a JSON file.
 * TODO Need to remove duplicate records from linux command:
 *      sort 01_cytoscape_temp.json | uniq > 01_cytoscape_widgets.json
 * This script is not stable, it may have different result sets at different runs
 */
CytoscapeServices.prototype.retrieve = function (callback) {
    var BASE_URL = "http://apps.cytoscape.org";

    var outfile = this.getNewFile();
    var complete = 0;
    var skipped = 0;

    var base = this; // Declare for reference within closure scopes
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
                                        fs.appendFileSync(base.OUTFILE_TEMP_DIRECTORY + outfile, ",\n");
                                    }

                                    // Write JSON to outfile
                                    fs.appendFileSync(base.OUTFILE_TEMP_DIRECTORY + outfile,
                                        JSON.stringify(app));

                                    complete++;

                                    // Data complete, write to file
                                    if (complete == (containers.length - skipped)) {
                                        // Write closing brackets and braces
                                        fs.appendFileSync(base.OUTFILE_TEMP_DIRECTORY + outfile, "\n]\n}\n");

                                        // Move file out of temp directory when complete
                                        fs.renameSync(base.OUTFILE_TEMP_DIRECTORY + outfile,
                                            base.OUTFILE_DIRECTORY + outfile);
                                        console.log("Skipped " + skipped + " services");
                                        console.log("Complete: " + outfile);

                                        // Execute callback
                                        callback(null, outfile);
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

                console.log(containers.length + " services found");
                retrieve_app(0);
            }
        }
    );

    return "Retrieving: " + outfile.toString();
};

module.exports = CytoscapeServices;
