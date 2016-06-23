/**
 * Solr Client configuration
 */

// Use `var solr = require('solr-client')` in your code
var solr = require('solr-client');

// Create a client
var client = solr.createClient("192.168.99.100", "8983", "BD2K", "/solr");

// Switch on "auto commit", by default `client.autoCommit = false`
client.autoCommit = true;

module.exports = client;
