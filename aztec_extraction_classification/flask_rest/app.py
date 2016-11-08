from flask import Flask, request
import base64
import shutil
import os
import json
from scripts.main_top_level import main
app = Flask(__name__)


def start_extraction(doi, dir_name):
    main(dir_name, 0, None, 0, doi)
    with open(dir_name+'output.json', 'r') as output:
        result = output.read()
    shutil.rmtree(dir_name)
    return str(result)


@app.route('/')
def index():
    return "Hello, World!\n"


@app.route('/extraction', methods=['POST'])
def extract():
    request.get_data()
    data = request.form
    pdf = base64.b64decode(data['file'])
    doi = data['doi']
    dir_name = doi.replace('/', '-')
    dir_name += '/'
    try:
        os.makedirs(dir_name)
    except Exception as e:
        print e
        return 'Someone is already modifying this document'
    with open(dir_name + 'file.pdf', 'wb') as input_file:
        input_file.write(pdf)
    return start_extraction(doi, dir_name)

if __name__ == '__main__':
    app.run(debug=True, port=7777)

