import sys
import argparse
import os
from classifier import main as classify
from pdf_extract import main as grobid_extraction
from parse_extracts import main as parse_extracts
from pushToSolr import main as pushToSolr
import time


def main():
    start_time = time.time()
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '-directory',
        help='Folder containing publications in PDF format',
        type=str,
        required=True)
    parser.add_argument(
        '-pushToSolr',
        help='1 if metadata should be pushed to localhost solr running on port 8983, else 0. Defaults to 0',
        type=int,
        required=False)
    parser.add_argument(
        '-doiRecords',
        help='JSON file containing name:doi key value pairs for downloaded documents',
        type=str,
        required=False)
    parser.add_argument(
        '-classify',
        help='1 if publications should be classified first to filter out tools, else 0. Defaults to 1',
        type=str,
        required=False)
    args = parser.parse_args()
    directory = args.directory + '/' if args.directory[-1] is not '/' else args.directory
    if not os.path.isdir(directory):
        print args.directory + " is not a directory, creating it and continuing..."
        os.makedirs(directory)

    tools_dir = 'tools/'
    non_tools_dir = 'non_tools/'
    tools_xml_dir = 'tools_xml/'
    tools_txt_dir = 'tools_txt/'
    output_file = 'output.json'

    # Classify
    if args.classify is not 0:
        classify(directory, tools_dir, non_tools_dir)
    else:
        tools_dir = directory

    # Grobid extraction
    grobid_extraction(tools_dir, tools_xml_dir, tools_txt_dir)

    # Parse grobid data into output file
    parse_extracts(tools_xml_dir, tools_txt_dir, args.doiRecords, output_file)

    # Push to Solr if needed
    if args.pushToSolr is not None and args.pushToSolr == 1:
        pushToSolr(output_file)

    print(" Total time taken:    --- %s seconds ---" % (time.time() - start_time))

if __name__ == '__main__':
    sys.exit(main())
