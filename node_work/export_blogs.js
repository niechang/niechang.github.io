/**
 * This file is for exporting the blog files from firebase to local json files
 */
var Firebase = require('firebase');
var blogsRef = new Firebase('https://blistering-inferno-5110.firebaseio.com/blogs');
var tagsRef = new Firebase('https://blistering-inferno-5110.firebaseio.com/tags');
var textsRef = new Firebase('https://blistering-inferno-5110.firebaseio.com/texts');
var fs = require('fs');
var util = require('util');
var count;
var index = 0;

function writeFile(path, data, cb) {
	fs.writeFile(path, JSON.stringify(data), cb);
}

function exprotTags(cb){
	var path = "json_data/tags.json";
	tagsRef.once("value",function(snapshot) {
		var tags = snapshot.val();
		if(tags) {
			writeFile(path, tags, cb);
		}
	});
}

function blogDetailExportCallback() {
	index++;
	console.log(index + " blog saved successfully");
	if(index === count) {
		console.log("finished");
	}
}

function exprotBlogsBrief(cb) {
	var path = "json_data/blogs.json";
	blogsRef.once("value",function(snapshot) {
		var blogsInfo = snapshot.val();
		if(blogsInfo) {
			writeFile(path, blogsInfo, cb);
		}
	});
}

function exprotBlogsDetail(cb) {
	textsRef.once("value", function(snapshot) {
		var blogDetails = snapshot.val();
		if(!blogDetails) {
			return;
		}
		count = blogDetails.length;
		blogDetails.forEach(function(detail) {
			writeFile("json_data/blog_" + index + ".json", detail, blogDetailExportCallback);
			index++;
			if (index % 10 === 0) {
				setTimeout(function(){}, 1000 * 10); //sleep 10 seconds, to prevent too many files
			}
		});
	});
}
exprotBlogsDetail();
/*setTimeout(function() {
	//writeTags(function(){ console.log("export tags success"); });
	exprotBlogsDetail(function(){ console.log("export blogs success"); });
}, 10000);*/
/*writeTags(function(){
	console.log("success");
});*/
