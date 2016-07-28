updateCitations.py - This script is used to update the documents in the solr database, is different from the other 3 scripts.

The following 4 scripts must be run in the given order:

1. downloadPublications.py ===> Get all publications as pdf

2. pdf_extract.py ==> Extract pdf to xml and plain text data

3. parse_extracts.py ==> Parse the xml and plain text data into a single output file containing all the metadata

4. pushToSolr.py ==> Push final extracted data into local solr server running on port 8983