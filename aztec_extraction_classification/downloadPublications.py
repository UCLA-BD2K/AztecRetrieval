#!/usr/bin/python
import urllib
from bs4 import BeautifulSoup
import sys
import json
import re
import xml.etree.ElementTree as ET
import urllib2
import Queue
from threading import Thread
import random
import time
import pycurl
from TorCtl import TorCtl
import os
# We should ignore SIGPIPE when using pycurl.NOSIGNAL - see
# the libcurl tutorial for more info.
try:
    import signal
    from signal import SIGPIPE, SIG_IGN
    signal.signal(signal.SIGPIPE, signal.SIG_IGN)
except ImportError:
    pass
user_agent = [
    'Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US; rv:1.9.0.7) Gecko/2009021910 Firefox/3.0.7',
    'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.75.14 (KHTML, like Gecko) Version/7.0.3 Safari/7046A194A']

pmids = []
oxford_ext = ".full.pdf"
nature_ext = ".pdf"
doiData = dict()
docs = []
num_threads = 4   # Decrease if bandwidth limit exceeds, http error 509
extract_failed = False


def _set_urlproxy():
    proxy_support = urllib2.ProxyHandler({"http": "127.0.0.1:8118"})
    opener = urllib2.build_opener(proxy_support)
    urllib2.install_opener(opener)


def get_ip_address():
    url = "http://icanhazip.com/"
    _set_urlproxy()
    headers = {'User-Agent': user_agent[random.randint(0, 3)]}
    request = urllib2.Request(url, None, headers)
    return urllib2.urlopen(request).read()

# This function is called when bandwidth limit exceeds on one IP to switch
# to another


def renew_connection():
    old_ip = get_ip_address()
    print "Old ip address is " + old_ip
    conn = TorCtl.connect(
        controlAddr="127.0.0.1",
        controlPort=9051,
        passphrase="9971517234")
    conn.send_signal("NEWNYM")
    conn.close()
    new_ip = get_ip_address()
    while new_ip == old_ip:
        new_ip = get_ip_address()
    print "New ip address is " + new_ip


class Document(object):
    doi = None
    url = None
    name = None

# Thread class used to convert list of pmids to dois


class PmidConverter(Thread):

    def __init__(self, queue):
        Thread.__init__(self)
        self.queue = queue

    def run(self):
        while True:
            # Get the work from the queue
            pmid = self.queue.get()
            doi = pmid_doi(pmid)
            d = Document()
            d.doi = doi
            docs.append(d)
            self.queue.task_done()


class NameFetcher(Thread):

    def __init__(self, queue):
        Thread.__init__(self)
        self.queue = queue

    def run(self):
        while True:
            # Get the work from the queue
            doc = self.queue.get()
            doc.name = get_name(doc.doi)
            self.queue.task_done()

# Check if article exists in libgen and if it does update url


# def libgen_check(doc, directory):
#     libgen_url = "http://libgen.io/scimag/ads.php?doi=" + str(doc.doi)
#     try:
#         response = urllib.urlopen(str(libgen_url)).read()
#         soup = BeautifulSoup(response, 'html.parser')
#         pdf_url = soup.find_all('a')[1].get('href')
#         if pdf_url is not None and pdf_url != "":
#             check = urllib.urlopen(str(pdf_url)).read()
#             if "Article not found" in str(check):
#                 return
#             doc.url = pdf_url
#             print "Url extraction from libgen successful for " + doc.doi
#         download(directory, doc)
#     except Exception as e:
#         print "Url extraction failed from libgen"
#         doc.url = None
#         print e

# Get name of document using crossref api


def get_name(doi):
    api_url = "http://api.crossref.org/works/" + str(doi)
    try:
        print api_url
        response = urllib.urlopen(str(api_url)).read()
        parsed_json = json.loads(str(response))
        name = parsed_json['message']['title'][0]
        # replace non words and non space with nothing to avoid issues
        name = re.sub(r'[^ \w]+', '', name)
        name_list = name.split()
        # Get first 6 words as name, if 6 less than number of words in title
        if len(name_list) < 6:
            name = ' '.join(name_list[:len(name_list)])
        else:
            name = ' '.join(name_list[:6])
        return name
    except Exception as e:
        print e
        return "Name not found, crossref name error"

# Convert pmid to doi using eutils API


def pmid_doi(pmid):
    url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&rettype=xml&id=" + \
        str(pmid)
    try:
        print "nih converter url is " + url
        response = urllib.urlopen(str(url)).read()
        root = ET.fromstring(response)
        return root[0][1][2][1].text
    except Exception as e:
        print "DOI not found in eutils"
        print e
        return None

# Extraction request handled through tor/proxy to avoid 509 errors


def get_page(url):
    if "nature" in url:
        return url

    _set_urlproxy()
    headers = {'User-Agent': user_agent[random.randint(0, 3)]}
    global extract_failed
    try:
        req = urllib2.Request(url, None, headers)
        res = urllib2.urlopen(req)
        extract_failed = False
        return res.geturl()
    except urllib2.HTTPError as e:
        print e
        print "Download url fetching failed from " + url
        if e.code == 509:
            print "Renewing connection and trying again"
            extract_failed = True
        return None
    except Exception as e:
        print e
        print "Download url fetching failed from " + url
        return None

# Extract download url from some specific journals


def handle_nature(doi):
    try:
        url = "http://api.crossref.org/works/" + doi
        response = urllib2.urlopen(url).read()
        parsed_json = json.loads(str(response))
        issue = parsed_json['message']['issue']
        volume = parsed_json['message']['volume']
    except Exception as e:
        print e
        print "Crossref nature extraction failed"
        return None
    suffix = str(doi).split("/")[1]
    return "http://nature.com/nbt/journal/v"+volume+"/n"+issue+"/pdf/"+suffix+".pdf"


def get_final_url(final_url, doi):
    if "oxford" in final_url:
        return final_url + oxford_ext
    if "nature" in final_url:
        return handle_nature(doi)
    if "bmcbioinformatics" in final_url:
        return "http://bmcbioinformatics.biomedcentral.com/track/pdf/"+doi+"?site=bmcbioinformatics.biomedcentral.com"


def extract_url(doc):
    try:
        url = "http://dx.doi.org/api/handles/" + str(doc.doi)
        response = urllib.urlopen(str(url)).read()
        parsed_json = json.loads(str(response))
        lookup_url = parsed_json['values'][0]['data']['value']
        print "Calling get_page with url " + lookup_url
        final_url = get_page(lookup_url)
        if final_url is None:
            return
        doc.url = get_final_url(final_url, doc.doi)
        if doc.url is None:
            return
        print "Manually extracted url is " + doc.url
    except Exception as e:
        print e
        print "Manual extraction of url failed"
        if doc.doi is not None:
            print "Failed with doi number " + doc.doi
        doc.url = None

# Save dictionary data as json, used in later script for setting doi based
# on name


def save_doi_data():
    for doc in docs:
        doiData[doc.name] = doc.doi
    with open('dois.json', 'w') as outfile:
        outfile.write(json.dumps(doiData, indent=2))

# PMID to DOI conversion


def start_conversion():
    queue = Queue.Queue()
    for x in range(num_threads):
        worker = PmidConverter(queue)
        worker.daemon = True
        worker.start()

    for pmid in pmids:
        queue.put(pmid)

    queue.join()


def update_name(directory):
    queue = Queue.Queue()
    for x in range(num_threads):
        worker = NameFetcher(queue)
        worker.daemon = True
        worker.start()

    for doc in docs:
        queue.put(doc)

    queue.join()

    downloaded = set(os.listdir(directory))
    global docs
    docs = [doc for doc in docs if doc.name + ".pdf" not in downloaded]

# Main download function, no concurrent downloads to avoid hammering
# server too much


def download(directory, doc):
    num_conn = 1
    queue = []
    url = doc.url
    filename = directory + doc.name + ".pdf"
    queue.append((url, filename))

    # Check args
    assert queue, "no URLs given"
    num_urls = len(queue)
    num_conn = min(num_conn, num_urls)
    assert 1 <= num_conn <= 10000, "invalid number of concurrent connections"
    print "PycURL %s (compiled against 0x%x)" % (pycurl.version, pycurl.COMPILE_LIBCURL_VERSION_NUM)
    print "----- Getting", num_urls, "URLs using", num_conn, "connections -----"

    # Pre-allocate a list of curl objects
    m = pycurl.CurlMulti()
    m.handles = []
    for i in range(num_conn):
        c = pycurl.Curl()
        c.fp = None
        c.setopt(pycurl.FOLLOWLOCATION, 1)
        c.setopt(pycurl.MAXREDIRS, 5)
        c.setopt(pycurl.CONNECTTIMEOUT, 30)
        c.setopt(pycurl.TIMEOUT, 300)
        c.setopt(pycurl.NOSIGNAL, 1)
        c.setopt(pycurl.USERAGENT, user_agent[random.randint(0, 3)])
        m.handles.append(c)

    # Main loop
    freelist = m.handles[:]
    num_processed = 0
    while num_processed < num_urls:
        # If there is an url to process and a free curl object, add to multi
        # stack
        while queue and freelist:
            url, filename = queue.pop(0)
            c = freelist.pop()
            c.fp = open(filename, "wb")
            c.setopt(pycurl.URL, url)
            c.setopt(pycurl.WRITEDATA, c.fp)
            m.add_handle(c)
            # store some info
            c.filename = filename
            c.url = url
        # Run the internal curl state machine for the multi stack
        while True:
            ret, num_handles = m.perform()
            if ret != pycurl.E_CALL_MULTI_PERFORM:
                break
        # Check for curl objects which have terminated, and add them to the
        # freelist
        global extract_failed
        while True:
            num_q, ok_list, err_list = m.info_read()
            for c in ok_list:
                c.fp.close()
                c.fp = None
                m.remove_handle(c)
                print "Success:", c.filename, c.url, c.getinfo(pycurl.EFFECTIVE_URL)
                freelist.append(c)
                extract_failed = False
            for c, errno, errmsg in err_list:
                c.fp.close()
                c.fp = None
                m.remove_handle(c)
                print "Failed: ", c.filename, c.url, errno, errmsg
                freelist.append(c)
                if c.getinfo(pycurl.HTTP_CODE) == 509:
                    print "Download unsuccessful for " + c.url
                    print "Limit exceeded on current IP, renewing connection and trying again"
                    extract_failed = True
            num_processed = num_processed + len(ok_list) + len(err_list)
            if num_q == 0:
                break
        # Currently no more I/O is pending, could do something in the meantime
        # (display a progress bar, etc.).
        # We just call select() to sleep until some more data is available.
        m.select(1.0)

    # Cleanup
    for c in m.handles:
        if c.fp is not None:
            c.fp.close()
            c.fp = None
        c.close()
    m.close()


def pmid_or_doi(line):
    if line.isdigit():
        # We have PMID
        pmids.append(line)
    else:
        # We have DOI
        d = Document()
        d.doi = line
        docs.append(d)


def main(filename, directory=None):
    if not filename:
        print "Please input file containing DOI and/or PMID numbers"
        sys.exit(1)
    if directory is None:
        directory = 'pdfDir/'
        if not os.path.isdir(directory):
            os.makedirs(directory)
    else:
        if not os.path.isdir(directory):
            os.makedirs(directory)
        directory = directory + '/' if directory[-1] is not '/' else directory
    try:
        with open(filename, 'rU') as numbers:
            for line in numbers:
                line = line.strip()
                line = line.replace('"', '')
                line = line.replace("'", '')
                line = line.replace(",", '')
                pmid_or_doi(line)
    except Exception as e:
        print e
        print "File could not be opened/processed, please check filename/path"

    if pmids:
        start_conversion()
    global docs
    docs = [doc for doc in docs if doc.doi is not None]

    update_name(directory)   # Fetch names and remove files from doc which already exist in directory

    save_doi_data()         # Save DOI records, to be used later

    # update_url(args.directory)  # Update urls using libgen as default
    # database

    # for doc in docs:
    #     libgen_check(doc, args.directory)
    renew_connection()          # Change ip before starting
    for doc in docs:
        extract_url(doc)
        if extract_failed:
            renew_connection()
            extract_url(doc)
        if doc.url is not None:
            download(directory, doc)
            if extract_failed:
                renew_connection()
                download(directory, doc)


if __name__ == '__main__':
    if len(sys.argv) == 3:
        sys.exit(main(sys.argv[1], sys.argv[2]))
    elif len(sys.argv) == 2:
        sys.exit(main(sys.argv[1]))
