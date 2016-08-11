updateMetadata.py - This script is used to update the documents in the solr database. Current threshold is 2 hours for testing purposes, change as desired.

checkForPublications.py - This script checks pubmed for new publications from specific journals, number of days is parameter to be passed in.

The following 4 scripts must be run in the given order:

1. downloadPublications.py ===> Get all publications as pdf, open script to modify storage directory
    Use pip to install the following:
        bs4 (BeautifulSoup)
        TorCtl
        pycurl
    Set up tor and privoxy on your machine, following 2 links are helpful for Linux/OS X:
        http://sacharya.com/crawling-anonymously-with-tor-in-python/   (Ignore script part)
        http://www.andrewwatters.com/privoxy/
        
    Run via python downloadPublications.py -directory pdfDir/ -pubmedFile pmid.txt/ or DOI file

2. pdf_extract.py ==> Extract pdf to xml and plain text data using grobid running on localhost 8080

3. parse_extracts.py ==> Parse the xml and plain text data into a single output file containing all the metadata

4. pushToSolr.py ==> Push output json file into localhost solr instance running on port 8983