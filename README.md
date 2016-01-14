AztecRetrieval
===================
	BD2K Center of Excellence for Big Data Computing at UCLA

	Alan Kha            akhahaha@gmail.com
	Chelsea Ju          chelseaju@cs.ucla.edu
-------------------------------------------------------------------------------
Overview
---------------
Crawls various repositories for bioinformatics packages.

Usage
---------------
The `/retrieve` endpoint runs a new crawl for a given respotiory.
The `/latest` to endpoint returns the latest crawl for a given repository.

Each crawl is packaged under `data` in a JSON envelope of the following format:
```
{
    "type": "biocatalog",
    "date": "2015-12-02T01:53:30.534Z",
    "data": [...]
}
```
The sourceforge crawler does not return JSON of the same format; it uses the newer format used in [Aztec_Curation](https://github.com/UCLA-BD2K/Aztec_Curation).

### Endpoints
Request Type | Path
------------ | -------------
POST | `/biocatalog/retrieve`
GET | `/biocatalog/latest`
POST | `/bioconductor/retrieve`
GET | `/bioconductor/latest`
POST | `/biojs/retrieve`
GET | `/biojs/latest`
POST | `/cytoscape/retrieve`
GET | `/cytoscape/latest`
POST | `/galaxy/retrieve`
GET | `/galaxy/latest`
POST | `/sourceforge/retrieve`
GET | `/sourceforge/latest`

Future Tasks
---------------
 - Consolidate repeated functions (`latest` retrieval, JSON envelope wrapping)
 - Implement true POST/GET functionality
