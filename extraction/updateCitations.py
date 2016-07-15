import urllib2
from pysolr4 import Solr
import sys
import xml.etree.ElementTree as ET
import time

#README.md:
# This script connects to the local solr database and updates the citation count of every publication by using crossref's api.
# If citations field is not in schema.xml, then add it, field must be indexed and stored.

port = 8983

class Document(object):
    id = None
    doiNumber = None

documents = []

def get_documents(result):
    for doc in result.docs:
        d = Document()
        d.id = doc['id']
        if 'publicationDOI' in doc:
            uglyDoi = doc['publicationDOI']
        else:
            continue
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
        d.doiNumber = doi
        documents.append(d)

def get_citations(doi):
    if "10." not in str(doi):
        return 0
    email = 'avirudhtheraja@gmail.com'
    url = 'http://www.crossref.org/openurl/?pid='+str(email)+'&id=doi:'+str(doi)+'&noredirect=true'
    response = urllib2.urlopen(str(url)).read()
    if "Malformed" in response:
        return 0
    root = ET.fromstring(str(response))
    return root[0][1][0].attrib['fl_count'] #the number of citations


def main():
    solr = Solr('http://localhost:8983/solr/BD2K')
    result = solr.select(('q', '*:*'), ('rows', '100000'), ('wt', 'json'), ('fl', 'id,publicationDOI'))  # randomly added 100000 as rows to get all the documents
    get_documents(result)
    dictionaryDoi = dict()
    dictionaryId = dict()
    for doc in documents:
        if doc.doiNumber is not None and doc.doiNumber not in dictionaryDoi:
            numCitations = get_citations(doc.doiNumber)
            time.sleep(0.2)
            dictionaryDoi[doc.doiNumber] = numCitations
            dictionaryId[doc.id] = numCitations
            print numCitations
        elif doc.doiNumber is not None and doc.doiNumber in dictionaryDoi:
            dictionaryId[doc.id] = dictionaryDoi[doc.doiNumber]

    # Now we have to update all the documents accordingly using dictionaryId
    url = 'http://localhost:'+port+'/solr/BD2K/update?commit=true'
    for key in dictionaryId:
        numCitations = dictionaryId[key]
        data = '[{"id":"' + str(key) + '", "citations":{"set":' + str(numCitations) + '}}]'
        req = urllib2.Request(url, data, {'Content-Type': 'application/json'})
        f = urllib2.urlopen(req)
        print key
        print numCitations
        for x in f:
            print(x)
        f.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
