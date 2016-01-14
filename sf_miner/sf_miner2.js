var request = require('request');
var fs = require('fs');

/*

Reads json file of sourceforge project names and downloads all information from the sourcforge REST API.
Converts metadata to Aztec format and saves as json file.

*/

/*var fileName = process.argv[2];
if(fileName == undefined)
{
	console.log("Please specify json file name.");
}
else console.log("Processing " + fileName);*/

var restCount = 0;
var maxCount = 0;

var aztecEntries = [];

var restCallback = function (error, response, body) {
	if (!error && response.statusCode == 200) {
		
		var raw = JSON.parse(body);
		
		var aztecInfo = {};
		aztecInfo.res_name = raw.name;
		if(raw.icon_url != null)
			aztecInfo.res_logo = raw.icon_url;
		aztecInfo.res_desc = raw.short_description;
		
		if(raw.external_homepage != null)
			aztecInfo.links = [{"link_name":"Homepage","link_url":raw.external_homepage}];
		
		aztecInfo.dev = {};
		aztecInfo.dev.res_code_url = raw.url;
		aztecInfo.dev.dev_lang = [];
		for(var i = 0; i < raw.categories.language.length; i++)
			aztecInfo.dev.dev_lang.push(raw.categories.language[i].fullname);
		aztecInfo.dev.dev_platform = [];
		for(var i = 0; i < raw.categories.environment.length; i++)
			aztecInfo.dev.dev_platform.push(raw.categories.environment[i].fullname);
		for(var i = 0; i < raw.categories.os.length; i++)
			aztecInfo.dev.dev_platform.push(raw.categories.os[i].fullname);
		
		aztecInfo.authors = [];
		for(var i = 0; i < raw.developers.length; i++)
			aztecInfo.authors.push({"author_name":raw.developers[i].name});
		
		aztecInfo.license = {};
		aztecInfo.license.license_type = "Open Source";
		if(raw.categories.license.length > 0)
			aztecInfo.license.license = raw.categories.license[0].fullname;
		aztecInfo.tags = [];
		for(var i = 0; i < raw.categories.topic.length; i++)
			aztecInfo.tags.push({"text":raw.categories.topic[i].fullname});
		
		
		if(raw.moved_to_url != "")
		{
			//console.log("Moved to " + raw.moved_to_url);
			aztecInfo.dev.res_code_url = raw.moved_to_url;
		}
		else
		{
			//several tools have moved to github, so i will check manually in case they
			//did not update the moved_to_url field
			var githubRegex = /github.com\/[-\w]+\/[-\w]+/g;
			if(raw.short_description.match(githubRegex))
			{
				aztecInfo.dev.res_code_url = raw.short_description.match(githubRegex)[0];
				//console.log(raw.short_description);
			}
		}
		
		aztecEntries.push(aztecInfo);
		
		restCount++;
		if(restCount % 50 == 0 || restCount == maxCount)
			console.log(restCount + ' out of ' + maxCount);
		if(restCount == maxCount)
		{
			//done
			//var file = "./sf_miner_output_detail.json";
			var date = new Date();
			
			var OUTFILE_DIRECTORY = "public/sourceforge";
			//if (!fs.existsSync(OUTFILE_DIRECTORY)) {
        	//	fs.mkdirSync(OUTFILE_DIRECTORY);
    		//}
			
			var file = OUTFILE_DIRECTORY + "/sorceforge_repositories_" + date.toISOString().replace(/:/g, "-") + ".json";
			fs.writeFile(file, JSON.stringify(aztecEntries, null, 1), function(err) {
				if(err) { return console.log(err); }

				console.log("The file was saved as " + file);
			});
		}

	}
	else
	{
		console.log("error");
		console.log("error " + response.statusCode);
		console.log(response.client._httpMessage._header);
	}
	
};

/*fs.readFile('./' + fileName, 'utf8', function(err, data) {
  if (err) throw err;
  
  var tools = JSON.parse(data);
  
  restCallback.tools = tools;
  
  maxCount = tools.length;
  for(var i = 0; i < maxCount; i++) {
  	request({ url: 'https://sourceforge.net/rest/p/' + tools[i].machine_readable_name }, restCallback);
  }
  
});*/

exports.runFromJson = function(jsonInput) {
  
  	var tools = jsonInput;
	restCallback.tools = tools;
	  
	maxCount = tools.length;
	for(var i = 0; i < maxCount; i++) {
		request({ url: 'https://sourceforge.net/rest/p/' + tools[i].machine_readable_name }, restCallback);
	}
}
