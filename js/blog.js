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

	//items in first but not in second array
	function inANotB(first,second) {
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

	function maxAndmin(array) {
		var max, min, i;
		max = min = array[0];
		for(i = 1; i < array.length; i++) {
			if(array[i] > max) {
				max = array[i];
			}
			if(array[i] < min) {
				min = array[i];
			}
		}
		return {max:max, min:min};
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

	function getBlog(key,cb) {
		var blog, tagNames = [];
		blogsRef.child(key).once("value",function(snapshot) {
			blog = snapshot.val();
  			if (TAGS_CACHE && blog && blog.tags) {
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
	 * add or update a blog
	 * @property {int} [key]
	 * @property {string} title
	 * @property {int[]}  tags
	 * @param {string} text
	 */
	BLOG.Util.saveBlog = function(item, text, oldTags, cb) {
		var blogKey, update = false, blogItem, addTagRefs, rmTagRefs, 
			rmTags, addTags, refs;
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
			cb && cb(count);
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
				obj = maxAndmin(tag.posts),
				min = "" + obj.min,
				max = "" + obj.max,
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