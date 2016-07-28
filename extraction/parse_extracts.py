import argparse
import codecs
import json
import re
import xmltodict
from nltk.tokenize import sent_tokenize
from os.path import isfile, join
from os import listdir
import requests
from summa import summarizer
from summa import keywords
import urllib

# README.md:
# This final script then interacts with the XML and text extracts of the Journal pdf to extract:
# authors, author affiliations, title,
# links, some predictions of possible source links, abstract, conclusions/results,
# the keywords from the journal, keywords from the
# DOI (CrossRef record), acknowledgements and possible grant information.

# Not working great --> Technologies, ToolName same as pub title unless github link found

# Dummy Github account to get more API calls
user = "TestAccount2K"
password = "testpassword1"


def is_candidate(text, words):
    if text:
        for index in range(len(words)):
            if words[index].lower() in text.lower():
                return True
    return False


def get_attribute(record, attribute):
    if record is None:
        return None
    if attribute in record:
        return record[attribute]
    return None


def get_authors(record):
    authorNames = []
    biblStruct = record["TEI"]["teiHeader"][
        "fileDesc"]["sourceDesc"]["biblStruct"]
    if "analytic" in biblStruct:
        if isinstance(biblStruct["analytic"], dict):
            if "author" in biblStruct["analytic"]:
                authorsRecord = biblStruct["analytic"]["author"]
                if isinstance(authorsRecord, list):
                    for index in range(len(authorsRecord)):
                        persName = get_attribute(
                            authorsRecord[index], "persName")
                        fullname = " "
                        forename = get_attribute(persName, "forename")
                        if isinstance(forename, list):
                            for pos in range(len(forename)):
                                fullname = fullname + \
                                           get_attribute(forename[pos], "#text") + " "
                        elif forename is not None:
                            fullname = fullname + \
                                       get_attribute(forename, "#text") + " "
                        surname = get_attribute(
                            persName, "surname") if get_attribute(
                            persName, "surname") is not None else ""
                        fullname = fullname + surname
                        authorNames.append(fullname)
    return authorNames


def get_affiliations(record):
    affiliations = []
    biblStruct = record["TEI"]["teiHeader"][
        "fileDesc"]["sourceDesc"]["biblStruct"]
    if "analytic" in biblStruct:
        if isinstance(biblStruct["analytic"], dict):
            if "author" in biblStruct["analytic"]:
                authorsRecord = biblStruct["analytic"]["author"]
                if isinstance(authorsRecord, list):
                    for index in range(len(authorsRecord)):
                        aff = get_attribute(authorsRecord[index], "affiliation")
                        org = get_attribute(aff, "orgName")
                        fullname = " "
                        if isinstance(org, list):
                            for pos in range(len(org)):
                                fullname = fullname + \
                                           get_attribute(org[pos], "#text") + " "
                        elif org is not None:
                            fullname = fullname + get_attribute(org, "#text")
                        affiliations.append(fullname)

    filtered = filter(lambda x: not re.match(r'^\s*$', x),
                      affiliations)  # Remove whitespaces
    return list(set(filtered))


def get_title(record):
    return get_attribute(record["TEI"]["teiHeader"]["fileDesc"][
                        "titleStmt"]["title"], "#text")


def get_technologies(text):
    # Common databases and API services
    techWords = [
        " SOAP ",
        " REST ",
        " mongoDB ",
        " Cassandra ",
        " Redis ",
        " SQL ",
        " Solr ",
        " Sybase ",
        " Oracle ",
        " couchDB "]
    filters = [
        " used ",
        " program ",
        " programmed ",
        " written ",
        " coded ",
        "package"]
    valid = [" ", ".", ",", ":", ";"]
    found = []
    with open('languages.txt', 'rU') as f:
        for line in f:
            line = line.rstrip()
            matches = get_word_sentence(line, text)
            flag = False
            for match in matches:
                for word in filters:
                    if word in match:
                        # print match
                        # print "Word found is " + word
                        index = match.find(line)
                        # print "Length of technology is " + str(len(line))
                        # print "Index of technology is " + str(index)
                        # print "Technology is " + line
                        if index == 0:
                            if match[index + len(line)] not in valid:
                                continue
                        elif index == len(match) - 1:
                            if match[index - 1] not in valid:
                                continue
                        elif match[index + len(line)] not in valid or match[index - 1] not in valid:
                            continue
                        found.append(line)
                        flag = True
                        break
                if flag:
                    break

    for word in techWords:
        if word in text:
            found.append(word)
    return list(set(found))


def get_abstract(record):
    abstract = get_attribute(record["TEI"]["teiHeader"][
                            "profileDesc"], "abstract")
    return abstract["p"] if abstract is not None else ""


def get_word_sentence(word, paragraph):
    sentences = sent_tokenize(paragraph)
    sentence_hits = [sent for sent in sentences if word in sent]
    return sentence_hits


# Get all sentences with grant information.
def get_all_grants(textRecord):
    words = [
        "funds",
        "grant",
        "sponsor",
        "NIH",
        "NSF",
        "funding",
        "Funding",
        "Sponsor",
        "Grant"]
    sentences = []
    for word in words:
        sentences += get_word_sentence(word, textRecord)
    return list(set(sentences))


def get_acks(record):
    divs = record["TEI"]["text"]["back"]["div"]
    text = " "
    if isinstance(divs, list):
        for index in range(len(divs)):
            div = divs[index]
            if div["@type"] == "acknowledgement":
                if "div" in div:
                    div = div["div"]
                    if isinstance(div, list):
                        for indexB in range(len(div)):
                            if div[indexB]:
                                if "p" in div[indexB]:
                                    p = div[indexB]["p"]
                                    if isinstance(p, dict):
                                        p = p["#text"]
                                    if isinstance(p, list):
                                        continue
                                    text = text + p + " "
                    else:
                        if div is not None and "p" in div:
                            p = div["p"]
                            if isinstance(p, dict):
                                p = p["#text"]
                            if isinstance(p, list):
                                continue
                            text = text + p + " "
                elif "p" in div:
                    text = text + div["p"] + " "
    return text


def get_unique_words(words, threshold):
    ignore_words = []
    length = len(words)
    for i in range(0, length):
        for j in range(i + 1, length):
            word = words[i]
            second_word = words[j]
            len_min = len(word) if len(word) < len(
                second_word) else len(second_word)
            similarity = 0
            for k in range(0, len_min):
                if word[k] != second_word[k]:
                    break
                similarity += 1
            if similarity > threshold:
                ignore = word if len(word) < len(second_word) else second_word
                ignore_words.append(ignore)
    return list(set(words) - set(ignore_words))


def get_keywords(text):
    numWords = 8
    try:
        keyWords = keywords.keywords(text, words=numWords).split('\n')
        threshold = 3
        # Discard words less than or equal to threshold characters
        words = [s.lower() for s in keyWords if len(s) > threshold]
        finalWords = []
        for word in words:      # Include words with spaces, example sequence alignment
            if " " in word:
                finalWords.append(word)
        words = list(set(words) - set(finalWords))
        finalWords.append(get_unique_words(words, threshold))
        return finalWords
    except Exception as e:
        print e
        return []


def summarize(sentences):
    try:
        return summarizer.summarize(sentences, words=100)
    except Exception as e:
        print e
        return ""


def chop_behind(string):
    while True:
        if string[-1:].isalpha() or string[-1:].isdigit():
            break
        else:
            string = string[:-1]
    return string


def get_all_links(textRecord):
    # Remove new lines.
    textRecord = textRecord.replace('\n', '')
    # Remove multi-character spaces.
    textRecord = ' '.join(textRecord.split())
    # Extract all URLs.
    regex = 'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+'
    urls = re.findall(regex, textRecord)
    urls = [str(chop_behind(url)) for url in urls]
    return list(set(urls))


def find_source_links(linksRecord, textRecord):
    words = [
        "source",
        "code",
        "download",
        "git",
        "github",
        "sourceforge",
        "programming language",
        "software"]
    # Remove new lines.
    textRecord = textRecord.replace('\n', '')
    # Remove multi-character spaces.
    textRecord = ' '.join(textRecord.split())
    # Get sentences with link
    sourceLinks = []
    for linkRecord in linksRecord:
        sentences = get_word_sentence(linkRecord, textRecord)
        for sentence in sentences:
            for word in words:
                if str(word.encode('utf-8')) in str(sentence.encode('utf-8')):
                    sourceLinks.append(linkRecord)
    return list(set(sourceLinks))


def write_records(records, filename):
    outfile = open(filename, 'w')
    outfile.write(json.dumps(records, indent=2))
    outfile.close()


def get_all_files(path):
    mypath = path
    files = [f for f in listdir(mypath) if isfile(
        join(mypath, f)) and f != ".DS_Store" and f != "README.md"]
    return files


# Return all info such as users, languages, contributors, last updated etc
# as a dict object
def extract_git_json(git_json):
    # Basic info
    result = dict()
    item = git_json['items'][0]
    result['name'] = item['name']
    result['owner'] = item['owner']['html_url']
    result['updated_at'] = item['updated_at']
    result['created_at'] = item['created_at']
    result['homepage'] = item['homepage'] if item[
        'homepage'] != "null" else None

    # Contributors
    try:
        contributors_url = item['contributors_url']
        r = requests.get(contributors_url, auth=(user, password))
        contributors_json = json.loads(r.text)
        list = []
        for obj in contributors_json:
            list.append({"html_url": obj['html_url'],
                         "contributions": obj['contributions']})
        result['contributors'] = list
    except Exception as e:
        print e
    # print contributors_json

    # Languages

    try:
        languages_url = item['languages_url']
        r = requests.get(languages_url, auth=(user, password))
        languages_json = json.loads(r.text)
        langs = []
        for k, v in languages_json.items():
            langs.append(k)
        result['languages'] = langs
    except Exception as e:
        print e
    # print languages_json

    # Versions i.e tags

    try:
        tags_url = item['tags_url']
        r = requests.get(tags_url, auth=(user, password))
        version_json = json.loads(r.text)
        versions = []
        for obj in version_json:
            versions.append({"name": obj['name'],
                             "zipball_url": obj['zipball_url'],
                             "tarball_url": obj['tarball_url']})
        result['versions'] = versions
    except Exception as e:
        print e

    # print version_json

    # Subscribers

    try:
        subscribers_url = item['subscribers_url']
        r = requests.get(subscribers_url, auth=(user, password))
        subscribers_json = json.loads(r.text)
        subs = []
        for obj in subscribers_json:
            subs.append({"html_url": obj['html_url']})
        result['subscribers'] = subs
    except Exception as e:
        print e

    # print subscribers_json

    # License

    try:
        license_url = str(item['url']) + "/license"
        r = requests.get(license_url, auth=(user, password))
        license_json = json.loads(r.text)
        licenses = []
        licenses.append({"name": license_json['license']['name']})
        licenses.append({"link": license_json['download_url']})
        result['license'] = licenses
    except Exception as e:
        print e

    return result


# Return info about the repository object as a json object
def get_git_info(repo):
    url = "https://api.github.com/search/repositories?q="
    r = requests.get(str(url) + str(repo), auth=(user, password))
    parsed_json = json.loads(r.text)
    if parsed_json['total_count'] == 0:
        return None
    return extract_git_json(parsed_json)


# Finds github or sourceforge links in the source links
def find_code_source(sourcelinks, text):
    possibleGitRepos = []
    possibleSFRepos = []
    for link in sourcelinks:
        if "github" in link:
            list = str(link).split('/')
            # Repo name, since github urls have users too
            try:
                possibleGitRepos.append(list[-1])
            except:
                print "Invalid github url"
        elif "sourceforge" in link:
            list = str(link).split('/')
            try:
                index = list.index("projects")  # Repo name
                possibleSFRepos.append(list[index + 1])
            except:
                print "Invalid sourceforge url"
    max_count = 0
    result = dict()
    for repo in possibleGitRepos:           # Actual repo name will occur most frequently in text
        count = text.count(repo)
        if count > max_count:
            max_count = count
            result['name'] = repo
            result['github'] = True
    if not result:                       # Go with github if possible else try sourceforge
        for repo in possibleSFRepos:
            count = text.count(repo)
            if count > max_count:
                max_count = count
                result['name'] = repo
                result['github'] = False
    return None if not result else result


def get_sourceforge_info(repo):
    url = "https://sourceforge.net/rest/p/" + str(repo)
    r = requests.get(url)
    json_info = json.loads(r.text)
    result = dict()
    result['url'] = json_info['url']

    # Developers
    try:
        developer_json = json_info['developers']
        dev_list = []
        for item in developer_json:
            dev_list.append({"url": item['url'], "name": item['name']})
        result['developers'] = dev_list
    except Exception as e:
        print e

    # Languages
    try:
        lang_json = json_info['categories']['language']
        lang_list = []
        for item in lang_json:
            lang_list.append(item['fullname'])
        result['languages'] = lang_list
    except Exception as e:
        print e

    # Licenses
    try:
        license_json = json_info['categories']['license']
        license_list = []
        for item in license_json:
            license_list.append({"name": item['fullname']})
        result['license'] = license_list
    except Exception as e:
        print e

    # Status
    try:
        status_json = json_info['categories']['developmentstatus']
        status_list = []
        for item in status_json:
            status_list.append({"status": item['fullname']})
        result['Development Status'] = status_list
    except Exception as e:
        print e

    return result


def get_date(doi):
    url = "http://api.crossref.org/works/"+str(doi)
    response = str(urllib.urlopen(url).read())
    parsed_json = json.loads(response)
    try:
        return parsed_json['message']['created']['date-time']
    except Exception as e:
        print e
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '-XMLFiles',
        help='Folder containing the tool XML files to be parsed to extract the metadata.',
        type=str,
        required=True)
    parser.add_argument(
        '-textFiles',
        help='Folder containing the tool text files to be parsed to extract all links.',
        type=str,
        required=True)
    parser.add_argument(
        '-correctDOIRecords',
        help='text file containing DOI records in json as key:name and value:doi pairs',
        type=str,
        required=True)
    parser.add_argument(
        '-outfile',
        help='File to write ALL extracted metadata to after extraction form the tool XMLs.',
        type=str,
        required=True)
    args = parser.parse_args()

    files = get_all_files(args.XMLFiles)
    try:
        with open(args.correctDOIRecords, 'rU') as file:
            dois = json.loads(file.read())
    except Exception as e:
        print e
        dois = None

    publication_extractions = {}

    for file in files:
        # Read xml file.
        filepath = args.XMLFiles + file
        try:
            with codecs.open(filepath, "r", encoding='utf-8', errors='ignore') as f:
                read = f.read()
        except Exception as e:
            print "Could not open file " + filepath
            print e
            continue

        # Convert: Xml to dictionary.
        try:
            dictionary = xmltodict.parse(read)
        except Exception as e:
            print "Reading failed on " + str(file)
            print e
            continue

        # Read text of file.
        filepath = args.textFiles + file[:-4] + ".txt"
        try:
            with codecs.open(filepath, "r", encoding='utf-8', errors='ignore') as f:
                text = f.read()
                text = text.encode('utf-8')
        except Exception as e:
            print "Could not open file " + filepath
            print e
            continue

        # All extractions:
        title = get_title(dictionary)
        authors = get_authors(dictionary)
        affiliations = get_affiliations(dictionary)
        abstract = get_abstract(dictionary)
        links = get_all_links(text)
        sourceLinks = find_source_links(links, text)
        ack = get_acks(dictionary)
        grants = get_all_grants(text)
        summary = summarize(text)
        keyWords = get_keywords(text)
        technologies = get_technologies(text)

        publication_extractions[file[:-4]] = {}

        name = file.replace(".xml", '')
        try:
            if dois is not None:
                doi = dois[name] if name in dois else "Not found"
                publication_extractions[
                    file[:-4]]["doi"] = doi
                if doi is not "Not found":
                    date = get_date(doi)
                    if date is not None:
                        publication_extractions[file[:-4]]["dateCreated"] = date
        except Exception as e:
            print e

        # Push to dict.
        publication_extractions[file[:-4]]["toolName"] = title
        publication_extractions[file[:-4]]["abstract"] = abstract
        publication_extractions[file[:-4]]["pubTitle"] = title
        publication_extractions[file[:-4]]["authors"] = authors
        publication_extractions[file[:-4]]["affiliations"] = affiliations
        publication_extractions[file[:-4]]["keywords"] = keyWords
        publication_extractions[file[:-4]]["links"] = links
        publication_extractions[file[:-4]]["sourceLinks"] = sourceLinks
        publication_extractions[file[:-4]]["ack"] = ack
        publication_extractions[file[:-4]]["grants"] = grants
        publication_extractions[file[:-4]]["summary"] = summary
        publication_extractions[file[:-4]]["technologies used"] = technologies

        # Find github/sourceforge link in the source links
        repo = find_code_source(sourceLinks, text)
        if repo is not None:
            name = repo['name']
            publication_extractions[file[:-4]]["toolName"] = name
            if repo['github']:
                publication_extractions[
                    file[:-4]]["github data"] = get_git_info(name)
            else:
                publication_extractions[
                    file[:-4]]["sourceforge data"] = get_sourceforge_info(name)

    # Write extractions to file:
    write_records(publication_extractions, args.outfile)

if __name__ == '__main__':
    main()
