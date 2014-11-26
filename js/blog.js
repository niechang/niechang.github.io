$.extend({
  getUrlVars: function(){
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++){
      hash = hashes[i].split('=');
      vars.push(hash[0]);
      vars[hash[0]] = hash[1];
    }
    return vars;
  },
  getURLParam: function(name){
    return $.getUrlVars()[name];
  }
});

BLOG = {};
(function(){
	var blogsRef = new Firebase('https://blistering-inferno-5110.firebaseio.com/blogs');
	var tagsRef = new Firebase('https://blistering-inferno-5110.firebaseio.com/tags');
	var textsRef = new Firebase('https://blistering-inferno-5110.firebaseio.com/texts');
	var ref = new Firebase("https://blistering-inferno-5110.firebaseio.com/"); 

	var TAGS_CACHE; // tags cache [{name:'',posts:[]},{}]
	var BLOGS_CACHE = {}; //{{tagKey: {key: {}}}, ... }

	var count = -1, current = 0;

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

	/*
	 * add a blog
	 * @property {int} [key]
	   @property {string} title
	   @property {int[]}  tags
	   @param {string} text
	 */
	BLOG.Util.save = function(item, text, cb) {
		var blogKey, update = false, blogItem;
		if(item.key && !isNaN(item.key)) {
			blogKey = item.key;
			update = true;
		} else {
			blogKey = count;
		}
		if(!update) {
			item.createTime = date2String(new Date());
		}
		blogsRef.child(blogKey).set(item); //save item
		textsRef.child(blogKey).set({ //saving blog text content
			text: text
		});
		if (update) {
			return;
		}
		var tagRefs = [];
		$.each(item.tags,function(n,tag) { //update tag reference
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
		return TAGS_CACHE[key];
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
			BLOG.Util.loadBlog(current,false,cb);
		} else {
			cb();
		}
	}

	BLOG.Util.previous = function (cb) {
		if(current > 0) {
			current--;
			BLOG.Util.loadBlog(current,false,cb);
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

	function getBlog(key,cb) {
		var blog, tagNames = [];
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


	BLOG.Util.loadBlog = function(key,latest,cb) {
		current = parseInt(key, 10);
		if(current < 0) {
			cb();
			return;
		}
		if (count === -1) {
			BLOG.Util.countPosts(function () {
				current = latest ? count - 1 : current;			
				getBlog(current, cb);
			});
		} else {
			getBlog(current, cb);
		}
	}

	function getTagNames(tags, cachedTag) {
       var name = "";
       $.each(tags, function(n,tag) {
          name += TAGS_CACHE[tag].name + " "; 
       });
       return name;
    }
	//@private load all blogs
	function loadBlogs(tags, cb){
		blogsRef.once("value",function(snapshot) {
			var blogs = snapshot.val(),
				blogArray = [];
			if(blogs) {
				$.each(blogs, function(n, blog) {
					blog.key = n;
					blog.tagNames = getTagNames(blog.tags);
					blogArray.unshift(blog);
				});
				cb(blogArray);
			}
		});
	}

	/**
     * load all blogs without text content
     * param {@Function} cb
	 */
	BLOG.Util.loadAll = function (cb) {
		if (!TAGS_CACHE) {
			BLOG.Util.loadTags(function(tags) {
				loadBlogs(tags,cb);
			});
		} else {
			loadBlogs(tags,cb);
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
							blog.tagNames = getTagNames(blog.tags);
							blogArray.unshift(blog);
						}
					});
					BLOGS_CACHE["tags"+tagKey] = blogArray;
					cb(blogArray);
				}
			});	
		}  
	}
	
}());