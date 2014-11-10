 BLOG = {};
(function(){
	var blogsRef = new Firebase('https://blistering-inferno-5110.firebaseio.com/blogs');
	var tagsRef = new Firebase('https://blistering-inferno-5110.firebaseio.com/tags');
	var textsRef = new Firebase('https://blistering-inferno-5110.firebaseio.com/texts');
	var ref = new Firebase("https://blistering-inferno-5110.firebaseio.com/"); 

	var CACHE_TAGS;

	function date2String(date) {
		return date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + ((date.getDate() > 9) ? date.getDate() : "0" + date.getDate())
				+ " " + date.getHours() + ":" + date.getMinutes();
	}
	BLOG.Util = {};

	BLOG.Util.login = function (cb) {
		ref.authWithOAuthPopup('github', function(err, user) {
		 	  if (err) {
                console.log(err, 'error');
                cb(err);
            } else if (user) {
            	//uid = user.uid;
               // console.log('logged in with id', uid);
                cb(user);
            }
		});
	}

	BLOG.Util.add = function(title,tags,text) {
		var blogRef = blogsRef.push({
			title: title,
			tags: tags,
			createTime: date2String(new Date())
		});
		var blogKey = blogRef.key();
		textsRef.child(blogKey).set({ //saving text content
			text: text
		});
		var tagRefs = [];
		$.each(tags,function(n,tag) { //update tag reference
			tagRefs.push(tagsRef.child(tag));
		});
		$.each(tagRefs,function(n,tagRef) {
			tagRef.once("value", function (snap) {
				var val = snap.val();
				if (!val.posts) {
					val.posts = [];
				}
				val.posts.push(blogKey);
				tagRef.update(val);
			});
		});	
	}

	BLOG.Util.loadTags = function (cb) {
		tagsRef.once("value", function (snap){
			CACHE_TAGS = snap.val();
			cb(CACHE_TAGS);
		});
	}

	BLOG.Util.getLatestOne = function (cb) {
		var blog, tagNames = [];
		blogsRef.limitToLast(1).on("child_added", function(snapshot) {
  			blog = snapshot.val();
  			if (CACHE_TAGS) {
  				$.each(blog.tags,function(n,tag) {
  					tagNames.push(CACHE_TAGS[tag].name);
  				});
  				blog.tagNames = tagNames;
  			}
  			textsRef.child(snapshot.key()).on("child_added", function (snap){
  				blog.text = snap.val();
  				cb(blog);
  			});
		});
	}
}());