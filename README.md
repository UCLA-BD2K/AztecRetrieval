AztecRetrieval
===================
	BD2K Center of Excellence for Big Data Computing at UCLA

	Vincent Kyi         vincekyi@gmail.com
	Brian Bleakley      brianbleakley@gmail.com
	Chelsea Ju          chelseaju@cs.ucla.edu
-------------------------------------------------------------------------------
Overview
---------------
Crawls various repositories for bioinformatics packages and updates the Aztec
databases.

Installation
---------------

To start webserver, run:
```js
$ docker run -d --name az_mysql -p 3306:3306 vincekyi/aztec-mysql:0.2
$ docker run -d --name az_mongo -p 27017:27017 vincekyi/aztec-mongo:0.2
$ docker run -d --name az_solr -p 8983:8983 vincekyi/aztec-solr:0.2
$ sudo npm install
$ npm start
# using nodemon, first install, then call nodemon
$ npm install -g nodemon
$ nodemon
```

Usage (Not up-to-date)
---------------
The root `update` endpoint runs retrieveAndUpdate for all repositories (not to
be confused with individual repository `update` endpoints).
This endpoint can be executed manually using `$ node update.js`.

### Repository Endpoints*
The `/retrieve` endpoints runs a new crawl** for a given repository.
The `/update` endpoints updates the database from the latest crawl.
The `/retrieveAndUpdate` endpoints runs a new crawl and updates the database.
The `/latest` endpoints returns the latest crawl for a given repository.

\* All repository endpoints are preceded by the repository name.

** Each crawl is packaged under `data` in a JSON envelope. Example:
```
{
    "type": "biocatalog",
    "date": "2015-12-02T01:53:30.534Z",
    "data": [...]
}
```

### Endpoint Table (Not up to date)
Request Type | Path
------------ | -------------
POST | `/update`
POST | `/biocatalog/retrieve`
POST | `/biocatalog/update`
POST | `/biocatalog/retrieveAndUpdate`
GET | `/biocatalog/latest`
POST | `/bioconductor/retrieve`
POST | `/bioconductor/update`
POST | `/bioconductor/retrieveAndUpdate`
GET | `/bioconductor/latest`
POST | `/biojs/retrieve`
POST | `/biojs/update`
POST | `/biojs/retrieveAndUpdate`
GET | `/biojs/latest`
POST | `/cytoscape/retrieve`
POST | `/cytoscape/update`
POST | `/cytoscape/retrieveAndUpdate`
GET | `/cytoscape/latest`
POST | `/sourceforge/retrieve`
GET | `/sourceforge/latest`
POST | `/sourceforge/update`
POST | `/sourceforge/retrieveAndUpdate`
