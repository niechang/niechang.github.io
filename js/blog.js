 BLOG = {};
(function(){
	var blogsRef = new Firebase('https://blistering-inferno-5110.firebaseio.com/blogs');
	var tagsRef = new Firebase('https://blistering-inferno-5110.firebaseio.com/tags');
	var textsRef = new Firebase('https://blistering-inferno-5110.firebaseio.com/texts');
	var ref = new Firebase("https://blistering-inferno-5110.firebaseio.com/"); 

	var TAGS_CACHE; // tags cache [{name:'',posts:[]},{}]
	var BLOGS_CACHE = {}; //{{tagKey: {key: {}}}, ... }

	var count = 0, current = 0;

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
                cb(user);
            }
		});
	}

	BLOG.Util.validateAuth = function (authData) {
		return authData && authData.uid === "github:2278081";
	}

	BLOG.Util.getAuth = function (cb) {
		var authData = ref.getAuth();
		cb(authData);
	}

	BLOG.Util.add = function(title,tags,text,cb) {
		var blogKey = count;
		blogsRef.child(blogKey).set({
			title: title,
			tags: tags,
			createTime: date2String(new Date())
		});
		textsRef.child(blogKey).set({ //saving blog text content
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
		count++;
	}

	BLOG.Util.loadTags = function (cb) {
		tagsRef.once("value", function (snap){
			TAGS_CACHE = snap.val();
			cb(TAGS_CACHE);
		});
	}
	BLOG.Util.getTag = function(key) {
		return TAGS_CACHE[key].name;
	}

	BLOG.Util.countPosts = function (cb) {
		blogsRef.once("value", function(snap) {
			val = snap.val();
			if(!val) { 
				count = 0;
			}
			else {
				count = Object.keys(val).length;
			}
			cb && cb();
		});
	}

	BLOG.Util.next = function (cb) {
		if(current < count - 1) {
			current++;
			BLOG.Util.loadBlog(current,cb);
		} else {
			cb();
		}
	}

	BLOG.Util.previous = function (cb) {
		if(current > 0) {
			current--;
			BLOG.Util.loadBlog(current,cb);
		} else {
			cb();
		}
	}

	BLOG.Util.hasNext = function () {
		return current >= 0 && current < count - 1; 
	}

	BLOG.Util.hasPrevious = function () {
		return current > 0 && count > 0;
	}

	BLOG.Util.loadBlog = function(key,cb) {
		if(current < 0) {
			cb();
			return;
		}
		var blog, tagNames = [];
		current = parseInt(key, 10);
		blogsRef.child(key).once("value",function(snapshot) {
			blog = snapshot.val();
  			if (TAGS_CACHE) {
  				$.each(blog.tags,function(n,tag) {
  					tagNames.push(TAGS_CACHE[tag].name);
  				});
  				blog.tagNames = tagNames;
  			}
  			textsRef.child(snapshot.key()).on("child_added", function (snap){
  				blog.text = snap.val();
  				cb(blog);
  			});
		});
	}

	/** 
	  * Get the latest one post in blogs
	  * @param {Function} cb
	  */
	BLOG.Util.getLatestOne = function (cb) {
		var blog, tagNames = [];
		if (count === 0) {
			BLOG.Util.countPosts(function () {
				current = count - 1;
				BLOG.Util.loadBlog(current, cb);
			});
		}
	}

	/**
	 * Get the blogs in the tag, and cache the blogs
	 */
	BLOG.Util.getPosts = function (tagKey, cb) {
		var tag = TAGS_CACHE[tagKey],
			blogCache = BLOGS_CACHE["tags"+tagKey];
		if(blogCache) {
			cb(blogCache);
			return;
		}
		if(tag && tag.posts && tag.posts.length > 0) {
			var posts = tag.posts,
				min = "" + posts[0],
				max = "" + posts[posts.length - 1],
				blogArray = [];
			blogsRef.orderByKey().startAt(min).endAt(max).once("value", function(snapshot) {
				var blogs = snapshot.val();
				if(blogs) {
					$.each(blogs, function(n, blog) {
						if(posts.indexOf(parseInt(n, 10)) > -1) {
							blog.key = n;
							blogArray.push(blog);
						}
					});
					BLOGS_CACHE["tags"+tagKey] = blogArray;
					cb(blogArray);
				}
			});	
		}  
	}
	
}());