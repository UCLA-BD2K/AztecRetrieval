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
var AztecInputs = function () {
    Retriever.call(this, "oldAztec");
};

AztecInputs.prototype = Object.create(Retriever.prototype);
AztecInputs.constructor = AztecInputs;

/**
 * Retrieves old Aztec entries from ./public/oldAztec/user-submissions.json and stores them in a JSON file.
 */
AztecInputs.prototype.retrieve = function (callback) {
  var outfile = this.getNewFile();
  var file = require('./public/oldAztec/user-submissions.json');
  var json = file.response.docs;

  var outfile = this.getNewFile();
  var base = this;
  var entries = [];
  console.log(base.OUTFILE_DIRECTORY);
  Promise.all(json.map(function(tool){

    var entry = {};
    entry.name = tool.name;
    entry.source = 'USER INPUT';
    entry.description = tool.description;
    entry.version = tool.versionNum || null;
    entry.versionDate = tool.versionDate || null;
    entry.sourceCodeURL = tool.sourceCodeURL || null;
    entry.domains = tool.domains || null;
    entry.maintainers = tool.maintainers || null;
    entry.maintainerEmails = tool.maintainerEmails || null;
    entry.linkDescriptions = tool.linkDescriptions || null;
    entry.linkUrls = tool.linkUrls || null;
    entry.authors = tool.authors || null;
    entry.authorEmails = tool.authorEmails || null;
    entry.tags = tool.tags || null;
    entry.types = tool.types || null;
    entry.funding = tool.funding || null;
    entry.publicationDOI = tool.publicationDOI || null;
    entry.toolDOI = tool.toolDOI || null;
    entry.institutions = tool.institutions || null;
    entry.licenses = tool.licenses || null;
    entry.platforms = tool.platforms || null;
    entry.owners = tool.owners || null;

    if(tool.language){
      entry.languages = tool.language.split(', ');
    }

    entries.push(entry);
  })).then(function(){
    // console.log(entries);
    fs.writeFile(base.OUTFILE_TEMP_DIRECTORY + outfile, JSON.stringify(entries, null, 1), function (err) {
        if (err) {
            return console.log(err);
        }

        fs.renameSync(base.OUTFILE_TEMP_DIRECTORY + outfile, base.OUTFILE_DIRECTORY + outfile);
        console.log("Complete: " + outfile);

        // Execute callback
        // callback(null, outfile);
    });
  });


};

module.exports = AztecInputs;
