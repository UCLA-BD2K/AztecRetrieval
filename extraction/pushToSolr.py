import argparse
import json
import subprocess

port = 8983


def add_github_data(output, obj):
    try:
        obj = obj['github data']
    except Exception as e:
        print e.message
    try:
        output['language'] = obj['languages']
    except Exception as e:
        print e
    try:
        output['dateUpdated'] = obj['updated_at']
    except Exception as e:
        print e
    try:
        output['owners'] = obj['owner']
    except Exception as e:
        print e
    try:
        output['licenses'] = str(obj['license'])
    except Exception as e:
        print e
    try:
        output['dateCreated'] = obj['created_at']
    except Exception as e:
        print e
    try:
        output['maintainers'] = str(obj['contributors'])
    except Exception as e:
        print e
    try:
        output['versions'] = str(obj['versions'])
    except Exception as e:
        print e


def add_sourceforge_data(output, obj):
    try:
        obj = obj['sourceforge data']
    except Exception as e:
        print e
    try:
        output['language'] = obj['languages']
    except Exception as e:
        print e
    try:
        output['licenses'] = str(obj['license'])
    except Exception as e:
        print e
    try:
        output['maintainers'] = str(obj['developers'])
    except Exception as e:
        print e
    try:
        output['versions'] = str(obj['Development Status'])
    except Exception as e:
        print e


def push_to_solr(output):
    subprocess.call(["curl",
                     "-X",
                     "-POST",
                     "-H",
                     "Content-Type: application/json",
                     "http://localhost:"+str(port)+"/solr/BD2K/update/json/docs?commit=true",
                     "--data-binary",
                     output])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '-data',
        help='json data of extracted documents',
        type=str,
        required=True)
    args = parser.parse_args()
    with open(args.data, 'rU') as f:
        parsed_json = json.load(f)
        for obj in parsed_json:
            obj = parsed_json[obj]
            output = dict()
            output['name'] = obj['toolName']
            output['publicationDOI'] = obj['doi']
            output['sourceCodeURL'] = obj['sourceLinks']
            output['linkUrls'] = obj['links']
            output['authors'] = obj['authors']
            output['funding'] = obj['grants']
            if 'github data' in obj:
                add_github_data(output, obj)
            elif 'sourceforge data' in obj:
                add_sourceforge_data(output, obj)
            else:
                output['name'] = obj['pubTitle']

            if 'language' not in output:
                output['language'] = obj['technologies used']

            output['tags'] = obj['keywords']
            output['description'] = obj['abstract']
            output['summary'] = obj['summary']
            output['acknowledgements'] = obj['ack']
            output['institutions'] = obj['affiliations']
            if 'dateCreated' in obj:
                output['dateCreated'] = obj['dateCreated']
            output = json.dumps(output)
            push_to_solr(output)

if __name__ == '__main__':
    main()