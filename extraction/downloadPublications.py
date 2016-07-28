import urllib
from pysolr4 import Solr
from bs4 import BeautifulSoup
import time
import sys
import argparse
import json
import os.path
import re
import xml.etree.ElementTree as ET
import urllib2

solrPort = 8983

# README.md:
# This script connects to the local solr database and downloads all publications by fetching every publication's DOI number
# For testing, only 3 documents get downloaded, remove restriction below. Not all documents get downloaded, only those which are in libgen's
# database, others are ignored.

# Default fetches 100000 documents, change number below to fetch more

to_fetch = 100000
dois = []
pmids = []
oxford_ext = ".full.pdf"
nature_ext = ".pdf"
doiData = dict()


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
    apiUrl = "http://api.crossref.org/works/" + str(doi)
    response = urllib.urlopen(str(apiUrl)).read()
    try:
        parsed_json = json.loads(str(response))
        name_list = str(parsed_json['message']['title'])[3:-2].split()
        # return first 3 words of the title to avoid file naming issues
        return str(name_list[0] + name_list[1] + name_list[2])
    except Exception as e:
        print e


def pmid_doi():
    url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&rettype=xml&id="
    try:
        for pmid in pmids:
            reqUrl = url + str(pmid)
            response = urllib.urlopen(str(reqUrl)).read()
            root = ET.fromstring(response)
            doi = root[0][1][2][1].text
            dois.append(str(doi))
    except Exception as e:
        print e


def extract_pdf(doi, directory):
    url = "http://dx.doi.org/" + str(doi)
    req = urllib2.Request(url)
    res = urllib2.urlopen(req)
    finalurl = res.geturl()
    if "oxford" in finalurl:
        finalurl += oxford_ext
    elif "nature" in finalurl:
        finalurl += nature_ext
    else:
        return
    save_pdf(doi, finalurl, directory)


def save_pdf(doi, url, directory):
    testfile = urllib.URLopener()
    name = get_name(doi)
    name = re.sub(r'\W+', '', name)  # otherwise interprets name as directories
    doiData[name] = doi                 # Remove later
    if os.path.isfile(
        directory +
        '/' +
        name +
            ".pdf"):  # if file already exists, continue
        print "File already exists"
        return
    data = open(directory + "/" + name + ".pdf", 'w+')
    testfile.retrieve(str(url), data.name)
    doiData[name] = doi
    data.close()


def save_doi_data():
    with open('dois.json', 'w') as outfile:
        json.dump(doiData, outfile)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '-directory',
        help='Directory to store the pdf files, example: ./pdfDirectory',
        type=str,
        required=True)
    parser.add_argument(
        '-DOIFile',
        help='File containing list of DOI numbers',
        type=str,
        required=False)
    parser.add_argument(
        '-pubmedFile',
        help='File containing list of PMID ids',
        type=str,
        required=False)
    args = parser.parse_args()
    if args.DOIFile is None and args.pubmedFile is None:       # Get data from local solr server
        solr = Solr('http://localhost:' + str(solrPort) + '/solr/BD2K')
        result = solr.select(
            ('q', '*:*'), ('rows', str(to_fetch)), ('wt', 'json'), ('fl', 'publicationDOI'))
        for doc in result.docs:
            if 'publicationDOI' in doc:
                doi = get_doi(doc['publicationDOI'])
                dois.append(doi)
    else:
        try:
            data = open(args.DOIFile, 'rU')
            for line in data:
                dois.append(line)
            data.close()
        except:
            data = open(args.pubmedFile, 'rU')
            for line in data:
                line = re.sub(r'\W+', '', line)
                pmids.append(line)
            data.close()
            pmid_doi()

    # for testing; remove all lines of code having count when you want to download all the documents in the database/file
    # count = 0
    found = []
    for doi in dois:
        # if count == 3:
        #     break
        libgenUrl = "http://libgen.io/scimag/ads.php?doi=" + str(doi)
        response = urllib.urlopen(str(libgenUrl)).read()
        soup = BeautifulSoup(response, 'html.parser')
        try:
            pdfUrl = soup.find_all('a')[1].get('href')
            if pdfUrl is not None and pdfUrl != "":
                check = urllib.urlopen(str(pdfUrl)).read()
                if "Article not found" in str(check):
                    continue
                found.append(doi)
                save_pdf(doi, pdfUrl, args.directory)
        except Exception as e:
            print e

        # precautionary check to not hammer the server with requests
        # time.sleep(0.2)
        # count += 1

    remaining = list(set(dois) - set(found))
    if len(remaining) == 0:
        save_doi_data()
        return 0
    for doi in remaining:
        extract_pdf(doi, args.directory)
        # time.sleep(0.2)

    save_doi_data()

if __name__ == '__main__':
    sys.exit(main())
