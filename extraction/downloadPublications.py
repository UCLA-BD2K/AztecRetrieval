import urllib
from pysolr4 import Solr
from bs4 import BeautifulSoup
import time
import sys
import argparse
import json
import os.path

solrPort = 8983

#README.md:
# This script connects to the local solr database and downloads all publications by fetching every publication's DOI number
# For testing, only 3 documents get downloaded, remove restriction below. Not all documents get downloaded, only those which are in libgen's
# database, others are ignored.

# Default fetches 100000 documents, change number below to fetch more

to_fetch = 100000

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

def get_name(doi):
    print doi
    apiUrl = "http://api.crossref.org/works/"+str(doi)
    response = urllib.urlopen(str(apiUrl)).read()
    if "not found" in response:
        return "Untitled"
    parsed_json = json.loads(str(response))
    name_list = str(parsed_json['message']['title'])[3:-2].split()
    return str(name_list[0]+name_list[1]+name_list[2])      # return first 3 words of the title to avoid file naming issues

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('-directory', help='Directory to store the pdf files, example: ./pdfDirectory',
                        type=str, required=True)
    parser.add_argument('-file', help='File containing list of DOI numbers', type=str, required=False)
    args = parser.parse_args()
    dois = []
    if args.file is None:       # Get data from local solr server
        solr = Solr('http://localhost:'+str(solrPort)+'/solr/BD2K')
        result = solr.select(('q', '*:*'), ('rows', str(to_fetch)), ('wt', 'json'), ('fl', 'publicationDOI'))
        for doc in result.docs:
            if 'publicationDOI' in doc:
                doi = get_doi(doc['publicationDOI'])
                dois.append(doi)
    else:
        file = open(args.file,'rU')
        for line in file:
            dois.append(line)
        file.close()

    # for testing,remove all lines of code having count when you want to download all the documents in the database/file
    # count = 0

    for doi in dois:
        # if count == 3:
        #     break
        libgenUrl = "http://libgen.io/scimag/ads.php?doi="+str(doi)
        response = urllib.urlopen(str(libgenUrl)).read()
        soup = BeautifulSoup(response, 'html.parser')
        pdfUrl = soup.find_all('a')[1].get('href')
        if pdfUrl is not None and pdfUrl != "":
            testfile = urllib.URLopener()
            check = urllib.urlopen(str(pdfUrl)).read()
            if "Article not found" in str(check):
                continue
            name = get_name(doi)
            name = name.replace('/','.')                # otherwise interprets name as directories
            if os.path.isfile(args.directory+'/'+name+".pdf"):      # if file already exists, continue
                continue
            file = open(args.directory+"/"+name+".pdf",'w+')
            testfile.retrieve(str(pdfUrl), file.name)

        time.sleep(0.5)                         # precautionary check to not hammer the server with requests
        # count += 1

if __name__ == '__main__':
    sys.exit(main())





