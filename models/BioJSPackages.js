/**
 * BioJSPackages.js [BioJS packages handler]
 * author: Alan Kha on 11/20/2015.
 * updated by: Vincent Kyi <vincekyi@gmail.com>
 *
 * A subclass of Retriever used to extract and update tools from BioJS.
 */

// Dependencies
var fs = require("fs");
var npmKeyword = require('npm-keyword');
var packageJson = require("package-json");

// Model Dependencies
var Retriever = require("../Retriever");

/**
 * BioJSPackages [Model for retrieving and updating MySQL database for BioJS]
 * @constructor
 */
var BioJSPackages = function () {
    var self = this;
    // call Retriever constructor with biojs
    Retriever.call(this, "biojs");

    // member variables
    var BASE_URL = "https://www.npmjs.com/package/";

    // member functions
    this.retrieve = function(callback) { return this._retrieve(self, callback); };

};

// create Retriever object (inhertiance)
BioJSPackages.prototype = Object.create(Retriever.prototype);
BioJSPackages.constructor = BioJSPackages;

/**
 * BioJSPackages.retrieve
 * [Retrieves packages from npmjs.com using npm-keyword and stores as a JSON file in OUTFILE_DIRECTORY.]
 * @param  {Object} self [Reference to BioJSPackages object]
 * @param  {Function} callback [ A callback function that takes in 2 paramters:
 *                             		1 An error object
 *                               	2 The result message (string or object) ]
 * @return {Function}            [The callback function]
 */
BioJSPackages.prototype._retrieve = function (self, callback) {
    // create new out file
    var outfile = self.getNewFile();

    // retrieve all tools with biojs keyword
    npmKeyword('biojs').then(function (biojsPackages) {

        var data = []; // stored tools in data

        // iterate through tools found
        for (var i = 0; i < biojsPackages.length; i++) {
            var pkg_name = biojsPackages[i]["name"];
            console.log("Retrieving " + pkg_name);

            // Retrieve json format
            packageJson(pkg_name, "latest").then(function (jsonPackage) {
                var pkg = {};
                pkg.sourceID = jsonPackage.name; // Use name as ID
                pkg.name = jsonPackage.name;
                pkg.version = [jsonPackage.version];
                pkg.description = jsonPackage.description;

                if ("author" in jsonPackage) {
                    pkg.authors = [jsonPackage.author.name];
                    pkg.authorEmails = [jsonPackage.author.email];
                }
                pkg.tags = jsonPackage.keywords;
                pkg.sourceCodeURL = jsonPackage.repository.url;
                pkg.linkDescriptions = ["Homepage", "Documentation", "Bugs"];
                pkg.linkUrls = [self.BASE_URL + jsonPackage.name, jsonPackage.homepage, jsonPackage.bugs.url];
                pkg.types = ["Widget"];
                pkg.platforms = ["Web UI"];
                pkg.languages = ["JavaScript"];

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

                // extract keywords for tags
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

                    // Write closing brackets and braces
                    fs.appendFileSync(self.OUTFILE_TEMP_DIRECTORY + outfile, JSON.stringify(data));

                    // Move file out of temp directory when complete
                    fs.renameSync(self.OUTFILE_TEMP_DIRECTORY + outfile, self.OUTFILE_DIRECTORY + outfile);
                    console.log("Complete: " + outfile);

                    // Execute callback
                    return callback(null, "Retrieved " + outfile);
                }
            });
        }
    });

};

module.exports = BioJSPackages;
