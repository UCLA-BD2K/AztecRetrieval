updateCitations.py - This script is used to update the documents in the solr database, is different from the other 3 scripts.

The following 3 scripts must be run in the given order:

1. downloadPublications.py ===> Get all publications as pdf, open script to modify storage directory

2. pdf_extract.py ==> Extract pdf to xml and plain text data

3. parse_extracts.py ==> Parse the xml and plain text data into a single output file containing all the metadata