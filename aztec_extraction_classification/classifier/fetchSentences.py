from nltk.tokenize import sent_tokenize
from mainScript import fetch_data, extract_text
import json

input_files, y = fetch_data()
x = extract_text(input_files)
# num = 1
# for text, category in zip(x, y):
#     split = text.split('==== Refs')
#     to_store = split[0]
#     if category == 1:
#         name = 'no_ref_tools/' + str(num)
#     else:
#         name = 'no_ref_non_tools/' + str(num)
#     with open(name+'.txt', 'w') as output:
#         output.write(to_store)
#     num += 1

with open("sentences.json", "w") as result:
    for obj, category in zip(x, y):
        output = dict()
        url_text = ""
        raw_text = obj.decode('utf-8')
        sentences = sent_tokenize(raw_text)
        url_sentences = []
        for i in range(0, len(sentences)):
            if 'http' in sentences[i]:
                try:
                    before = sentences[i-1]
                except:
                    url_sentences.append(sentences[i])
                    url_sentences.append(sentences[i+1])
                    continue
                try:
                    after = sentences[i+1]
                except:
                    url_sentences.append(before)
                    url_sentences.append(sentences[i])
                    continue
                if before not in url_sentences:
                    url_sentences.append(before)
                if sentences[i] not in url_sentences:
                    url_sentences.append(sentences[i])
                if after not in url_sentences:
                    url_sentences.append(after)
        for sentence in url_sentences:
            url_text += " " + sentence
        output['text'] = url_text
        output['class'] = category
        json.dump(output, result, indent=4)
