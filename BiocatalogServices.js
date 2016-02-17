/*
 * Biocatalog services handler.
 * Created by AK on 11/9/2015.
 */

var fs = require("fs");
var path = require("path");
var request = require("request");

/**
 * @constructor
 */
var BiocatalogServices = function () {

};

var OUTFILE_DIRECTORY = "public/biocatalog/";
var OUTFILE_TEMP_DIRECTORY = OUTFILE_DIRECTORY + "temp/";
var OUTFILE_BASE_NAME = "biocatalog_services";

var RESOURCE_TYPE = "biocatalog";
var URL = "http://www.biocatalogue.org/";
var BIOCATALOG_LOGO = "https://www.biocatalogue.org/assets/logo_small-da549203f66b74dab67f592878053664.png";

var TOOLS_PER_PAGE = 100;

/**
 * Returns the latest outfile.
 * @returns {string|String}
 */
BiocatalogServices.latest = function () {
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
 * Retrieves web services from biocatalogue.org and stores as a JSON file in OUTFILE_DIRECTORY.
 */
BiocatalogServices.retrieve = function () {
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

    // Retrieve the first page
    request(
        {
            url: URL + "/services.json?per_page=" + TOOLS_PER_PAGE,
            json: true
        },
        function (error, response, body) {
            if (!error && response.statusCode === 200) {
                var pages = body["services"]["pages"];

                // Retrieve all pages
                var retrieve_pages = function (i) {
                    request(
                        {
                            url: URL + "/services.json?per_page=" + TOOLS_PER_PAGE + "&page=" + i,
                            json: true
                        },
                        function (error2, response2, body2) {
                            if (!error2 && response2.statusCode === 200) {
                                var results = body2["services"]["results"];

                                // Retrieve resource page for tools
                                var retrieveTools = function (j) {
                                    var resourceURL = results[j]["resource"];
                                    var resourceID = parseInt(resourceURL.substr(resourceURL.lastIndexOf("/") + 1));

                                    console.log(resourceURL);
                                    request(
                                        {
                                            url: resourceURL + "/summary.json",
                                            json: true
                                        },
                                        function (error3, response3, body3) {
                                            if ("service" in body3) {
                                                if (body3["service"]["name"] != "WeatherWS") {
                                                    var service = {};

                                                    service.resourceID = resourceID;
                                                    service.name = body3["service"]["name"];
                                                    var description = body3["service"]["description"];


                                                    // If the description is too long, take only the first sentence.
                                                    if (description && description.length > 1000) {
                                                        var new_desc = description.split(". ");
                                                        service.description = new_desc[0];
                                                    }
                                                    else {
                                                        service.description = description;
                                                    }

                                                    // Logo
                                                    service.logo = BIOCATALOG_LOGO;

                                                    // Sources
                                                    service.source = "BioCatalogue";

                                                    // Language
                                                    service.language = "HTML";

                                                    // Platform
                                                    service.platforms = body3["service"]["service_technology_types"];

                                                    // URLs
                                                    service.sourceCodeURL = body3["service"]["summary"]["endpoints"][0]["endpoint"];
                                                    service.linkDescriptions = ["Homepage", "Documentation"];
                                                    service.linkUrls = [resourceURL, body3["service"]["summary"]["documentation_urls"][0]];

                                                    if (body3["service"]["summary"]["wsdls"]) {
                                                        service.linkDescriptions.push("WSDL");
                                                        service.linkUrls.push(body3["service"]["summary"]["wsdls"][0]);
                                                    }

                                                    // Publication
                                                    var publication = body3["service"]["summary"]["publications"];
                                                    if (publication.length > 0) {
                                                        var doi_re = new RegExp("(DOI: .*)\s*", "i");
                                                        var publication_doi = publication[0].match(doi_re);

                                                        if (publication_doi) {
                                                            service.publicationDOI = publication_doi[1];
                                                        }
                                                    }

                                                    // Institute
                                                    service.institutions = [];
                                                    var providers = body3["service"]["summary"]["providers"];
                                                    for (var k = 0; k < providers.length; k++) {
                                                        var institute_re = new RegExp("institute", "i");
                                                        var center_re = new RegExp("center", "i");

                                                        if (providers[k].service_provider.name.match(institute_re) ||
                                                            providers[k].service_provider.name.match(center_re)) {
                                                            service.institutions.push(providers[k].service_provider.name);
                                                        }
                                                    }

                                                    // Licenses
                                                    var licenses = body3["service"]["summary"]["licenses"];
                                                    service.licenses = [];
                                                    service.licenseUrls = [];
                                                    for (var l = 0; l < licenses.length; l++) {
                                                        if (!licenses[l].match(new RegExp("does not require", "i"))) {
                                                            service.licenses.push(licenses[l]);
                                                            service.licenseUrls.push("");
                                                        }
                                                    }

                                                    // Maintainers
                                                    service.maintainers = [];
                                                    service.maintainerEmails = [];
                                                    var contacts = body3["service"]["summary"]["contacts"];
                                                    for (var n = 0; n < contacts.length; n++) {
                                                        var email = contacts[n].match(new RegExp("(.*)\r\n(.*)", "i"));
                                                        if (email) {
                                                            service.maintainers.push(email[2]);
                                                            service.maintainerEmails.push(email[1]);
                                                        } else {
                                                            service.maintainers.push(contacts[n]);
                                                            service.maintainerEmails.push("");
                                                        }
                                                    }

                                                    // Tool type
                                                    service.types = ["Tool"];

                                                    // Tags
                                                    service.tags = [];
                                                    var tags = body3["service"]["summary"]["tags"];
                                                    for (var t = 0; t < tags.length; t++) {
                                                        service.tags.push(tags[t].name);
                                                    }

                                                    // Categories
                                                    var categories = body3["service"]["summary"]["categories"];
                                                    for (var c = 0; c < categories.length; c++) {
                                                        service.tags.push(categories[c].name);
                                                    }

                                                    // Biological domain and tool type
                                                    var domain = {};
                                                    for (var t2 = 0; t2 < service.tags.length; t2++) {
                                                        if (service.tags[t2] == "Data Retrieval") {
                                                            service.types.push("Database");
                                                        }


                                                        if (service.tags[t2].match(new RegExp("epigenomic", "i"))) {
                                                            domain["Epigenomics"] = "";
                                                        } else if (service.tags[t2].match(new RegExp("metagenomic", "i")) ||
                                                            service.tags[t2].match(new RegExp("metagenome", "i"))
                                                        ) {
                                                            domain["Metagenomics"] = "";
                                                        } else if (service.tags[t2].match(new RegExp("gene", "i")) ||
                                                            service.tags[t2].match(new RegExp("genomic", "i")) ||
                                                            service.tags[t2].match(new RegExp("genome", "i")) ||
                                                            service.tags[t2].match(new RegExp("dna", "i")) ||
                                                            service.tags[t2].match(new RegExp("rna", "i")) ||
                                                            service.tags[t2].match(new RegExp("nucleotide", "i"))
                                                        ) {
                                                            domain["Genomics"] = "";
                                                        }

                                                        if (service.tags[t2].match(new RegExp("protein", "i")) ||
                                                            service.tags[t2].match(new RegExp("proteomic", "i")) ||
                                                            service.tags[t2].match(new RegExp("proteome", "i")) ||
                                                            service.tags[t2].match(new RegExp("peptide", "i"))
                                                        ) {
                                                            domain["Proteomics"] = "";
                                                        }

                                                        if (service.tags[t2].match(new RegExp("metabolite", "i")) ||
                                                            service.tags[t2].match(new RegExp("metabolomic", "i")) ||
                                                            service.tags[t2].match(new RegExp("metabolome", "i"))
                                                        ) {
                                                            domain["Metabolomics"] = "";
                                                        }

                                                        if (service.tags[t2].match(new RegExp("medical", "i")) ||
                                                            service.tags[t2].match(new RegExp("biomedical", "i"))
                                                        ) {
                                                            domain["Biomedical"] = "";
                                                        }
                                                    }

                                                    // Organize biological domain
                                                    service.domains = [];
                                                    for (var domain_key in domain) {
                                                        service.domains.push(domain_key);
                                                    }

                                                    // Remove redundant keys from tags
                                                    var proteomic_index = service.tags.indexOf("proteomics");
                                                    var proteomics_index = service.tags.indexOf("proteomic");
                                                    var genomic_index = service.tags.indexOf("genomic");
                                                    var genomics_index = service.tags.indexOf("genomics");
                                                    var metabolomic_index = service.tags.indexOf("metabolomic");
                                                    var metabolomics_index = service.tags.indexOf("metabolomics");
                                                    var metagenomic_index = service.tags.indexOf("metagenomic");
                                                    var metagenomics_index = service.tags.indexOf("metagenomics");
                                                    var biomedical_index = service.tags.indexOf("biomedical");

                                                    if (proteomic_index >= 0) {
                                                        service.tags.splice(proteomic_index, 1);
                                                    }

                                                    if (proteomics_index >= 0) {
                                                        service.tags.splice(proteomics_index, 1);
                                                    }

                                                    if (genomic_index >= 0) {
                                                        service.tags.splice(genomic_index, 1);
                                                    }

                                                    if (genomics_index >= 0) {
                                                        service.tags.splice(genomics_index, 1);
                                                    }

                                                    if (metabolomic_index >= 0) {
                                                        service.tags.splice(metabolomic_index, 1);
                                                    }

                                                    if (metabolomics_index >= 0) {
                                                        service.tags.splice(metabolomics_index, 1);
                                                    }

                                                    if (metagenomic_index >= 0) {
                                                        service.tags.splice(metagenomic_index, 1);
                                                    }

                                                    if (metagenomics_index >= 0) {
                                                        service.tags.splice(metagenomics_index, 1);
                                                    }

                                                    if (biomedical_index >= 0) {
                                                        service.tags.splice(biomedical_index, 1);
                                                    }

                                                    // Write JSON to outfile
                                                    fs.appendFileSync(OUTFILE_TEMP_DIRECTORY + outfileName,
                                                        JSON.stringify(service));

                                                    // Write separator if tools or pages remain
                                                    if (j < results.length - 1 || i < pages) {
                                                        fs.appendFileSync(OUTFILE_TEMP_DIRECTORY + outfileName, ",\n");
                                                    }
                                                }
                                            }

                                            // Recursively call itself
                                            if (j < results.length - 1) {
                                                retrieveTools(j + 1);
                                            } else {
                                                // Retrieve a new page
                                                if (i < pages) {
                                                    retrieve_pages(i + 1);
                                                } else {
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

                                // Start recursion
                                retrieveTools(0);
                            }
                        }
                    )
                };

                if (pages > 0) {
                    // Write initial data
                    fs.appendFileSync(OUTFILE_TEMP_DIRECTORY + outfileName,
                        "{\n" +
                        "\"type\": \"" + RESOURCE_TYPE + "\",\n" +
                        "\"date\": \"" + date.toISOString() + "\",\n" +
                        "\"data\": [\n");

                    // Start recursion
                    retrieve_pages(1);

                    return "Retrieving: " + outfileName.toString();
                } else {
                    // Default if no pages
                    return "No tools to retrieve"
                }
            }
        }
    );
};

/**
 * Updates the Aztec database.
 */
BiocatalogServices.update = function () {
};

module.exports = BiocatalogServices;
