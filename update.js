/**
 * Retrieves and updates all resources.
 * Created by Alan Kha on 3/28/2016.
 */

var BiocatalogServices = require('./BiocatalogServices.js');
var BioconductorPackages = require('./BioconductorPackages.js');
var BioJSPackages = require('./BioJSPackages.js');
var CytoscapeServices = require('./CytoscapeServices.js');
var SourceforgeRepositories = require('./SourceforgeRepositories.js');

// Special executable module encapsulation
// See: http://justindavis.co/2014/11/16/running-node-modules-from-the-command-line/
(function () {
    var updater = {};
    exports.update = updater.update = function () {
        new BioconductorPackages().retrieveAndUpdate();
        new BioJSPackages().retrieveAndUpdate();
        new CytoscapeServices().retrieveAndUpdate();
        new SourceforgeRepositories().retrieveAndUpdate();
    };

    if (!module.parent) {
        updater.update();
    }
})();
