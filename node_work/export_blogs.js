/**
 * This file is for exporting the blog files from firebase to local json files
 */
var Firebase = require('firebase');
var blogsRef = new Firebase('https://blistering-inferno-5110.firebaseio.com/blogs');
var tagsRef = new Firebase('https://blistering-inferno-5110.firebaseio.com/tags');
var textsRef = new Firebase('https://blistering-inferno-5110.firebaseio.com/texts');
var fs = require('fs');
var util = require('util');

function writeFile(path, data, cb) {
	fs.writeFile(path, util.inspect(data), cb);
}

function writeTags(cb){
	var path = "./tags.json";
	tagsRef.once("value",function(snapshot) {
		var tags = snapshot.val();
		console.log(util.inspect(tags));
		if(tags) {
			writeFile(path, tags, cb);
		}
	});
}

setTimeout(function() {
	writeTags();
}, 10000);
/*writeTags(function(){
	console.log("success");
});*/
