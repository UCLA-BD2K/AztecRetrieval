from pymongo import MongoClient
import requests
from bs4 import BeautifulSoup
import time
import xml.etree.ElementTree as ET
import re

PUBMED_RETMAX = 1000
PUBMED_ID_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&rettype=xml&id='
PUBMED_JOURNAL_URL = 'http://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax='+str(PUBMED_RETMAX)+'&sort=relevance&field=journal&term="{0}"&retstart={1}'
DOI_ID_URL = 'http://dx.doi.org/'
DOI_REGEX = '\b(10[.][0-9]{4,}(?:[.][0-9]+)*/(?:(?!["&\'<>])[[:graph:]])+)\b'


def extractAbstract(doi):
    doi_url = DOI_ID_URL+str(doi)

    time.sleep(3)
    # make request for abstract
    req = requests.get(doi_url)
    soup = BeautifulSoup(req.text, 'html.parser')
    # parse and extract abstract from webpage
    abstract = BeautifulSoup(str(soup.find(id='abstract-1')), 'html.parser')

    return abstract.get_text()


def retrievePub_helper(pubIDs, classifiedPubs={}):
    # call the pubmed API with IDs and get the results

    results = [] # return array of objects
    xml_data = [] # data received from query in XML format
    for id in pubIDs:
        tempURL = PUBMED_ID_URL + id
        try:
            r = requests.get(tempURL)
            xml_data.append(r.text)
            print "Retrieving:", id
        except Exception as e:
            print e

    # parse the xml results and just get the article title and abstract
    for data in xml_data:
        root = ET.fromstring(data.encode('utf-8'))
        pmid = root.find('PubmedArticle').find('MedlineCitation').find('PMID').text
        article = root.find('PubmedArticle').find('MedlineCitation').find('Article')
        obj = {}

        if len(classifiedPubs)!=0:
            obj = classifiedPubs[pmid]

        obj['pmid'] = pmid
        obj['title'] = article.find('ArticleTitle').text
        obj['abstract'] = ''

        full_info_count = 0 # keeps track of how many sections were found in pubmed

        try:
            abstractXML = article.find('Abstract')
            if abstractXML is not None:
                for section in abstractXML.findall('AbstractText'):
                    if section.text is not None:
                        full_info_count+=1
                        obj['abstract'] += section.text
        except Exception as e:
            print "Could not find abstract from pubmed"
            print e

        try:
            doi = re.match(DOI_REGEX, article.find('ELocationID').text)
            if doi is None:
                for id in root.find('PubmedArticle').find('PubmedData').find('ArticleIdList').findall('ArticleId'):
                    if id.get('IdType') == 'doi':
                        doi = id.text
                        obj['doi'] = doi
        except Exception as e:
            print "Could not find doi"
            print e

        # if pubmed does not have the abstract or if it seems like it is missing info, extract abstract from website
        if obj['abstract'] == '' or obj['abstract'] is None or full_info_count < 3 or len(obj['abstract']) < 400:
            if 'doi' in obj:
                abstract = extractAbstract(obj['doi'])
                if abstract is not None and abstract is not "None":
                    obj['abstract'] = abstract

        # Add to results only if abstract was retrieved
        if obj['abstract'] != '' and obj['abstract'] is not None:
            results.append(obj)
        print "Retrieved", obj['title']

    return results


def main():
    client = MongoClient('mongodb://BD2K:ucla4444@ds145415.mlab.com:45415/dois')
    db = client['dois']
    info = db['numbers']
    pmids = []
    with open("pmids.txt", "r") as ids:
        for line in ids:
            pmids.append(line)
    results = retrievePub_helper(pmids)
    for obj in results:
        obj['journal'] = "BMC bioinformatics"
        obj['is_tool'] = False
    info.insert_many(results)

if __name__ == '__main__':
    main()










