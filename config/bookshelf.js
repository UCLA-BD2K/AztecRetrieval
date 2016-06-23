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
        port    : '3306',
        user    : 'developer',
        password: 'ucla2015',
        database: 'AZ_Crawl',
        charset : 'utf8'
    }
});

module.exports = require('bookshelf')(knex);
