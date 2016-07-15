// Model Dependencies
var M_tool = require('../models/mongo/tool.js');
var M_funding = require('../models/mongo/funding.js');
var M_link = require('../models/mongo/link.js');
var M_publication = require('../models/mongo/publication.js');
var M_version = require('../models/mongo/version.js');
var M_author = require('../models/mongo/author.js');
var M_maintainer = require('../models/mongo/maintainer.js');

/**
 * ToolUtils
 * @constructor
 * [Utility functions for converting metadata to different formats]
 */
function ToolUtils() {
    // private member variables
    var self = this;

    // private member functions
    this.mysql2rest = function(json) {
        return self._mysql2rest(self, json);
    };
    this.mysql2form = function(json) {
        return self._mysql2form(self, json);
    };
    this.rest2mysql = function(toolJSON) {
        return self._rest2mysql(self, toolJSON);
    };
    this.mysql2solr = function(toolJSON) {
        return self._mysql2solr(self, toolJSON);
    };
    this.unflatten = function(json) {
        return self._unflatten(self, json);
    };
    this.removeHash = function(json) {
        return self._removeHash(self, json);
    };
}

/**
 * ToolUtils._mysql2rest
 * [Converts the MySQL format JSON to a readable REST API format JSON]
 * @param  {Object} self [Reference to tool util object]
 * @param  {JSON} json [MySQL-formatted object (directly from Bookshelf)]
 * @return {JSON}      [REST API JSON]
 */
ToolUtils.prototype._mysql2rest = function(self, json) {

    // store in resource variable for return
    var resource = {};

    // store basic information
    resource['id'] = json['AZID'];
    resource['name'] = json['NAME'];
    if (json['LOGO_LINK'] != undefined || json['LOGO_LINK'] == null)
        resource['logo_url'] = json['LOGO_LINK'];
    resource['description'] = json['DESCRIPTION'];
    resource['submit_date'] = json['SUBMIT_DATE'];
    resource['last_updated'] = json['LAST_UPDATED'];

    // resource types
    if (json['resource_types'] != undefined) {
        if (json['resource_types'].length > 0) {
            resource['functions'] = [];
            json['resource_types'].forEach(function(type) {
                var res = type['RESOURCE_TYPE'];
                if (type['OTHER'] != undefined) {
                    res = type['OTHER'];
                }
                resource['functions'].push(res);
            });
        }
    }

    // scientific domain
    if (json['domains'] != undefined) {
        if (json['domains'].length > 0) {
            resource['domains'] = [];
            json['domains'].forEach(function(domain) {
                resource['domains'].push(domain['DOMAIN']);
            });
        }
    }

    // tags
    if (json['tags'] != undefined) {
        if (json['tags'].length > 0) {
            resource['tags'] = [];
            json['tags'].forEach(function(tag) {
                resource['tags'].push(tag['NAME']);
            });
        }
    }

    // authors
    if (json['authors'] != undefined) {
        if (json['authors'].length > 0) {
            resource['authors'] = [];
            json['authors'].forEach(function(author) {
                resource['authors'].push({
                    first_name: author['first_name'],
                    last_name: author['last_name'],
                    email: author['email']
                });
            });
        }
    }

    // maintainers
    if (json['maintainers'] != undefined) {
        if (json['maintainers'].length > 0) {
            resource['maintainers'] = [];
            json['maintainers'].forEach(function(maintainer) {
                resource['maintainers'].push({
                    first_name: maintainer['first_name'],
                    last_name: maintainer['last_name'],
                    email: maintainer['email']
                });
            });
        }
    }

    // institutions
    if (json['institutions'] != undefined) {
        if (json['institutions'].length > 0) {
            resource['affiliation'] = [];
            json['institutions'].forEach(function(inst) {
                if (inst['NAME'] != undefined)
                    resource['affiliation'].push(inst['NAME']);
                else {
                    resource['affiliation'].push(inst['new_institution']);
                }
            });
        }
    }

    // tool DOI
    if (json['TOOL_DOI'] != undefined)
        resource['resource_doi'] = json['TOOL_DOI'];

    // publications
    if (json['publications'] != undefined) {
        if (json['publications'].length > 1) {
            resource['other_pub_dois'] = [];
            json['publications'].forEach(function(pub) {
                if (pub['primary'] == true) {
                    resource['primary_pub_doi'] = pub['pub_doi'];
                } else {
                    resource['other_pub_dois'].push(pub['pub_doi']);
                }
            });
        }
    }

    // links (URLs)
    if (json['links'] != undefined) {
        if (json['links'].length > 0) {
            resource['links'] = [];
            json['links'].forEach(function(link) {
                resource['links'].push({
                    name: link['name'],
                    url: link['url']
                });
            });
        }
    }

    // source link
    if (json['SOURCE_LINK'])
        resource['source_code_url'] = json['SOURCE_LINK'];

    // programming languages
    if (json['languages'] != undefined) {
        if (json['languages'].length > 0) {
            resource['languages'] = [];
            json['languages'].forEach(function(lang) {
                resource['languages'].push(lang['NAME']);
            });
        }
    }

    // supported platforms
    if (json['platforms'] != undefined) {
        if (json['platforms'].length > 0) {
            resource['platforms'] = [];
            json['platforms'].forEach(function(plat) {
                resource['platforms'].push(plat['NAME']);
            });
        }
    }

    // associated users
    if (json['users'] != undefined) {
        if (json['users'].length > 0) {
            resource['owners'] = [];
            json['users'].forEach(function(plat) {
                resource['owners'].push(plat['USER']);
            });
        }
    }

    // versions
    if (json['version'] != undefined) {
        if (json['version'].length > 0) {
            resource['versions'] = [];
            json['version'].forEach(function(ver) {
                resource['versions'].push({
                    version: ver['version'],
                    version_date: ver['version_date'],
                    version_description: ver['version_description']
                })
            });
        }
    }

    // license
    if (json['license'] != undefined && json['license'].length > 0) {
        resource['license'] = {};
        resource['license']['type'] = json['license'][0]['LICENSE_TYPE'];
        if (json['license'][0]['NAME'])
            resource['license']['name'] = json['license'][0]['NAME'];
        if (json['license'][0]['LINK'])
            resource['license']['link'] = json['license'][0]['LINK'];
        if (json['license'][0]['DESCRIPTION'])
            resource['license']['description'] = json['license'][0]['DESCRIPTION'];
    }

    // funding source
    if (json['funding'] && json['funding'].length > 0) {
        resource['funding'] = []
        json['funding'].forEach(function(source) {
            var funding = {};
            if (source['agency'])
                funding['agency'] = source['agency'];
            else if (source['new_agency'])
                funding['agency'] = source['new_agency'];
            if (source['grant'])
                funding['grant'] = source['grant'];
            resource['funding'].push(funding);
        });
    }

    // BD2K Center/Activity
    if (json['centers'] && json['centers'].length > 0) {
        resource['bd2k_affiliation'] = [];
        json['centers'].forEach(function(center) {
            if (center['BD2K_CENTER'] && center['BD2K_CENTER'] != 'Other')
                resource['bd2k_affiliation'].push(center['BD2K_CENTER']);
            else if (center['PROJECT_NAME'])
                resource['bd2k_affiliation'].push(center['PROJECT_NAME']);
        });
    }

    return resource;
}

/**
 * ToolUtils._mysql2form
 * [Converts the MySQL format JSON to the submission form format JSON]
 * @param  {Object} self [Reference to tool util object]
 * @param  {JSON} json [MySQL-formatted object (directly from Bookshelf)]
 * @return {JSON}      [Submission form JSON]
 */
ToolUtils.prototype._mysql2form = function(self, json) {

    // json for storage and return
    var basic_section = {};
    var author_section = {};
    var pub_section = {};
    var link_section = {};
    var dev_section = {};
    var version_section = {};
    var license_section = {};
    var funding_section = {};

    // basic information
    basic_section['id'] = json['AZID'];
    basic_section['name'] = json['NAME'];
    basic_section['logo_url'] = json['LOGO_LINK'];
    basic_section['description'] = json['DESCRIPTION'];
    basic_section['submit_date'] = json['SUBMIT_DATE'];

    // resource types
    basic_section['resource_types'] = [];
    if (json['resource_types'] != undefined) {
        json['resource_types'].forEach(function(type) {
            var res = {};
            res.type = type['RESOURCE_TYPE'];
            if (type['OTHER'] != undefined) {
                res.other = type['OTHER'];
            }
            basic_section['resource_types'].push(res);
        });
    }

    // biological domains
    basic_section['domains'] = [];
    if (json['domains'] != undefined) {
        json['domains'].forEach(function(domain) {
            basic_section['domains'].push({
                domain: domain['DOMAIN']
            });
        });
    }

    // tags
    basic_section['tags'] = [];
    if (json['tags'] != undefined) {
        json['tags'].forEach(function(tag) {
            basic_section['tags'].push({
                text: tag['NAME']
            });
        });
    }

    // author information
    author_section['authors'] = [];
    if (json['authors'] != undefined) {
        json['authors'].forEach(function(author) {
            author_section['authors'].push({
                first_name: author['first_name'],
                last_name: author['last_name'],
                email: author['email']
            });
        });
    }

    // maintainers
    author_section['maintainers'] = [];
    if (json['maintainers'] != undefined) {
        json['maintainers'].forEach(function(maintainer) {
            author_section['maintainers'].push({
                first_name: maintainer['first_name'],
                last_name: maintainer['last_name'],
                email: maintainer['email']
            });
        });
    }

    // affiliations/institutions
    author_section['affiliation'] = [];
    if (json['institutions'] != undefined) {
        json['institutions'].forEach(function(inst) {
            if (inst['NAME'] != undefined)
                author_section['affiliation'].push({
                    inst_name: inst['NAME']
                });
            else {
                author_section['affiliation'].push({
                    missing: true,
                    new_institution: inst['new_institution']
                });
            }
        });
    }

    // tool DOI
    pub_section['resource_doi'] = json['TOOL_DOI'];
    pub_section['pub_dois'] = [];
    if (json['publications'] != undefined) {
        json['publications'].forEach(function(pub) {
            if (pub['primary'] == true) {
                pub_section['primary_pub_doi'] = pub['pub_doi'];
            } else {
                pub_section['pub_dois'].push(pub);
            }
        });
    }

    // links/URLs
    link_section['links'] = json['links'];

    // source code URL
    dev_section['code_url'] = json['SOURCE_LINK'];

    // programming languages
    dev_section['language'] = [];
    if (json['languages'] != undefined) {
        json['languages'].forEach(function(lang) {
            dev_section['language'].push({
                PRIMARY_NAME: lang['NAME']
            });
        });
    }

    // supported platforms
    dev_section['platform'] = [];
    if (json['platform'] != undefined) {
        json['platform'].forEach(function(plat) {
            dev_section['platform'].push({
                name: plat['NAME']
            });
        });
    }

    // versions
    version_section['prev_versions'] = [];
    if (json['version'] != undefined) {
        json['version'].forEach(function(ver) {
            if (ver['latest']) {
                version_section['latest_version'] = ver['version'];
                version_section['latest_version_date'] = ver['version_date'];
                version_section['latest_version_desc'] = ver['version_description'];
            } else {
                version_section['prev_versions'].push({
                    version: ver['version'],
                    version_description: ver['version_description'],
                    version_date: ver['version_date']
                });
            }
        });
    }

    // licenses
    if (json['license'] != undefined && json['license'].length > 0) {
        license_section['type'] = json['license'][0]['LICENSE_TYPE'];
        license_section['name'] = json['license'][0]['NAME'];
        license_section['link'] = json['license'][0]['LINK'];
        license_section['description'] = json['license'][0]['DESCRIPTION'];
    }

    // funding sources
    funding_section['funding'] = json['funding'];

    // BD2K Center/activities
    funding_section['bd2k'] = [];
    if (json['centers'] != undefined) {
        json['centers'].forEach(function(center) {
            var pushCenter = {};
            pushCenter['center'] = center['BD2K_CENTER'];
            if (center['PROJECT_NAME'] != null)
                pushCenter['title'] = center['PROJECT_NAME'];
            funding_section['bd2k'].push(pushCenter);
        });
    }

    // return result
    var result = {
        basic_section: basic_section,
        author_section: author_section,
        pub_section: pub_section,
        link_section: link_section,
        dev_section: dev_section,
        version_section: version_section,
        license_section: license_section,
        funding_section: funding_section
    };

    return result;
};

/**
 * ToolUtils._rest2mysql
 * [Converts the REST format JSON to the mysql format JSON]
 * @param  {Object} self [Reference to tool util object]
 * @param  {JSON} json [REST API-formatted object]
 * @return {JSON}      [mysql format JSON]
 */
ToolUtils.prototype._rest2mysql = function(self, json) {

    // stored for return
    var toolInfo = {};
    var res_types = [];
    var domains = [];
    var tags = [];
    var links = [];
    var langs = [];
    var platforms = [];
    var license = {};
    var agency = [];
    var funding = [];
    var institutions = [];
    var centers = [];

    // mongo return object
    var m_tool = new M_tool;

    // get basic tool info
    if (json['basic'] != undefined) {
        if (json['basic']['id'] != undefined)
            toolInfo.AZID = json['basic']['id'];
        if (json['basic']['name'] != undefined)
            toolInfo.NAME = json['basic']['name'];
        if (json['basic']['logo_url'] != undefined)
            toolInfo.LOGO_LINK = json['basic']['logo_url'];
        if (json['basic']['description'] != undefined)
            toolInfo.DESCRIPTION = json['basic']['description'];
    }
    if (json['publication'] != undefined) {
        if (json['publication']['primary_pub_doi'] != undefined) {
            toolInfo.PRIMARY_PUB_DOI = json['publication']['primary_pub_doi'];
            var m_pub = new M_publication;
            m_pub.pub_doi = json['publication']['pub_primary_doi'];
            m_pub.primary = true;
            m_tool.publications.push(m_pub);
        }
        if (json['publication']['resource_doi'] != undefined) {
            toolInfo.TOOL_DOI = json['publication']['resource_doi'];
        }
    }

    if (json['dev'] != undefined && json['dev']['code_url'] != undefined)
        toolInfo.SOURCE_LINK = json['dev']['code_url'];
    // author info
    if (json['authors'] != undefined && json['authors']['authors'] != undefined) {
        m_tool.authors = [];
        for (var i = 0; i < json['authors']['authors'].length; i++) {
            if (json['authors']['authors'][i]['first_name'] == undefined || json['authors']['authors'][i]['email'] == undefined)
                break;

            var m_author = new M_author;
            m_author['first_name'] = json['authors']['authors'][i]['first_name'];
            m_author['last_name'] = json['authors']['authors'][i]['last_name'];
            m_author['email'] = json['authors']['authors'][i]['email'];
            m_tool.authors.push(m_author);

        }
    }

    // maintainer infor
    if (json['authors'] != undefined && json['authors']['maintainers'] != undefined) {

        for (var i = 0; i < json['authors']['maintainers'].length; i++) {
            var m_maintainer = new M_maintainer;
            m_maintainer['first_name'] = json['authors']['maintainers'][i]['first_name'];
            m_maintainer['last_name'] = json['authors']['maintainers'][i]['last_name'];
            m_maintainer['email'] = json['authors']['maintainers'][i]['email'];
            m_tool.maintainers.push(m_maintainer);
        }
    }

    // affiliation/institution
    if (json['authors'] != undefined && json['authors']['affiliation'] != undefined) {
        for (var i = 0; i < json['authors']['affiliation'].length; i++) {
            if (json['authors']['affiliation'][i]['inst_name'] != undefined)
                institutions.push(json['authors']['affiliation'][i]['inst_name']);
            else {
                m_tool.missing_inst.push({
                    new_institution: json['authors']['affiliation'][i]['new_institution']
                });
            }
        }
    }

    // get resource type
    if (json['basic'] != undefined && json['basic']['resource_types'] != undefined) {
        for (var i = 0; i < json['basic']['resource_types'].length; i++) {
            var res_type = {};
            if (json['basic']['resource_types'][i]['type'] == 'Other') {
                res_type['RESOURCE_TYPE'] = 'Other';
                res_type['OTHER'] = json['basic']['resource_types'][i]['other'];
            } else {
                res_type['RESOURCE_TYPE'] = json['basic']['resource_types'][i]['type'];
            }

            res_types.push(res_type);
        }
    }

    // domain info
    if (json['basic'] != undefined && json['basic']['domains'] != undefined) {
        for (var i = 0; i < json['basic']['domains'].length; i++) {
            domains.push({
                DOMAIN: json['basic']['domains'][i]['domain']
            });
        }
    }
    // tags
    if (json['basic'] != undefined && json['basic']['tags'] != undefined) {
        for (var i = 0; i < json['basic']['tags'].length; i++) {
            tags.push({
                NAME: json['basic']['tags'][i]['text']
            });
        }
    }
    // links
    if (json['publication'] != undefined) {
        if (json['publication']['primary_pub_doi']) {
            var m_pub = new M_publication;
            m_pub.pub_doi = json['publication']['primary_pub_doi'];
            m_pub.primary = true;
            m_tool.publications.push(m_pub);
        }
        if (json['publication']['pub_dois'] != undefined) {
            for (var i = 0; i < json['publication']['pub_dois'].length; i++) {
                var m_pub = new M_publication;
                m_pub.pub_doi = json['publication']['pub_dois'][i]['pub_doi'];
                m_tool.publications.push(m_pub);
            }
        }
    }

    // links/URLs
    if (json['links'] != undefined && json['links']['links'] != undefined) {
        for (var i = 0; i < json['links']['links'].length; i++) {
            var m_link = new M_link;
            m_link.name = json['links']['links'][i]['name'];
            m_link.url = json['links']['links'][i]['url'];
            m_tool.links.push(m_link);
        }
    }
    // programming languages
    if (json['dev'] != undefined && json['dev']['language'] != undefined) {
        for (var i = 0; i < json['dev']['language'].length; i++) {
            langs.push({
                NAME: json['dev']['language'][i]['PRIMARY_NAME']
            });
        }
    }

    // supported platforms
    if (json['dev'] != undefined && json['dev']['platform'] != undefined) {
        for (var i = 0; i < json['dev']['platform'].length; i++) {
            platforms.push({
                NAME: json['dev']['platform'][i]['name']
            });
        }
    }
    // versions
    if (json['version'] != undefined) {

        var m_ver = new M_version;
        m_ver.version = json['version']['latest_version'];
        m_ver.version_description = json['version']['latest_version_desc'];
        m_ver.version_date = new Date(json['version']['latest_version_date']);
        m_ver.latest = true;
        m_tool.versions.push(m_ver);

        if (json['version']['prev_versions'] != undefined) {
            for (var i = 0; i < json['version']['prev_versions'].length; i++) {
                var prev_ver = new M_version;
                prev_ver.version = json['version']['prev_versions'][i]['version'];
                prev_ver.version_description = json['version']['prev_versions'][i]['version_description'];
                prev_ver.version_date = new Date(json['version']['prev_versions'][i]['version_date']);
                m_tool.versions.push(prev_ver);
            }

        }
    }

    // license
    if (json['license'] != undefined) {
        license.LICENSE_TYPE = json['license']['type'];
        if (json['license']['type'] == 'Other' || json['license']['type'] == 'Proprietary') {
            license.NAME = json['license']['name'];
            license.LINK = json['license']['link'];
            license.DESCRIPTION = json['license']['description'];
        }
    }

    // funding sources
    if (json['funding'] != undefined && json['funding']['funding'] != undefined) {
        for (var i = 0; i < json['funding']['funding'].length; i++) {
            var m_fund = new M_funding;
            if (json['funding']['funding'][i].agency != undefined)
                m_fund.agency = json['funding']['funding'][i].agency;
            if (json['funding']['funding'][i].grant != undefined)
                m_fund.grant = json['funding']['funding'][i].grant;
            if (json['funding']['funding'][i].missing != undefined) {
                m_fund.missing = json['funding']['funding'][i].missing;
                if (json['funding']['funding'][i].new_agency != undefined)
                    m_fund.new_agency = json['funding']['funding'][i].new_agency;
            }
            m_tool.funding.push(m_fund);
        }
    }

    // BD2K Center/Activity
    if (json['funding'] != undefined && json['funding']['bd2k'] != undefined) {
        for (var i = 0; i < json['funding']['bd2k'].length; i++) {
            var center = {};
            center['BD2K_CENTER'] = json['funding']['bd2k'][i]['center'];
            if (json['funding']['bd2k'][i]['center'] == 'Other' && json['funding']['bd2k'][i]['title'] != undefined) {
                center['PROJECT_NAME'] = json['funding']['bd2k'][i]['title'];
            }
            centers.push(center);
        }
    }

    return {
        savedID: json['savedID'],
        toolInfo: toolInfo,
        m_tool: m_tool,
        institutions: institutions,
        res_types: res_types,
        domains: domains,
        tags: tags,
        langs: langs,
        platforms: platforms,
        license: license,
        agency: agency,
        centers: centers
    };

};

/**
 * ToolUtils._mysql2solr
 * [Converts the MySQL format JSON to the solr format JSON]
 * @param  {Object} self [Reference to tool util object]
 * @param  {JSON} json [MySQL-formatted object (directly from Bookshelf)]
 * @return {JSON}      [Solr JSON]
 */
ToolUtils.prototype._mysql2solr = function(self, json) {

    // json of solr to return
    var solrDoc = {};

    // basic information
    solrDoc['id'] = json['AZID'];
    solrDoc['name'] = json['NAME'];
    solrDoc['logo'] = json['LOGO_LINK'];
    solrDoc['description'] = json['DESCRIPTION'];
    solrDoc['dateUpdated'] = json['SUBMIT_DATE'];

    // resource types
    solrDoc['types'] = [];
    if (json['resource_types'] != undefined) {
        json['resource_types'].forEach(function(type) {
            var resourceType = "";
            resourceType = type['RESOURCE_TYPE'];
            if (type['OTHER'] != undefined) {
                resourceType = type['OTHER'];
            }
            solrDoc['types'].push(resourceType);
        });
    }

    // biological domains
    solrDoc['domains'] = [];
    if (json['domains'] != undefined) {
        json['domains'].forEach(function(domain) {
            solrDoc['domains'].push(domain['DOMAIN']);
        });
    }

    // tags
    solrDoc['tags'] = [];
    if (json['tags'] != undefined) {
        json['tags'].forEach(function(tag) {
            solrDoc['tags'].push(tag['NAME']);
        });
    }

    // author information
    solrDoc['authors'] = [];
    solrDoc['authorEmails'] = [];
    if (json['authors'] != undefined) {
        json['authors'].forEach(function(author) {
            solrDoc['authors'].push(author['first_name'] + " " + author['last_name']);
            solrDoc['authorEmails'].push(author['email']);
        });
    }

    // maintainer information
    solrDoc['maintainers'] = [];
    solrDoc['maintainerEmails'] = [];
    if (json['maintainers'] != undefined) {
        json['maintainers'].forEach(function(maintainer) {
            solrDoc['maintainers'].push(maintainer['first_name'] + " " + maintainer['last_name']);
            solrDoc['maintainerEmails'].push(maintainer['email']);
        });
    }

    // affiliation/institution
    solrDoc['institutions'] = [];
    if (json['institutions'] != undefined) {
        json['institutions'].forEach(function(inst) {
            if (inst['NAME'] != undefined)
                solrDoc['institutions'].push(inst['NAME']);
            else {
                solrDoc['institutions'].push(inst['new_institution']);
            }
        });
    }

    // tool DOI
    solrDoc['toolDOI'] = json['TOOL_DOI'];

    // publications
    solrDoc['publicationDOI'] = [];
    if (json['publications'] != undefined) {
        json['publications'].forEach(function(pub) {
            solrDoc['publicationDOI'].push(pub.pub_doi);
        });
    }

    // links/URLs
    solrDoc['linkUrls'] = [];
    solrDoc['linkDescriptions'] = [];
    if (json['links'] != undefined) {
        json['links'].forEach(function(link) {
            solrDoc['linkUrls'].push(link.url);
            solrDoc['linkDescriptions'].push(link.name);
        });
    }

    // source code URL
    solrDoc['sourceCodeURL'] = json['SOURCE_LINK'];

    // programming languages
    solrDoc['languages'] = [];
    if (json['languages'] != undefined) {
        json['languages'].forEach(function(lang) {
            solrDoc['languages'].push(lang['NAME']);
        });
    }

    // supported platforms
    solrDoc['platforms'] = [];
    if (json['platform'] != undefined) {
        json['platform'].forEach(function(plat) {
            solrDoc['platforms'].push(plat['NAME']);
        });
    }

    // versions
    solrDoc['version'] = [];
    solrDoc['versionDate'] = [];
    if (json['version'] != undefined) {
        json['version'].forEach(function(ver) {
            solrDoc['version'].push(ver['version']);
            solrDoc['versionDate'].push(ver['date']);
        });
    }

    // user information
    if (json['users'] != undefined) {
        if (json['users'].length > 0) {
            solrDoc['owners'] = [];
            json['users'].forEach(function(user) {
                solrDoc['owners'].push(user['USER']);
            });
        }
    }

    // license
    solrDoc['licenses'] = json['licenses'];
    if (json['licenses'] != undefined) {
        if (json['licenses'].length > 0) {
            solrDoc['licenses'] = [];
            json['licenses'].forEach(function(license) {
                var lic = license.NAME || license.LICENSE_TYPE;
                solrDoc['licenses'].push(lic);
            });
        }
    }

    // funding sources
    if (json['funding'] != undefined) {
        if (json['funding'].length > 0) {
            solrDoc['funding'] = [];
            json['funding'].forEach(function(fund) {
                var funding = "";
                funding += fund.agency || fund.new_agency;
                funding += " " + fund.grant || "";
                solrDoc['funding'].push(funding);
            });
        }
    }


    return solrDoc;
};

/**
 * ToolUtils._unflatten
 * [Unflattens JSON object (i.e. object['attr1.attr2'] to object['attr1']['attr2']); taken from Stack Overflow]
 * @param  {Object} self [Reference to tool util object]
 * @param  {JSON} data [Any type of JSON]
 * @return {JSON}      [Unflatten JSON]
 */
ToolUtils.prototype._unflatten = function(self, data) {
    "use strict";
    if (Object(data) !== data || Array.isArray(data))
        return data;
    var regex = /\.?([^.\[\]]+)|\[(\d+)\]/g,
        resultholder = {};
    for (var p in data) {
        var cur = resultholder,
            prop = "",
            m;
        while (m = regex.exec(p)) {
            cur = cur[prop] || (cur[prop] = (m[2] ? [] : {}));
            prop = m[2] || m[1];
        }
        cur[prop] = data[p];
    }
    return resultholder[""] || resultholder;
};

/**
 * ToolUtils._removeHash
 * [Converts the MySQL format JSON to the submission form format JSON]
 * @param  {Object} self [Reference to tool util object]
 * @param  {JSON} json [Any type of JSON]
 * @return {JSON}      [JSON with all '$$hashkey' keys removed]
 */
ToolUtils.prototype._removeHash = function(self, json) {
    if (json == undefined)
        return [];
    json = json.map(function(obj) {
        delete obj['$$hashKey'];
        return obj;
    });
    return json;
};

module.exports = new ToolUtils();
