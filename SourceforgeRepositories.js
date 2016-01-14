/**
 * Sourceforge Repositories handler.
 * Created by Brian Bleakley on 01/14/2016.
 */

var fs = require("fs");
var request = require("request");
var sf_miner = require("./sf_miner/sf_miner1");

var OUTFILE_DIRECTORY = "public/sourceforge/";
var OUTFILE_BASE_NAME = "sourceforge_repositories";

/**
 * @constructor
 */
var SourceforgeRepositories = function () {
};

// Write to file
var writeToFile = function() {
    // Write initial data
    fs.appendFileSync(OUTFILE_TEMP_DIRECTORY + outfileName,
        "{\n" +
        "\"type\": \"sourceforge\",\n" +
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

/**
 * Returns the latest outfile.
 * @returns {string|String}
 */
SourceforgeRepositories.latest = function () {
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

SourceforgeRepositories.retrieve = function () {
    // Create directories if necessary
    /*if (!fs.existsSync(OUTFILE_DIRECTORY)) {
        fs.mkdirSync(OUTFILE_DIRECTORY);
    }

    if (!fs.existsSync(OUTFILE_TEMP_DIRECTORY)) {
        fs.mkdirSync(OUTFILE_TEMP_DIRECTORY);
    }

    // Generate new timestamped outfile name
    var date = new Date();
    var outfileName = OUTFILE_BASE_NAME + "_" + date.toISOString().replace(/:/g, "-") + ".json";

    var category_hash = {};
    var results = "";*/

    // Run sf_miner1 and sf_miner2
    sf_miner.runRemotely();
                                                
};

module.exports = SourceforgeRepositories;
