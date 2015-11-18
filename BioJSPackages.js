/*
 * BioJS packages handler.
 * Created by AK on 11/20/2015.
 */

// Load packages
var fs = require("fs");
var npmKeyword = require('npm-keyword');
var packageJson = require("package-json");

/**
 * @constructor
 */
var BioJSPackages = function () {

};

// Output file
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
            "\"type\": \"biojs\",\n" +
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

module.exports = BioJSPackages;
