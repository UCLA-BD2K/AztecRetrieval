import urllib
from pysolr4 import Solr
from bs4 import BeautifulSoup
import time
import sys
import argparse

solrPort = 8983

#README.md:
# This script connects to the local solr database and downloads all publications by fetching every publication's DOI number
# For testing, only 3 documents get downloaded, remove restriction below. Not all documents get downloaded, only those which are in libgen's
# database, others are ignored.

def get_doi(uglyDoi):
    doi = ""
    flag = 0
    for c in uglyDoi:
        if c == '1' and flag == 0:
            flag = 1
            doi += c
            continue
        if c == ' ' and flag == 1:
            break
        if flag == 1:
            doi += c
    return doi

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('-directory', help='Directory to store the pdf files, example: ./pdfDirectory',
                        type=str, required=True)
    args = parser.parse_args()
    solr = Solr('http://localhost:'+str(solrPort)+'/solr/BD2K')
    result = solr.select(('q', '*:*'), ('rows', '100000'), ('wt', 'json'), ('fl', 'publicationDOI'))
    dois = []
    for doc in result.docs:
        if 'publicationDOI' in doc:
            doi = get_doi(doc['publicationDOI'])
            dois.append(doi)

    # for testing, remove all lines of code having count when you want to download all the documents in the database
    count = 0

    for doi in dois:
        if count == 3:
            break
        libgenUrl = "http://libgen.io/scimag/ads.php?doi="+str(doi)
        response = urllib.urlopen(str(libgenUrl)).read()
        soup = BeautifulSoup(response, 'html.parser')
        pdfUrl = soup.find_all('a')[1].get('href')
        if pdfUrl is not None and pdfUrl != "":
            testfile = urllib.URLopener()
            check = urllib.urlopen(str(pdfUrl)).read()
            if "Article not found" in str(check):
                continue
            doi = str(doi).replace('/','-')
            file = open(args.directory+"/"+doi+".pdf",'w+')
            testfile.retrieve(str(pdfUrl), file.name)

        time.sleep(0.5)                         # precautionary check to not hammer the server with requests
        count += 1

if __name__ == '__main__':
    sys.exit(main())





