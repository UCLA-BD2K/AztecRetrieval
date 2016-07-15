#!/bin/bash

if [ $# -ne 2 ]; then
    echo "usage: ./update_solr [host] [filepath]"
    exit 1
fi

host=$1
file=$2


curl 'http://'$host':8983/solr/BD2K/update?stream.body=%3Cdelete%3E%3Cquery%3E*:*%3C/query%3E%3C/delete%3E&commit=true'
curl 'http://'$host':8983/solr/BD2K/update/json?commit=true' --data-binary @$file -H 'Content-type:application/json'
