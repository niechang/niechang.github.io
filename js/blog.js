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

	var TAGS_CACHE; // tags cache
	var BLOGS_CACHE; // blogs brief infomation cache

	var count = -1, current = 0;

	function date2String(date) {
		return date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + ((date.getDate() > 9) ? date.getDate() : "0" + date.getDate())
				+ " " + date.getHours() + ":" + date.getMinutes();
	}

	//items in first but not in second array
	function inANotB(first, second) {
		var result = [], i, j;
		if(!first || !second) {
			return result;
		}
		for(i = 0; i < first.length; i++) {
			if(second.indexOf(first[i]) == -1) {
				result.push(first[i]);
			}
		}
		return result;
	}

	function getTagRefs(tags) {
		var tagRefs = [];
		$.each(tags,function(n,tag) { 
			tagRefs.push(tagsRef.child(tag));
		});
		return tagRefs;
	}

	//tagRefs add blogKey
	function saveTags (tagRefs, blogKey) {
		$.each(tagRefs,function(n,tagRef) {
			tagRef.once("value", function (snap) {
				var val = snap.val();
				blogKey = parseInt(blogKey, 10);
				if (!val.posts) {
					val.posts = [];
				}
				val.posts.push(blogKey);
				tagRef.update(val);
			});
		});	
	}

	function removeTags(tagRefs, blogKey) {
		$.each(tagRefs,function(n,tagRef) {
			tagRef.once("value", function (snap) {
				var val = snap.val(), index;
				blogKey = parseInt(blogKey, 10);
				if (!val.posts || (index = val.posts.indexOf(blogKey)) === -1) {
					return;
				}
				val.posts.splice(blogKey, 1); //remove
				tagRef.update(val);
			});
		});	
	}

	//cache already load
	function getBlog(key, cb) {
		var blog, tagNames = [];
		blog = BLOGS_CACHE[key];
		textsRef.child(key).on("child_added", function (snap) { //fetch text content
			blog.text = snap.val();
			cb(blog);
		});
	}

	function loadTags(cb) {
		var dtd = $.Deferred();
		function task() {
			tagsRef.once("value", function (snap){
				TAGS_CACHE = snap.val();
				cb && cb(TAGS_CACHE);
				dtd.resolve();
			});
		}
		task();
		return dtd.promise();
	}

	/**
	 * @private
	 * set the count of blogs by query firebase
	 * @param {funciton} callback function
	 */
	function countBlogs(cb) {
		var dtd = $.Deferred();
		function task() {
			blogsRef.once("value", function(snap) {
				var val = snap.val();
				BLOGS_CACHE =  val;
				if(!val) {
					setCount(val); 
				}
				else {
					setCount(val.length);
				}
				cb && cb(val);
				dtd.resolve();
			});
		}
		task();
		return dtd.promise();
	}

	function getTagBlogs(tagKey) {
		var tag = TAGS_CACHE[tagKey];
		var blogArray = [];
		$.each(tag.posts, function(i , blogId) {
			blogArray.unshift(BLOGS_CACHE[blogId]);
		});
		return blogArray;
	}

    function setCount(val) {
    	count = val;
		current = current < 0 ? count - 1 : current;	
    }

	function loadCacheJSONTags(cb) {
		return  $.get("node_work/json_data/tags.json", function(data) {
						TAGS_CACHE = data;
						cb && cb(data);
				}, "json");
	}

	function loadCacheJSONBlogs() {
		return  $.get("node_work/json_data/blogs.json", function(data) {
					setCount(data.length);
					BLOGS_CACHE = data;
				}, "json");
	}

	function loadCacheJSONContent(id, cb) {
		if(id < 0) {
   			id = count - 1;
   		}
   		$.get("node_work/json_data/blog_" + id + ".json", function(data) {
			var blog = BLOGS_CACHE[id];
			blog.text = data.text;
			cb(blog);
		}, "json");
	}


	BLOG.Util = BLOG.Markdown = {};

	var converter;

	BLOG.Markdown.getConverter = function (){
		if(!converter) {
			converter = Markdown.getSanitizingConverter();
			Markdown.Extra.init(converter, {
			  extensions: "all",
			  highlighter: "prettify",
			  table_class: "table table-striped table-bordered"
			});
		}
		return converter;
	}

	BLOG.Util.login = function (cb) {
		ref.authWithOAuthRedirect('github', function(err, user) {
		 	  if (err) {
                console.log(err, 'error');
                cb(err);
            } else if (user) {
                cb(user);
            }
		});
	}

	/**
	 * @return boolean
	 */
	BLOG.Util.validateAuth = function (authData) {
		return authData && authData.uid === "github:2278081";
	}

	/**
     * @param {Function} callback function
     * get the auth data
	 */
	BLOG.Util.getAuth = function (cb) {
		var authData = ref.getAuth();
		cb(authData);
	}
	

	/*
	 * add or update a blog
	 * @property {Object} need to save item
	 * @property {string} text content
	 * @property {int[]}  oldTags
	 * @param {function} call back function
	 */
	BLOG.Util.saveBlog = function(item, text, oldTags, cb) {
		var blogKey, update = false, blogItem, addTagRefs, rmTagRefs, 
			rmTags, addTags, refs;
		if(item.key && !isNaN(item.key)) {
			blogKey = item.key;
			update = true;
		} else {
			blogKey = count;
			item.key = blogKey; //
		}
		if(!update) {
			item.createTime = date2String(new Date());
		}
		blogsRef.child(blogKey).set(item); //save item
		textsRef.child(blogKey).set({ //saving blog text content
			text: text
		}, function () {
			cb && cb();
		});
		if (update) { //update a post
			rmTags = inANotB(oldTags, item.tags); //need remove
			addTags = inANotB(item.tags, oldTags); //need add
			if (rmTags.length > 0) {
				rmTagRefs = getTagRefs(rmTags);
				removeTags(rmTagRefs, blogKey);
			} 
			if (addTags.length > 0) {
				addTagRefs = getTagRefs(addTags);
				saveTags(addTagRefs, blogKey);
			} 
			return;
		} else { //add a post
			addTagRefs = getTagRefs(item.tags);
			saveTags(addTagRefs, blogKey);
			count++;
		}
	}	
	
	BLOG.Util.getTag = function(key) {
		return TAGS_CACHE[key];
	}

	BLOG.Util.getTagNames = function(tags) {
       var name = "";
       $.each(tags, function(n,tag) {
          name += TAGS_CACHE[tag].name + " "; 
       });
       return name;
    }


	BLOG.Util.next = function (cb) {
		if(current < count - 1) {
			current++;
			BLOG.Util.loadBlog(current, cb);
		} else {
			cb();
		}
	}

	BLOG.Util.previous = function (cb) {
		if(current > 0) {
			current--;
			BLOG.Util.loadBlog(current, cb);
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

	/**
	 * @param {int} key the blog id, if negative use the lateste blog id
	 * @param {function} blogCallBack, the callback function to render blog
	 * @param {function} tagsCallback, to render tags
	 */
	BLOG.Util.loadBlog = function(key, blogCallBack, tagsCallBack) {
		current = parseInt(key, 10);
		if (BLOG.Util.cache) {
			if(!BLOGS_CACHE) {
				$.when(loadCacheJSONTags(tagsCallBack), loadCacheJSONBlogs()).then(function() {
					loadCacheJSONContent(key, blogCallBack)
				});
			} else {
				loadCacheJSONContent(key, blogCallBack);
			}
			return;
		}
		if (count === -1) {
			$.when(loadTags(tagsCallBack)).then(countBlogs(function() {
				getBlog(current, blogCallBack);
			}));
		} else {
			getBlog(current, blogCallBack);
		}
	}

	/**
     * load all blogs without text content, first will load tags for cache then load blogs for cache
     * param {@Function} cb
	 */
	BLOG.Util.loadAll = function (blogsCallBack, tagsCallBack) {
		if(!BLOGS_CACHE) {
			$.when(loadTags(tagsCallBack)).then(countBlogs(blogsCallBack));
		} else {
			tagsCallback(TAGS_CACHE);
			blogsCallBack(BLOGS_CACHE);
		}
	}

	/**
	 * Get the blogs in the tag, and cache the blogs
	 * @param {int} tagKey
	 * @param {function} callback function
	 */
	BLOG.Util.getPosts = function (tagKey, cb) {
		var tag = TAGS_CACHE[tagKey];
		if(BLOGS_CACHE) {
			cb(getTagBlogs(tagKey));
			return;
		}
		blogsRef.once("value", function(snapshot) {
			BLOGS_CACHE = snapshot.val();
			cb(getTagBlogs(tagKey));
		});
	}
	
}());