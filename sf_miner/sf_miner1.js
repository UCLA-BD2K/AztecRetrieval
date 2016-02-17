var request = require('request');
var fs = require('fs');
var HashMap = require('hashmap');
var sf_miner2 = require('./sf_miner2');

/*
 Downloads project names of all sourceforge results in all specified categories.
 */

var categories = ['bioinformatics', 'medical', 'molecular-science'];

var map = new HashMap(); //this map exists to prevent duplication between categories

var totalNumberOfPages = 1; //set by htmlParseCallback once on the first page for each category

var pageNumber = 1; //current page number
var categoryNumber = 0; //current category index

var finalCallback = saveData;

//software that we don't want in Aztec for whatever reason
//this should probably become part of a database
var blacklist = ['lra', 'evolutiongame', 'gamer', 'agatca', 'caixadepandora', 'gameaccess', 'drinkandtrack', 'lifeflight', 'gardenplot'];

var htmlParseCallback = function (error, response, body) {
    if (!error && response.statusCode == 200) {
        if (pageNumber == 1) {
            console.log("Reading pages for '" + categories[categoryNumber] + "'.")
            var regex0 = /<p id="result_count">\s+Showing page [0-9]+ of ([0-9]+).\s<\/p>/g;
            totalNumberOfPages = regex0.exec(body)[1];
            console.log('Pages detected: ' + totalNumberOfPages);
        }

        var regex1 = /<header><a href="\/projects\/([^\.]+)\/\?source=directory" itemprop="url" title="Find out more about .+"><span itemprop="name">(.+)<\/span><\/a><\/header>/g;
        //first capture group is machine-readable name, second capture group is human-readable name
        //we are ignoring all items with a '.' in the machine-readable name because these are imported
        //from BerliOS and do not resolve with the rest api
        var count = body.match(regex1).length;

        console.log(count + ' on page ' + pageNumber + ' of ' + totalNumberOfPages + '.');

        for (var i = 0; i < count; i++) {
            var project = {};
            var scan = regex1.exec(body);
            project.human_readable_name = scan[2];
            project.machine_readable_name = scan[1];
            map.set(project.machine_readable_name, project);
        }

        pageNumber++;
        if (pageNumber <= totalNumberOfPages) {
            startNewRequest();
        }
        else {
            categoryNumber++;
            if (categoryNumber < categories.length) {
                pageNumber = 1;
                startNewRequest();
            }
            else mineComplete();
        }
    }
};

var mineComplete = function () {
    //remove all blacklisted software
    for (var i = 0; i < blacklist.length; i++)
        map.remove(blacklist[i]);

    var identifiedProjects = map.values();
    finalCallback(identifiedProjects);
};

var saveData = function (outputData) {
    //done
    var file = "./sf_miner_output_" + outputData.length + "_projects.json";
    fs.writeFile(file, JSON.stringify(outputData, null, 1), function (err) {
        if (err) {
            return console.log(err);
        }

        console.log("The file was saved as " + file);
    });
};

var passData = function (outputData) {
    sf_miner2.runFromJson(outputData);
};

var startNewRequest = function () {
    request({url: 'http://sourceforge.net/directory/science-engineering/' + categories[categoryNumber] + '/?page=' + pageNumber}, htmlParseCallback);
};

//startNewRequest(); //start it

module.exports = {
    runRemotely: function () {
        finalCallback = passData;
        startNewRequest();
    }
};
