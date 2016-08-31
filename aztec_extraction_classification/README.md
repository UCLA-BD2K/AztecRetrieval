updateCitations.py - This script is used to update the documents in the solr database, is different from the other 3 scripts.

The following 3 scripts must be run in the given order:

1. downloadPublications.py ===> Get all publications as pdf, open script to modify storage directory
    Use pip to install the following:
        bs4 (BeautifulSoup)
        TorCtl
        pycurl
    Set up tor and privoxy on your machine, following 2 links are helpful for Linux/OS X:
        http://sacharya.com/crawling-anonymously-with-tor-in-python/   (Ignore script part)
        http://www.andrewwatters.com/privoxy/
        
    Run via python downloadPublications.py -directory pdfDir/ -pubmedFile pmid.txt

2. pdf_extract.py ==> Extract pdf to xml and plain text data

3. parse_extracts.py ==> Parse the xml and plain text data into a single output file containing all the metadata