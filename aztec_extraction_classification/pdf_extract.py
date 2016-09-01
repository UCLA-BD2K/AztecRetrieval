import argparse
import subprocess
from os import listdir
from os.path import isfile, join
from threading import Thread
import Queue
import time
import os
# README.md:
# At this point, the script assumes that the Journal pdf for the correct publication DOI (previously determined using CrossRef) has been downloaded to a Folder.
# All PDFs within the folder are read and parsed through Grobid (which has pretrained CRF models in it) to extract the text in the PDF into an annotated XML.
# The XML is in TEI format. Additionally, the raw text from the PDF is
# also extract to a different folder.

# requires pdftotext, brew install homebrew/x11/xpdf

# GROBID has a bug which sometimes leads to internal server error when num_threads is more than 1. Set to one if conversion of every single document is a must.

port = "8080"      # port number where the local grobid instance is running
num_threads = 2


class grobid_multi(Thread):
    def __init__(self, queue):
        Thread.__init__(self)
        self.queue = queue

    def run(self):
        while True:
            # Get the work from the queue
            inFilename, outFilename = self.queue.get()
            getXMLFromPDF(inFilename, outFilename)
            self.queue.task_done()


class XMLToTEIMulti(Thread):
    def __init__(self, queue):
        Thread.__init__(self)
        self.queue = queue

    def run(self):
        while True:
            # Get the work from the queue
            outFilename = self.queue.get()
            convertXMLToTEI(outFilename)
            self.queue.task_done()


class PDFToText(Thread):
    def __init__(self, queue):
        Thread.__init__(self)
        self.queue = queue

    def run(self):
        while True:
            # Get the work from the queue
            inFileName, outFileName = self.queue.get()
            getRawText(inFileName, outFileName)
            self.queue.task_done()


def getAllFiles(path):
    mypath = path
    files = [f for f in listdir(mypath) if isfile(
        join(mypath, f)) and f != ".DS_Store" and f != "README.md"]
    return files


def getXMLFromPDF(inFilename, outFilename):
    try:
        subprocess.call(["curl",
                         "-v",
                         "-include",
                         "--form",
                         "input=@" + inFilename,
                         "localhost:" + port + "/processFulltextDocument",
                         "-o",
                         outFilename])
    except Exception as e:
        print e
        print "PDF to xml failed, continuing"


def convertXMLToTEI(outFilename):
    try:
        lines = open(outFilename).readlines()
        # Remove HTTP status message from XMLs and append TEI.
        open(outFilename, 'w').writelines(lines[7:-1])
        open(outFilename, 'a').writelines("</TEI>")
    except Exception as e:
        print e
        print "XML to TEI failed, continuing"


def getRawText(inFilename, outFilename):
    try:
        subprocess.call(["pdftotext", inFilename, outFilename])
    except Exception as e:
        print e
        print "PDF to Text failed"


def start_grobid(files, pdfpath, xmlpath):
    queue = Queue.Queue()
    for x in range(num_threads):
        worker = grobid_multi(queue)
        worker.daemon = True
        worker.start()

    for file in files:
        inFilename = pdfpath + file
        file = file.replace(".pdf", '')
        outFilename = xmlpath + file + ".xml"
        queue.put((inFilename, outFilename))

    queue.join()


def convert_xml(files, xmlpath):
    queue = Queue.Queue()
    for x in range(num_threads):
        worker = XMLToTEIMulti(queue)
        worker.daemon = True
        worker.start()

    for file in files:
        file = file.replace(".pdf", '')
        outFilename = xmlpath + file + ".xml"
        queue.put(outFilename)

    queue.join()


def convert_text(files, pdfpath, textPath):
    queue = Queue.Queue()
    for x in range(num_threads):
        worker = PDFToText(queue)
        worker.daemon = True
        worker.start()

    for file in files:
        inFilename = pdfpath + file
        file = file.replace(".pdf", '')
        outFilename = textPath + file + ".txt"
        queue.put((inFilename, outFilename))

    queue.join()


def main():
    start_time = time.time()
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '-pdfpath',
        help='Location of journal pdf to extract metadata/fields from.',
        type=str,
        required=True)
    parser.add_argument(
        '-outpathXML',
        help='Location/Folder to write the XML extraction of pdf to. (TEI format)',
        type=str,
        required=True)
    parser.add_argument(
        '-outpathText',
        help='Location/Folder to write the Text extraction of pdf to.',
        type=str,
        required=True)
    args = parser.parse_args()
    args.pdfpath = args.pdfpath + '/' if args.pdfpath[-1] is not '/' else args.pdfpath
    args.outpathXML = args.pdfpath + '/' if args.outpathXML[-1] is not '/' else args.outpathXML
    args.outpathText = args.outpathText + '/' if args.outpathText[-1] is not '/' else args.outpathText
    if not os.path.isdir(args.outpathText):
        os.makedirs(args.outpathText)
    if not os.path.isdir(args.outpathXML):
        os.makedirs(args.outpathXML)

    # Get all files in path:
    files = getAllFiles(args.pdfpath)

    start_grobid(files, args.pdfpath, args.outpathXML)
    #
    convert_xml(files, args.outpathXML)

    # Make command line calls to extract raw text (NOT annotated):
    # convert_text(files, args.pdfpath, args.outpathText)

    print("--- %s seconds ---" % (time.time() - start_time))

if __name__ == '__main__':
    main()
