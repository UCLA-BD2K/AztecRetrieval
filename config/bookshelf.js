/**
 * Bookshelf reference module.
 * Created by AK on 1/5/2016.
 */

// Initialize Knex
// TODO Move database info to local variables
var knex = require('knex')({
    client:'mysql',
    connection: {
        host    : '192.168.99.100',
        port    : '32768',
        user    : 'developer',
        password: 'ucla2015',
        database: 'AZ_Curation',
        charset : 'utf8'
    }
});

module.exports = require('bookshelf')(knex);
