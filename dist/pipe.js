!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.BigPipe=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
'use strict';

var collection = _dereq_('./collection');

//
// Pointless function that will replace callbacks once they are executed to
// prevent double execution from ever happening.
//
function noop() { /* you waste your time by reading this, see, i told you.. */ }

/**
 * Asynchronously iterate over the given data.
 *
 * @param {Mixed} data The data we need to iterate over
 * @param {Function} iterator Function that's called for each item.
 * @param {Function} fn The completion callback
 * @param {Object} options Async options.
 * @api public
 */
exports.each = function each(data, iterator, fn, options) {
  options = options || {};

  var size = collection.size(data)
    , completed = 0
    , timeout;

  if (!size) return fn();

  collection.each(data, function iterating(item) {
    iterator.call(options.context, item, function done(err) {
      if (err) {
        fn(err);
        return fn = noop;
      }

      if (++completed === size) {
        fn();
        if (timeout) clearTimeout(timeout);
        return fn = noop;
      }
    });
  });

  //
  // Optional timeout for when the operation takes to long.
  //
  if (options.timeout) timeout = setTimeout(function kill() {
    fn(new Error('Operation timed out'));
    fn = noop;
  }, options.timeout);
};

},{"./collection":2}],2:[function(_dereq_,module,exports){
'use strict';

var hasOwn = Object.prototype.hasOwnProperty
  , undef;

/**
 * Get an accurate type check for the given Object.
 *
 * @param {Mixed} obj The object that needs to be detected.
 * @returns {String} The object type.
 * @api public
 */
function type(obj) {
  return Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
}

/**
 * Iterate over a collection.
 *
 * @param {Mixed} collection The object we want to iterate over.
 * @param {Function} iterator The function that's called for each iteration.
 * @param {Mixed} context The context of the function.
 * @api public
 */
function each(collection, iterator, context) {
  var i = 0;

  if ('array' === type(collection)) {
    for (; i < collection.length; i++) {
      iterator.call(context || iterator, collection[i], i, collection);
    }
  } else {
    for (i in collection) {
      if (hasOwn.call(collection, i)) {
        iterator.call(context || iterator, collection[i], i, collection);
      }
    }
  }
}

/**
 * Checks if the given object is empty. The only edge case here would be
 * objects. Most object's have a `length` attribute that indicate if there's
 * anything inside the object.
 *
 * @param {Mixed} collection The collection that needs to be checked.
 * @returns {Boolean}
 * @api public
 */
function empty(obj) {
  if (undef === obj) return false;

  return size(obj) === 0;
}

/**
 * Determine the size of a collection.
 *
 * @param {Mixed} collection The object we want to know the size of.
 * @returns {Number} The size of the collection.
 * @api public
 */
function size(collection) {
  var x, i = 0;

  if ('object' === type(collection)) {
    for (x in collection) i++;
    return i;
  }

  return +collection.length;
}

/**
 * Wrap the given object in an array if it's not an array already.
 *
 * @param {Mixed} obj The thing we might need to wrap.
 * @returns {Array} We promise!
 * @api public
 */
function array(obj) {
  if ('array' === type(obj)) return obj;
  if ('arguments' === type(obj)) return Array.prototype.slice.call(obj, 0);

  return obj  // Only transform objects in to an array when they exist.
    ? [obj]
    : [];
}

/**
 * Find the index of an item in the given array.
 *
 * @param {Array} arr The array we search in
 * @param {Mixed} o The object/thing we search for.
 * @returns {Number} Index of the thing.
 * @api public
 */
function index(arr, o) {
  for (
    var j = arr.length,
        i = i < 0 ? i + j < 0 ? 0 : i + j : i || 0;
    i < j && arr[i] !== o;
    i++
  );

  return j <= i ? -1 : i;

}

/**
 * Merge all given objects in to one objects.
 *
 * @returns {Object}
 * @api public
 */
function copy() {
  var result = {}
    , depth = 2
    , seen = [];

  (function worker() {
    each(array(arguments), function each(obj) {
      for (var prop in obj) {
        if (hasOwn.call(obj, prop) && !~index(seen, obj[prop])) {
          if (type(obj[prop]) !== 'object' || !depth) {
            result[prop] = obj[prop];
            seen.push(obj[prop]);
          } else {
            depth--;
            worker(result[prop], obj[prop]);
          }
        }
      }
    });
  }).apply(null, arguments);

  return result;
}

//
// Expose the collection utilities.
//
exports.array = array;
exports.empty = empty;
exports.index = index;
exports.copy = copy;
exports.size = size;
exports.type = type;
exports.each = each;

},{}],3:[function(_dereq_,module,exports){
/*globals Primus */
'use strict';

var EventEmitter = _dereq_('eventemitter3')
  , collection = _dereq_('./collection')
  , Pagelet = _dereq_('./pagelet');

/**
 * Pipe is the client-side library which is automatically added to pages which
 * uses the BigPipe framework. It assumes that this library is bundled with
 * a Primus instance which uses the `substream` plugin.
 *
 * Options:
 *
 * - limit: The amount pagelet instances we can reuse.
 * - pagelets: The amount of pagelets we're expecting to load.
 * - id: The id of the page that we're loading.
 *
 * @constructor
 * @param {String} server The server address we need to connect to.
 * @param {Object} options Pipe configuration.
 * @api public
 */
function Pipe(server, options) {
  if (!(this instanceof Pipe)) return new Pipe(server, options);
  if ('object' === typeof server) {
    options = server;
    server = undefined;
  }

  options = options || {};

  this.expected = +options.pagelets || 0; // Pagelets that this page requires.
  this.maximum = options.limit || 20;     // Max Pagelet instances we can reuse.
  this.options = options;                 // Reference to the used options.
  this.server = server;                   // The server address we connect to.
  this.templates = {};                    // Collection of templates.
  this.stream = null;                     // Reference to the connected Primus socket.
  this.pagelets = [];                     // Collection of different pagelets.
  this.freelist = [];                     // Collection of unused Pagelet instances.
  this.rendered = [];                     // List of already rendered pagelets.
  this.assets = {};                       // Asset cache.
  this.root = document.documentElement;   // The <html> element.

  EventEmitter.call(this);

  this.configure(options);
  this.visit(location.pathname, options.id);
}

//
// Inherit from EventEmitter3, use old school inheritance because that's the way
// we roll. Oh and it works in every browser.
//
Pipe.prototype = new EventEmitter();
Pipe.prototype.constructor = Pipe;

/**
 * Configure the Pipe.
 *
 * @param {Object} options Configuration.
 * @return {Pipe}
 * @api private
 */
Pipe.prototype.configure = function configure(options) {
  var root = this.root
    , className = (root.className || '').replace(/no[_-]js\s?/, '');

  //
  // Add a loading className so we can style the page accordingly and add all
  // classNames back to the root element.
  //
  className = className.length ? className.split(' ') : [];
  if (!~className.indexOf('pagelets-loading')) {
    className.push('pagelets-loading');
  }

  root.className = className.join(' ');

  return this;
};

/**
 * Horrible hack, but needed to prevent memory leaks caused by
 * `document.createDocumentFragment()` while maintaining sublime performance.
 *
 * @type {Number}
 * @private
 */
Pipe.prototype.IEV = document.documentMode
  || +(/MSIE.(\d+)/.exec(navigator.userAgent) || [])[1];

/**
 * A new Pagelet is flushed by the server. We should register it and update the
 * content.
 *
 * @param {String} name The name of the pagelet.
 * @param {Object} data Pagelet data.
 * @returns {Pipe}
 * @api public
 */
Pipe.prototype.arrive = function arrive(name, data) {
  data = data || {};

  var pipe = this
    , root = pipe.root
    , className = (root.className || '').split(' ');

  //
  // Create child pagelet after parent has finished rendering.
  //
  if (!pipe.has(name)) {
    if (data.parent && !~pipe.rendered.indexOf(data.parent)) {
      pipe.once(data.parent +':render', function render() {
        pipe.create(name, data, pipe.get(data.parent).placeholders);
      });
    } else {
      pipe.create(name, data);
    }
  }

  if (data.processed !== pipe.expected) return pipe;

  if (~className.indexOf('pagelets-loading')) {
    className.splice(className.indexOf('pagelets-loading'), 1);
  }

  root.className = className.join(' ');
  pipe.emit('loaded');

  return this;
};

/**
 * Create a new Pagelet instance.
 *
 * @param {String} name The name of the pagelet.
 * @param {Object} data Data for the pagelet.
 * @param {Array} roots Root elements we can search can search for.
 * @returns {Pipe}
 * @api private
 */
Pipe.prototype.create = function create(name, data, roots) {
  data = data || {};

  var pipe = this
    , pagelet = pipe.alloc()
    , nr = data.processed || 0;

  pipe.pagelets.push(pagelet);
  pagelet.configure(name, data, roots);

  //
  // A new pagelet has been loaded, emit a progress event.
  //
  pipe.emit('progress', Math.round((nr / pipe.expected) * 100), nr, pagelet);
  pipe.emit('create', pagelet);
};

/**
 * Check if the pagelet has already been loaded.
 *
 * @param {String} name The name of the pagelet.
 * @returns {Boolean}
 * @api public
 */
Pipe.prototype.has = function has(name) {
  return !!this.get(name);
};

/**
 * Get a pagelet that has already been loaded.
 *
 * @param {String} name The name of the pagelet.
 * @param {String} parent Optional name of the parent.
 * @returns {Pagelet|undefined} The found pagelet.
 * @api public
 */
Pipe.prototype.get = function get(name, parent) {
  var found;

  collection.each(this.pagelets, function each(pagelet) {
    if (name === pagelet.name) {
      found = !parent || pagelet.parent && parent === pagelet.parent.name
        ? pagelet
        : found;
    }

    return !found;
  });

  return found;
};

/**
 * Remove the pagelet.
 *
 * @param {String} name The name of the pagelet that needs to be removed.
 * @returns {Pipe}
 * @api public
 */
Pipe.prototype.remove = function remove(name) {
  var pagelet = this.get(name)
    , index = collection.index(this.pagelets, pagelet);

  if (~index && pagelet) {
    this.emit('remove', pagelet);
    this.pagelets.splice(index, 1);
    pagelet.destroy();
  }

  return this;
};

/**
 * Broadcast an event to all connected pagelets.
 *
 * @param {String} event The event that needs to be broadcasted.
 * @returns {Pipe}
 * @api public
 */
Pipe.prototype.broadcast = function broadcast(event) {
  var args = arguments;

  collection.each(this.pagelets, function each(pagelet) {
    EventEmitter.prototype.emit.apply(pagelet, args);
  });

  return this;
};

/**
 * Allocate a new Pagelet instance, retrieve it from our pagelet cache if we
 * have free pagelets available in order to reduce garbage collection.
 *
 * @returns {Pagelet}
 * @api private
 */
Pipe.prototype.alloc = function alloc() {
  return this.freelist.length
    ? this.freelist.shift()
    : new Pagelet(this);
};

/**
 * Free an allocated Pagelet instance which can be re-used again to reduce
 * garbage collection.
 *
 * @param {Pagelet} pagelet The pagelet instance.
 * @returns {Boolean}
 * @api private
 */
Pipe.prototype.free = function free(pagelet) {
  if (this.freelist.length < this.maximum) {
    this.freelist.push(pagelet);
    return true;
  }

  return false;
};

/**
 * Register a new URL that we've joined.
 *
 * @param {String} url The current URL.
 * @param {String} id The id of the Page that rendered this page.
 * @api public
 */
Pipe.prototype.visit = function visit(url, id) {
  this.id = id || this.id;              // Unique ID of the page.
  this.url = url;                       // Location of the page.

  if (!this.orchestrate) return this.connect();

  this.orchestrate.write({
    url: this.url,
    type: 'page',
    id: this.id
  });

  return this;
};

/**
 * Setup a real-time connection to the pagelet server.
 *
 * @param {String} url The server address.
 * @param {Object} options The Primus configuration.
 * @returns {Pipe}
 * @api private
 */
Pipe.prototype.connect = function connect(url, options) {
  options = options || {};
  options.manual = true;

  var primus = this.stream = new Primus(url, options)
    , pipe = this;

  this.orchestrate = primus.substream('pipe:orchestrate');

  /**
   * Upgrade the connection with URL information about the current page.
   *
   * @param {Object} options The connection options.
   * @api private
   */
  primus.on('outgoing::url', function url(options) {
    var querystring = primus.querystring(options.query || '');

    querystring._bp_pid = pipe.id;
    querystring._bp_url = pipe.url;

    options.query = primus.querystringify(querystring);
  });

  //
  // We forced manual opening of the connection so we can listen to the correct
  // event as it will be executed directly after the `.open` call.
  //
  primus.open();

  return this;
};

//
// Expose the pipe
//
module.exports = Pipe;

},{"./collection":2,"./pagelet":13,"eventemitter3":6}],4:[function(_dereq_,module,exports){
'use strict';

/**
 * Representation of one single file that will be loaded.
 *
 * @constructor
 * @param {String} url The file URL.
 * @param {Function} fn Optional callback.
 * @api private
 */
function File(url, fn) {
  if (!(this instanceof File)) return new File(url, fn);

  this.readyState = File.LOADING;
  this.start = +new Date();
  this.callbacks = [];
  this.cleanup = [];
  this.url = url;

  if ('function' === typeof fn) {
    this.callbacks.push(fn);
  }
}

//
// The different readyStates for our File class.
//
File.DEAD     = -1;
File.LOADING  = 0;
File.LOADED   = 1;

/**
 * Added cleanup hook.
 *
 * @param {Function} fn Clean up callback
 * @api public
 */
File.prototype.unload = function unload(fn) {
  this.cleanup.push(fn);
  return this;
};

/**
 * Execute the callbacks.
 *
 * @param {Error} err Optional error.
 * @api public
 */
File.prototype.exec = function exec(err) {
  this.readyState = File.LOADED;

  if (!this.callbacks.length) return this;
  for (var i = 0; i < this.callbacks.length; i++) {
    this.callbacks[i].apply(this.callbacks[i], arguments);
  }

  this.callbacks.length = 0;
  if (err) this.destroy();

  return this;
};

/**
 * Destroy the file.
 *
 * @api public
 */
File.prototype.destroy = function destroy() {
  this.exec(new Error('Resource has been destroyed before it was loaded'));

  if (this.cleanup.length) for (var i = 0; i < this.cleanup.length; i++) {
    this.cleanup[i]();
  }

  this.readyState = File.DEAD;
  this.cleanup.length = 0;

  return this;
};

/**
 * Asynchronously load JavaScript and Stylesheets.
 *
 * Options:
 *
 * - document: Document where elements should be created from.
 * - prefix: Prefix for the id that we use to poll for stylesheet completion.
 * - timeout: Load timeout.
 * - onload: Stylesheet onload supported.
 *
 * @constructor
 * @param {HTMLElement} root The root element we should append to.
 * @param {Object} options Configuration.
 * @api public
 */
function AsyncAsset(root, options) {
  if (!(this instanceof AsyncAsset)) return new AsyncAsset(root, options);
  options = options || {};

  this.document = 'document' in options ? options.document : document;
  this.prefix = 'prefix' in options ? options.prefix : 'pagelet_';
  this.timeout = 'timeout' in options ? options.timeout : 30000;
  this.onload = 'onload' in options ? options.onload : null;
  this.root = root || this.document.head || this.document.body;

  this.sheets = [];   // List of active stylesheets.
  this.files = {};    // List of loaded or loading files.
  this.meta = {};     // List of meta elements for polling.

  if (null === this.onload) {
    this.feature();
  }
}

/**
 * Remove a asset.
 *
 * @param {String} url URL we need to load.
 * @returns {AsyncAsset}
 * @api public
 */
AsyncAsset.prototype.remove = function remove(url) {
  if (!(url in this.files)) return this;

  this.files[url].destroy();
  delete this.files[url];
};

/**
 * Load a new asset.
 *
 * @param {String} url URL we need to load.
 * @param {Function} fn Completion callback.
 * @returns {AsyncAsset}
 * @api public
 */
AsyncAsset.prototype.add = function add(url, fn) {
  if (this.progress(url, fn)) return this;
  if ('js' === this.type(url)) return this.script(url, fn);
  if ('css' === this.type(url)) return this.style(url, fn);

  throw new Error('Unsupported file type');
};

/**
 * Check if the given URL has already loaded or is currently in progress of
 * being loaded.
 *
 * @param {String} url URL that needs to be loaded.
 * @returns {Boolean} The loading is already in progress.
 * @api private
 */
AsyncAsset.prototype.progress = function progress(url, fn) {
  if (!(url in this.files)) return false;

  var file = this.files[url];

  if (File.LOADING === file.readyState) {
    file.callbacks.push(fn);
  } else if (File.LOADED === file.readyState) {
    fn();
  } else if (File.DEAD === file.readyState) {
    return false;
  }

  return true;
};

/**
 * Trigger the callbacks for a given URL.
 *
 * @param {String} url URL that has been loaded.
 * @param {Error} err Optional error argument when shit fails.
 * @api private
 */
AsyncAsset.prototype.callback = function callback(url, err) {
  var file = this.files[url]
    , meta = this.meta[url];

  if (!file) return;

  file.exec(err);

  if (err) delete this.files[url];
  if (meta) {
    meta.parentNode.removeChild(meta);
    delete this.meta[url];
  }
};

/**
 * Determine the file type for a given URL.
 *
 * @param {String} url File URL.
 * @returns {String} The extension of the URL.
 * @api private
 */
AsyncAsset.prototype.type = function type(url) {
  return url.split('.').pop().toLowerCase();
};

/**
 * Load a new script with a source.
 *
 * @param {String} url The script file that needs to be loaded in to the page.
 * @param {Function} fn The completion callback.
 * @returns {AsyncAsset}
 * @api private
 */
AsyncAsset.prototype.script = function scripts(url, fn) {
  var script = this.document.createElement('script')
    , file = this.files[url] = new File(url, fn)
    , async = this;

  //
  // Add an unload handler which removes the DOM node from the root element.
  //
  file.unload(function unload() {
    script.onerror = script.onload = script.onreadystatechange = null;
    if (script.parentNode) script.parentNode.removeChild(script);
  });

  //
  // Required for FireFox 3.6 / Opera async loading. Normally browsers would
  // load the script async without this flag because we're using createElement
  // but these browsers need explicit flags.
  //
  script.async = true;

  //
  // onerror is not triggered by all browsers, but should give us a clean
  // indication of failures so it doesn't matter if you're browser supports it
  // or not, we still want to listen for it.
  //
  script.onerror = function onerror() {
    script.onerror = script.onload = script.onreadystatechange = null;
    async.callback(url, new Error('Failed to load the script.'));
  };

  //
  // All "latest" browser seem to support the onload event for detecting full
  // script loading. Internet Explorer 11 no longer needs to use the
  // onreadystatechange method for completion indication.
  //
  script.onload = function onload() {
    script.onerror = script.onload = script.onreadystatechange = null;
    async.callback(url);
  };

  //
  // Fall-back for older IE versions, they do not support the onload event on the
  // script tag and we need to check the script readyState to see if it's
  // successfully loaded.
  //
  script.onreadystatechange = function onreadystatechange() {
    if (this.readyState in { loaded: 1, complete: 1 }) {
      script.onerror = script.onload = script.onreadystatechange = null;
      async.callback(url);
    }
  };

  //
  // The src needs to be set after the element has been added to the document.
  // If I remember correctly it had to do something with an IE8 bug.
  //
  this.root.appendChild(script);
  script.src = url;

  return this;
};

/**
 * Load CSS files by using @import statements.
 *
 * @param {String} url URL to load.
 * @param {Function} fn Completion callback.
 * @returns {AsyncAsset}
 * @api private
 */
AsyncAsset.prototype.style = function style(url, fn) {
  if (!this.document.styleSheet) return this.link(url, fn);

  var file = this.file[url] = new File(url, fn)
    , sheet, i = 0;

  //
  // Internet Explorer can only have 31 style tags on a single page. One single
  // style tag is also limited to 31 @import statements so this gives us room to
  // have 961 style sheets totally. So we should queue style sheets. This
  // limitation has been removed in Internet Explorer 10.
  //
  // @see http://john.albin.net/ie-css-limits/two-style-test.html
  // @see http://support.microsoft.com/kb/262161
  // @see http://blogs.msdn.com/b/ieinternals/archive/2011/05/14/internet-explorer-stylesheet-rule-selector-import-sheet-limit-maximum.aspx
  //
  for (; i < this.sheets.length; i++) {
    if (this.sheets[i].imports.length < 31) {
      sheet = this.sheets[i];
      break;
    }
  }

  //
  // We didn't find suitable style Sheet to add another @import statement,
  // create a new one so we can leverage that instead.
  //
  // @TODO we should probably check the amount of `document.styleSheets.length`
  //       to check if we're allowed to add more style sheets.
  //
  if (!sheet) {
    sheet = this.document.createStyleSheet();
    this.sheets.push(sheet);
  }

  //
  // Remove the import from the stylesheet.
  //
  file.unload(function unload() {
    sheet.removeImport(i);
  });

  sheet.addImport(url);
  return this.setInterval(url);
};

/**
 * Load CSS by adding link tags on to the page.
 *
 * @param {String} url URL to load.
 * @param {Function} fn Completion callback.
 * @returns {AsyncAsset}
 * @api private
 */
AsyncAsset.prototype.link = function links(url, fn) {
  var link = this.document.createElement('link')
    , file = this.files[url] = new File(url, fn)
    , async = this;

  file.unload(function unload() {
    link.onload = link.onerror = null;
    link.parentNode.removeChild(link);
  });

  if (this.onload) {
    link.onload = function onload() {
      link.onload = link.onerror = null;
      async.callback(url);
    };

    link.onerror = function onerror() {
      link.onload = link.onerror = null;
      async.callback(url, new Error('Failed to load the stylesheet'));
    };
  }

  link.href = url;
  link.type = 'text/css';
  link.rel = 'stylesheet';

  this.root.appendChild(link);
  return this.setInterval(url);
};

/**
 * Poll our stylesheets to see if the style's have been applied.
 *
 * @param {String} url URL to check
 * @api private
 */
AsyncAsset.prototype.setInterval = function setIntervals(url) {
  if (url in this.meta) return this;

  //
  // Create a meta tag which we can inject in to the page and give it the id of
  // the prefixed CSS rule so we know when the style sheet is loaded based on the
  // style of this meta element.
  //
  var meta = this.meta[url] = this.document.createElement('meta')
    , async = this;

  meta.id = [
    this.prefix,
    url.split('/').pop().split('.').shift()
  ].join('').toLowerCase();

  this.root.appendChild(meta);

  if (this.setInterval.timer) return this;

  //
  // Start the reaping process.
  //
  this.setInterval.timer = setInterval(function interval() {
    var now = +new Date()
      , url, file, style, meta
      , compute = window.getComputedStyle;

    for (url in async.meta) {
      meta = async.meta[url];
      if (!meta) continue;

      file = async.files[url];
      style = compute ? getComputedStyle(meta) : meta.currentStyle;

      //
      // We assume that CSS added an increased style to the given prefixed CSS
      // tag.
      //
      if (file && style && parseInt(style.height, 10) > 1) {
        file.exec();
      }

      if (
           !file
        || file.readyState === File.DEAD
        || file.readyState === File.LOADED
        || (now - file.start > async.timeout)
      ) {
        if (file) file.exec(new Error('Stylesheet loading has timed out'));
        meta.parentNode.removeChild(meta);
        delete async.meta[url];
      }
    }

    //
    // If we can iterate over the async.meta object there are still objects
    // left that needs to be polled.
    //
    for (url in async.meta) return;

    clearInterval(async.setInterval.timer);
    delete async.setInterval.timer;
  }, 20);

  return this;
};

/**
 * Try to detect if this browser supports the onload events on the link tag.
 * It's a known cross browser bug that can affect WebKit, FireFox and Opera.
 * Internet Explorer is the only browser that supports the onload event
 * consistency but it has other bigger issues that prevents us from using this
 * method.
 *
 * @returns {AsyncAsset}
 * @api private
 */
AsyncAsset.prototype.feature = function detect() {
  if (this.feature.detecting) return this;

  this.feature.detecting = true;

  var link = document.createElement('link')
    , async = this;

  link.rel = 'stylesheet';
  link.href = 'data:text/css;base64,';

  link.onload = function loaded() {
    link.parentNode.removeChild(link);

    link.onload = false;
    async.onload = true;
  };

  this.root.appendChild(link);

  return this;
};

//
// Expose the file instance.
//
AsyncAsset.File = File;

//
// Expose the asset loader
//
module.exports = AsyncAsset;

},{}],5:[function(_dereq_,module,exports){

},{}],6:[function(_dereq_,module,exports){
'use strict';

/**
 * Minimal EventEmitter interface that is molded against the Node.js
 * EventEmitter interface.
 *
 * @constructor
 * @api public
 */
function EventEmitter() {
  this._events = {};
}

/**
 * Return a list of assigned event listeners.
 *
 * @param {String} event The events that should be listed.
 * @returns {Array}
 * @api public
 */
EventEmitter.prototype.listeners = function listeners(event) {
  return Array.apply(this, this._events[event] || []);
};

/**
 * Emit an event to all registered event listeners.
 *
 * @param {String} event The name of the event.
 * @returns {Boolean} Indication if we've emitted an event.
 * @api public
 */
EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
  if (!this._events || !this._events[event]) return false;

  var listeners = this._events[event]
    , length = listeners.length
    , len = arguments.length
    , fn = listeners[0]
    , args
    , i;

  if (1 === length) {
    if (fn.__EE3_once) this.removeListener(event, fn);

    switch (len) {
      case 1:
        fn.call(fn.__EE3_context || this);
      break;
      case 2:
        fn.call(fn.__EE3_context || this, a1);
      break;
      case 3:
        fn.call(fn.__EE3_context || this, a1, a2);
      break;
      case 4:
        fn.call(fn.__EE3_context || this, a1, a2, a3);
      break;
      case 5:
        fn.call(fn.__EE3_context || this, a1, a2, a3, a4);
      break;
      case 6:
        fn.call(fn.__EE3_context || this, a1, a2, a3, a4, a5);
      break;

      default:
        for (i = 1, args = new Array(len -1); i < len; i++) {
          args[i - 1] = arguments[i];
        }

        fn.apply(fn.__EE3_context || this, args);
    }
  } else {
    for (i = 1, args = new Array(len -1); i < len; i++) {
      args[i - 1] = arguments[i];
    }

    for (i = 0; i < length; fn = listeners[++i]) {
      if (fn.__EE3_once) this.removeListener(event, fn);
      fn.apply(fn.__EE3_context || this, args);
    }
  }

  return true;
};

/**
 * Register a new EventListener for the given event.
 *
 * @param {String} event Name of the event.
 * @param {Functon} fn Callback function.
 * @param {Mixed} context The context of the function.
 * @api public
 */
EventEmitter.prototype.on = function on(event, fn, context) {
  if (!this._events) this._events = {};
  if (!this._events[event]) this._events[event] = [];

  fn.__EE3_context = context;
  this._events[event].push(fn);

  return this;
};

/**
 * Add an EventListener that's only called once.
 *
 * @param {String} event Name of the event.
 * @param {Function} fn Callback function.
 * @param {Mixed} context The context of the function.
 * @api public
 */
EventEmitter.prototype.once = function once(event, fn, context) {
  fn.__EE3_once = true;
  return this.on(event, fn, context);
};

/**
 * Remove event listeners.
 *
 * @param {String} event The event we want to remove.
 * @param {Function} fn The listener that we need to find.
 * @api public
 */
EventEmitter.prototype.removeListener = function removeListener(event, fn) {
  if (!this._events || !this._events[event]) return this;

  var listeners = this._events[event]
    , events = [];

  for (var i = 0, length = listeners.length; i < length; i++) {
    if (fn && listeners[i] !== fn) {
      events.push(listeners[i]);
    }
  }

  //
  // Reset the array, or remove it completely if we have no more listeners.
  //
  if (events.length) this._events[event] = events;
  else this._events[event] = null;

  return this;
};

/**
 * Remove all listeners or only the listeners for the specified event.
 *
 * @param {String} event The event want to remove all listeners for.
 * @api public
 */
EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
  if (!this._events) return this;

  if (event) this._events[event] = null;
  else this._events = {};

  return this;
};

//
// Alias methods names because people roll like that.
//
EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
EventEmitter.prototype.addListener = EventEmitter.prototype.on;

//
// This function doesn't apply anymore.
//
EventEmitter.prototype.setMaxListeners = function setMaxListeners() {
  return this;
};

//
// Expose the module.
//
EventEmitter.EventEmitter = EventEmitter;
EventEmitter.EventEmitter2 = EventEmitter;
EventEmitter.EventEmitter3 = EventEmitter;

try { module.exports = EventEmitter; }
catch (e) {}

},{}],7:[function(_dereq_,module,exports){
'use strict';

var Container = _dereq_('containerization')
  , EventEmitter = _dereq_('eventemitter3')
  , iframe = _dereq_('frames');

/**
 * Fortress: Container and Image management for front-end code.
 *
 * @constructor
 * @param {Object} options Fortress configuration
 * @api private
 */
function Fortress(options) {
  if (!(this instanceof Fortress)) return new Fortress(options);
  options = options || {};

  //
  // Create a small dedicated container that houses all our iframes. This might
  // add an extra DOM node to the page in addition to each iframe but it will
  // ultimately result in a cleaner DOM as everything is nicely tucked away.
  //
  var scripts = document.getElementsByTagName('script')
    , append = scripts[scripts.length - 1] || document.body
    , div = document.createElement('div');

  append.parentNode.insertBefore(div, append);

  this.global = (function global() { return this; })() || window;
  this.containers = {};
  this.mount = div;

  scripts = null;

  EventEmitter.call(this);
}

//
// Fortress inherits from EventEmitter3.
//
Fortress.prototype = new EventEmitter();
Fortress.prototype.constructor = Fortress;

/**
 * Detect the current globals that are loaded in to this page. This way we can
 * see if we are leaking data.
 *
 * @param {Array} old Optional array with previous or known leaks.
 * @returns {Array} Names of the leaked globals.
 * @api private
 */
Fortress.prototype.globals = function globals(old) {
  var i = iframe(this.mount, 'iframe_'+ (+new Date()))
    , windoh = i.add().window()
    , global = this.global
    , result = [];

  i.remove();

  //
  // Detect the globals and return them.
  //
  for (var key in global) {
    var introduced = !(key in windoh);

    //
    // We've been given an array, so we should use that as the source of previous
    // and acknowledged leaks and only return an array that contains newly
    // introduced leaks.
    //
    if (introduced) {
      if (old && old.length && !!~old.indexOf(key)) continue;

      result.push(key);
    }
  }

  return result;
};

/**
 * List all active containers.
 *
 * @returns {Array} Active containers.
 * @api public
 */
Fortress.prototype.all = function all() {
  var everything = [];

  for (var id in this.containers) {
    everything.push(this.containers[id]);
  }

  return everything;
};

/**
 * Generate an unique, unknown id that we can use for our container storage.
 *
 * @returns {String}
 * @api private
 */
Fortress.prototype.id = function id() {
  for (var i = 0, generated = []; i < 4; i++) {
    generated.push(Math.random().toString(36).substring(2));
  }

  generated = 'fortress_'+ generated.join('_');

  //
  // Ensure that we didn't generate a pre-existing id, if we did, generate
  // another id.
  //
  if (generated in this.containers) return this.id();
  return generated;
};

/**
 * Create a new container.
 *
 * @param {String} code
 * @param {Object} options Options for the container
 * @returns {Container}
 * @api public
 */
Fortress.prototype.create = function create(code, options) {
  var container = new Container(this.mount, this.id(), code, options);
  this.containers[container.id] = container;

  return container;
};

/**
 * Get a container based on it's unique id.
 *
 * @param {String} id The container id.
 * @returns {Container}
 * @api public
 */
Fortress.prototype.get = function get(id) {
  return this.containers[id];
};

/**
 * Inspect a running Container in order to get more detailed information about
 * the process and the state of the container.
 *
 * @param {String} id The container id.
 * @api public
 */
Fortress.prototype.inspect = Fortress.prototype.top = function inspect(id) {
  var container = this.get(id);
  if (!container) return {};

  return container.inspect();
};

/**
 * Start the container with the given id.
 *
 * @param {String} id The container id.
 * @api public
 */
Fortress.prototype.start = function start(id) {
  var container = this.get(id);
  if (!container) return this;

  container.start();
  return this;
};

/**
 * Stop a running container, this does not fully destroy the container. It
 * merely stops it from running. Stopping an container will cause the container
 * to start from the beginning again once it's started. This is not a pause
 * function.
 *
 * @param {String} id The container id.
 * @api public
 */
Fortress.prototype.stop = function stop(id) {
  var container = this.get(id);
  if (!container) return this;

  container.stop();
  return this;
};

/**
 * Restart a container. Basically, just a start and stop.
 *
 * @param {String} id The container id.
 * @api public
 */
Fortress.prototype.restart = function restart(id) {
  var container = this.get(id);
  if (!container) return this;

  container.stop().start();

  return this;
};

/**
 * Completely remove and shutdown the given container id.
 *
 * @param {String} id The container id.
 * @api public
 */
Fortress.prototype.kill = function kill(id) {
  var container = this.get(id);
  if (!container) return this;

  container.destroy();
  delete this.containers[id];

  return this;
};

/**
 * Start streaming logging information and cached logs.
 *
 * @param {String} id The container id.
 * @param {String} method The log method name.
 * @param {Function} fn The function that needs to be called for each stream.
 * @api public
 */
Fortress.prototype.attach = function attach(id, method, fn) {
  var container = this.get(id);
  if (!container) return this;

  if ('function' === typeof method) {
    fn = method;
    method = 'attach';
  } else {
    method += 'attach::'+ method;
  }

  container.on(method, fn);

  return this;
};

/**
 * Stop streaming logging information and cached logs.
 *
 * @param {String} id The container id.
 * @param {String} method The log method name.
 * @param {Function} fn The function that needs to be called for each stream.
 * @api public
 */
Fortress.prototype.detach = function detach(id, method, fn) {
  var container = this.get(id);
  if (!container) return this;

  if ('function' === typeof method) {
    fn = method;
    method = 'attach';
  } else {
    method += 'attach::'+ method;
  }

  if (!fn) container.removeAllListeners(method);
  else container.on(method, fn);

  return this;
};

/**
 * Destroy all active containers and clean up all references. We expect no more
 * further calls to this Fortress instance.
 *
 * @api public
 */
Fortress.prototype.destroy = function destroy() {
  for (var id in this.containers) {
    this.kill(id);
  }

  this.mount.parentNode.removeChild(this.mount);
  this.global = this.mount = this.containers = null;
};

/**
 * Prepare a file or function to be loaded in to a Fortress based Container.
 * When the transfer boolean is set we assume that you want to load pass the
 * result of to a function or assign it a variable from the server to the client
 * side:
 *
 * ```
 * <script>
 * var code = <%- Fortress.stringify(code, true) %>
 * </script>
 * ```
 *
 * @param {String|Function} code The code that needs to be transformed.
 * @param {Boolean} transfer Prepare the code for transfer.
 * @returns {String}
 * @api public
 */
Fortress.stringify = function stringify(code, transfer) {
  if ('function' === typeof code) {
    //
    // We've been given a pure function, so we need to wrap it a little bit
    // after we've done a `toString` for the source retrieval so the function
    // will automatically execute when it's activated.
    //
    code = '('+ code.toString() +'())';
  } else {
    //
    // We've been given a string, so we're going to assume that it's path to file
    // that should be included instead.
    //
    code = _dereq_('fs').readFileSync(code, 'utf-8');
  }

  return transfer ? JSON.stringify(code) : code;
};

//
// Expose the module.
//
module.exports = Fortress;

},{"containerization":8,"eventemitter3":10,"frames":11,"fs":5}],8:[function(_dereq_,module,exports){
'use strict';

var EventEmitter = _dereq_('eventemitter3')
  , BaseImage = _dereq_('alcatraz')
  , slice = Array.prototype.slice
  , iframe = _dereq_('frames');

/**
 * Representation of a single container.
 *
 * Options:
 *
 * - retries; When an error occurs, how many times should we attempt to restart
 *   the code before we automatically stop() the container.
 * - stop; Stop the container when an error occurs.
 * - timeout; How long can a ping packet timeout before we assume that the
 *   container has died and should be restarted.
 *
 * @constructor
 * @param {Element} mount The element we should attach to.
 * @param {String} id A unique id for this container.
 * @param {String} code The actual that needs to run within the sandbox.
 * @param {Object} options Container configuration.
 * @api private
 */
function Container(mount, id, code, options) {
  if (!(this instanceof Container)) return new Container(mount, id, code, options);

  if ('object' === typeof code) {
    options = code;
    code = null;
  }

  options = options || {};

  this.i = iframe(mount, id);         // The generated iframe.
  this.mount = mount;                 // Mount point of the container.
  this.console = [];                  // Historic console.* output.
  this.setTimeout = {};               // Stores our setTimeout references.
  this.id = id;                       // Unique id.
  this.readyState = Container.CLOSED; // The readyState of the container.

  this.created = +new Date();         // Creation EPOCH.
  this.started = null;                // Start EPOCH.

  this.retries = 'retries' in options // How many times should we reload
    ? +options.retries || 3
    : 3;

  this.timeout = 'timeout' in options // Ping timeout before we reboot.
    ? +options.timeout || 1050
    : 1050;

  //
  // Initialise as an EventEmitter before we start loading in the code.
  //
  EventEmitter.call(this);

  //
  // Optional code to load in the container and start it directly.
  //
  if (code) this.load(code).start();
}

//
// The container inherits from the EventEmitter3.
//
Container.prototype = new EventEmitter();
Container.prototype.constructor = Container;

/**
 * Internal readyStates for the container.
 *
 * @type {Number}
 * @private
 */
Container.CLOSING = 1;
Container.OPENING = 2;
Container.CLOSED  = 3;
Container.OPEN    = 4;

/**
 * Start a new ping timeout.
 *
 * @api private
 */
Container.prototype.ping = function ping() {
  if (this.setTimeout.pong) clearTimeout(this.setTimeout.pong);

  var self = this;
  this.setTimeout.pong = setTimeout(function pong() {
    self.onmessage({
      type: 'error',
      scope: 'iframe.timeout',
      args: [
        'the iframe is no longer responding with ping packets'
      ]
    });
  }, this.timeout);

  return this;
};

/**
 * Retry loading the code in the iframe. The container will be restored to a new
 * state or completely reset the iframe.
 *
 * @api private
 */
Container.prototype.retry = function retry() {
  switch (this.retries) {
    //
    // This is our last attempt, we've tried to have the iframe restart the code
    // it self, so for our last attempt we're going to completely create a new
    // iframe and re-compile the code for it.
    //
    case 1:
      this.stop(); // Clear old iframe and nuke it's references
      this.i = iframe(this.mount, this.id);
      this.load(this.image.source).start();
    break;

    //
    // No more attempts left.
    //
    case 0:
      this.stop();
      this.emit('end');
    return;

    //
    // By starting and stopping (and there for removing and adding it back to
    // the DOM) the iframe will reload it's HTML and the added code.
    //
    default:
      this.stop().start();
    break;
  }

  this.emit('retry', this.retries);
  this.retries--;

  return this;
};

/**
 * Inspect the container to get some useful statistics about it and it's health.
 *
 * @returns {Object}
 * @api public
 */
Container.prototype.inspect = function inspect() {
  if (!this.i.attached()) return {};

  var date = new Date()
    , memory;

  //
  // Try to read out the `performance` information from the iframe.
  //
  if (this.i.window() && this.i.window().performance) {
    memory = this.i.window().performance.memory;
  }

  memory = memory || {};

  return {
    readyState: this.readyState,
    retries: this.retries,
    uptime: this.started ? (+date) - this.started : 0,
    date: date,
    memory: {
      limit: memory.jsHeapSizeLimit || 0,
      total: memory.totalJSHeapSize || 0,
      used: memory.usedJSHeapSize || 0
    }
  };
};


/**
 * Parse and process incoming messages from the iframe. The incoming messages
 * should be objects that have a `type` property. The main reason why we have
 * this as a separate method is to give us flexibility. We are leveraging iframes
 * at the moment, but in the future we might want to leverage WebWorkers for the
 * sand boxing of JavaScript.
 *
 * @param {Object} packet The incoming message.
 * @returns {Boolean} Message was handled y/n.
 * @api private
 */
Container.prototype.onmessage = function onmessage(packet) {
  if ('object' !== typeof packet) return false;
  if (!('type' in packet)) return false;

  packet.args = packet.args || [];

  switch (packet.type) {
    //
    // The code in the iframe used the `console` method.
    //
    case 'console':
      this.console.push({
        scope: packet.scope,
        epoch: +new Date(),
        args: packet.args
      });

      if (packet.attach) {
        this.emit.apply(this, ['attach::'+ packet.scope].concat(packet.args));
        this.emit.apply(this, ['attach', packet.scope].concat(packet.args));
      }
    break;

    //
    // An error happened in the iframe, process it.
    //
    case 'error':
      var failure = packet.args[0].stack ? packet.args[0] : new Error(packet.args[0]);
      failure.scope = packet.scope || 'generic';

      this.emit('error', failure);
      this.retry();
    break;

    //
    // The iframe and it's code has been loaded.
    //
    case 'load':
      if (this.readyState !== Container.OPEN) {
        this.readyState = Container.OPEN;
        this.emit('start');
      }
    break;

    //
    // The iframe is unloading, attaching
    //
    case 'unload':
      if (this.readyState !== Container.CLOSED) {
        this.readyState = Container.CLOSED;
        this.emit('stop');
      }
    break;

    //
    // We've received a ping response from the iframe, so we know it's still
    // running as intended.
    //
    case 'ping':
      this.ping();
      this.emit('ping');
    break;

    //
    // Handle unknown package types by just returning false after we've emitted
    // it as an `regular` message.
    //
    default:
      this.emit.apply(this, ['message'].concat(packet.args));
    return false;
  }

  return true;
};

/**
 * Small wrapper around sandbox evaluation.
 *
 * @param {String} cmd The command to executed in the iframe.
 * @param {Function} fn Callback
 * @api public
 */
Container.prototype.eval = function evil(cmd, fn) {
  var data;

  try {
    data = this.i.add().window().eval(cmd);
  } catch (e) {
    return fn(e);
  }

  return fn(undefined, data);
};

/**
 * Start the container.
 *
 * @returns {Container}
 * @api public
 */
Container.prototype.start = function start() {
  this.readyState = Container.OPENING;

  var self = this;

  /**
   * Simple argument proxy.
   *
   * @api private
   */
  function onmessage() {
    self.onmessage.apply(self, arguments);
  }

  //
  // Code loading is an sync process, but this COULD cause huge stack traces
  // and really odd feedback loops in the stack trace. So we deliberately want
  // to destroy the stack trace here.
  //
  this.setTimeout.start = setTimeout(function async() {
    var doc = self.i.document();

    //
    // No doc.open, the iframe has already been destroyed!
    //
    if (!doc.open || !self.i) return;

    //
    // We need to open and close the iframe in order for it to trigger an onload
    // event. Certain scripts might require in order to execute properly.
    //
    doc.open();

    doc.write([
      '<!doctype html>',
      '<html><head>',
      //
      // iFrames can generate pointless requests by searching for a favicon.
      // This can add up to three extra requests for a simple iframe. To battle
      // this, we need to supply an empty icon.
      //
      // @see http://stackoverflow.com/questions/1321878/how-to-prevent-favicon-ico-requests
      //
      '<link rel="icon" href="data:;base64,=">',
      '</head><body>'
    ].join('\n'));

    //
    // Introduce our messaging variable, this needs to be done before we eval
    // our code. If we set this value before the setTimeout, it doesn't work in
    // Opera due to reasons.
    //
    self.i.window()[self.id] = onmessage;
    self.eval(self.image.toString(), function evil(err) {
      if (err) return self.onmessage({
        type: 'error',
        scope: 'iframe.eval',
        args: [ err ]
      });
    });

    //
    // If executing the code results to an error we could actually be stopping
    // and removing the iframe from the source before we're able to close it.
    // This is because executing the code inside the iframe is actually an sync
    // operation.
    //
    if (doc.close) doc.close();
  }, 0);

  //
  // We can only write to the iframe if it's actually in the DOM. The `i.add()`
  // method ensures that the iframe is added to the DOM.
  //
  this.i.add();
  this.started = +new Date();

  return this;
};

/**
 * Stop running the code inside the container.
 *
 * @returns {Container}
 * @api private
 */
Container.prototype.stop = function stop() {
  if (this.readyState !== Container.CLOSED && this.readyState !== Container.CLOSING) {
    this.readyState = Container.CLOSING;
  }

  this.i.remove();

  //
  // Opera doesn't support unload events. So adding an listener inside the
  // iframe for `unload` doesn't work. This is the only way around it.
  //
  this.onmessage({ type: 'unload' });

  //
  // It's super important that this removed AFTER we've cleaned up all other
  // references as we might need to communicate back to our container when we
  // are unloading or when an `unload` event causes an error.
  //
  this.i.window()[this.id] = null;

  //
  // Clear the timeouts.
  //
  for (var timeout in this.setTimeout) {
    clearTimeout(this.setTimeout[timeout]);
    delete this.setTimeout[timeout];
  }

  return this;
};

/**
 * Load the given code as image on to the container.
 *
 * @param {String} code The code that should run on the container.
 * @returns {Container}
 * @api public
 */
Container.prototype.load = function load(code) {
  this.image = new BaseImage(this.id, code);

  return this;
};

/**
 * Completely destroy the given container and ensure that all references are
 * nuked so we can clean up as much memory as possible.
 *
 * @returns {Container}
 * @api private
 */
Container.prototype.destroy = function destroy() {
  if (!this.i) return this;
  this.stop();

  //
  // Remove all possible references to release as much memory as possible.
  //
  this.mount = this.image = this.id = this.i = this.created = null;
  this.console.length = 0;

  this.removeAllListeners();

  return this;
};

//
// Expose the module.
//
module.exports = Container;

},{"alcatraz":9,"eventemitter3":10,"frames":11}],9:[function(_dereq_,module,exports){
'use strict';

/**
 * Alcatraz is our source code sandboxing.
 *
 * @constructor
 * @param {String} method The global/method name that processes messages.
 * @param {String} source The actual code.
 * @param {String} domain The domain name.
 * @api private
 */
function Alcatraz(method, source, domain) {
  if (!(this instanceof Alcatraz)) return new Alcatraz(method, source);

  this.domain = domain || ('undefined' !== typeof document ? document.domain : '');
  this.method = 'if ('+method+') '+ method;
  this.source = source;
  this.compiled = null;
}

/**
 * Assume that the source of the Alcatraz is loaded using toString() so it will be
 * automatically transformed when the Alcatraz instance is concatenated or added to
 * the DOM.
 *
 * @returns {String}
 * @api public
 */
Alcatraz.prototype.toString = function toString() {
  if (this.compiled) return this.compiled;

  return this.compiled = this.transform();
};

/**
 * Apply source code transformations to the code so it can work inside an
 * iframe.
 *
 * @TODO allow custom code transformations.
 * @returns {String}
 * @api private
 */
Alcatraz.prototype.transform = function transform() {
  var code = ('('+ (function alcatraz(global) {
    //
    // When you toString a function which is created while in strict mode,
    // firefox will add "use strict"; to the body of the function. Chrome leaves
    // the source intact. Knowing this, we cannot blindly assume that we can
    // inject code after the first opening bracked `{`.
    //
    this.alcatraz();

    /**
     * Simple helper function to do nothing.
     *
     * @type {Function}
     * @api private
     */
    function noop() { /* I do nothing useful */ }

    /**
     * AddListener polyfill
     *
     * @param {Mixed} thing What ever we want to listen on.
     * @param {String} evt The event we're listening for.
     * @param {Function} fn The function that gets executed.
     * @api private
     */
    function on(thing, evt, fn) {
      if (thing.attachEvent) {
        thing.attachEvent('on'+ evt, fn);
      } else if (thing.addEventListener) {
        thing.addEventListener(evt, fn, false);
      } else {
        thing['on'+ evt] = fn;
      }

      return { on: on };
    }

    //
    // Force the same domain as our 'root' script.
    //
    try { if ('_alcatraz_domain_') document.domain = '_alcatraz_domain_'; }
    catch (e) { /* FireFox 26 throws an Security error for this as we use eval */ }

    //
    // Prevent common iframe detection scripts that do frame busting.
    //
    try { global.top = global.self = global.parent = global; }
    catch (e) { /* Damn, read-only */ }

    //
    // Add a error listener. Adding it on the iframe it self doesn't make it
    // bubble up to the container. So in order to capture errors and notifying
    // the container we need to add a `window.onerror` listener inside the
    // iframe it self.
    // @TODO add proper stack trace tool here?
    //
    global.onerror = function onerror() {
      var a = Array.prototype.slice.call(arguments, 0);
      this._alcatraz_method_({ type: 'error', scope: 'window.onerror', args: a });
      return true;
    };

    //
    // Eliminate the browsers blocking dialogs, we're in a iframe not a browser.
    //
    var blocking = ['alert', 'prompt', 'confirm', 'print', 'open'];
    for (var i = 0; i < blocking.length; i++) {
      try { global[blocking[i]] = noop; }
      catch (e) {}
    }

    //
    // Override the build-in console.log so we can transport the logging messages to
    // the actual page.
    //
    // @see https://github.com/DeveloperToolsWG/console-object/blob/master/api.md
    // for the minimum supported console.* methods.
    //
    var methods = [
        'debug', 'error', 'info', 'log', 'warn', 'dir', 'dirxml', 'table', 'trace'
      , 'assert', 'count', 'markTimeline', 'profile', 'profileEnd', 'time'
      , 'timeEnd', 'timeStamp', 'timeline', 'timelineEnd', 'group'
      , 'groupCollapsed', 'groupEnd', 'clear', 'select', 'exception'
      , 'isIndependentlyComposed'
    ], fconsole = typeof console !== 'undefined' ? console : {};
    global.console = {};

    /**
     * Helper method to polyfill our global console method so we can proxy it's
     * usage to the
     *
     * @param {String} method The console method we want to polyfill.
     * @api private
     */
    function polyconsole(method) {
      var attach = { debug: 1, error: 1, log: 1, warn: 1 };

      //
      // Ensure that this host environment always has working console.
      //
      global.console[method] = function polyfilled() {
        var args = Array.prototype.slice.call(arguments, 0);

        //
        // If the host supports this given method natively, execute it.
        //
        if (method in fconsole) fconsole[method].apply(fconsole, args);

        //
        // Proxy messages to the container.
        //
        this._alcatraz_method_({
          attach: method in attach,
          type: 'console',
          scope: method,
          args: args
        });
      };
    }

    for (i = 0; i < methods.length; i++) {
      polyconsole(methods[i]);
    }

    //
    // The setInterval allows us to detect if the iframe is still running of if
    // it has crashed or maybe it's just freezing up. We will be missing pings
    // or get extremely slow responses. Browsers will kill long running scripts
    // after 5 seconds of freezing:
    //
    // http://www.nczonline.net/blog/2009/01/05/what-determines-that-a-script-is-long-running/
    //
    setInterval(function ping() {
      this._alcatraz_method_({ type: 'ping' });
    }, 1000);

    //
    // Add load listeners so we know when the iframe is alive and working.
    //
    on(global, 'load', function () {
      this._alcatraz_method_({ type: 'load' });
    });

    //
    // Ideally we load this code after our `load` event so we know that our own
    // bootstrapping has been loaded completely. But the problem is that we
    // actually cause full browser crashes in chrome when we execute this.
    //
    var self = this;
    setTimeout(function timeout() {
      try { self.alcatraz(); }
      catch (e) {
        this._alcatraz_method_({ type: 'error', scope: 'iframe.start', args: [e] });
      }
    }, 0);
  })+').call({}, this)');

  //
  // Replace our "template tags" with the actual content.
  //
  return code
    .replace(/_alcatraz_domain_/g, this.domain)
    .replace(/this\._alcatraz_method_/g, this.method)
    .replace(/this\.alcatraz\(\);/g, 'this.alcatraz=function alcatraz() {'+ this.source +'};');
};

//
// Expose module.
//
module.exports = Alcatraz;

},{}],10:[function(_dereq_,module,exports){
'use strict';

/**
 * Minimal EventEmitter interface that is molded against the Node.js
 * EventEmitter interface.
 *
 * @constructor
 * @api public
 */
function EventEmitter() {
  this._events = {};
}

/**
 * Return a list of assigned event listeners.
 *
 * @param {String} event The events that should be listed.
 * @returns {Array}
 * @api public
 */
EventEmitter.prototype.listeners = function listeners(event) {
  return Array.apply(this, this._events[event] || []);
};

/**
 * Emit an event to all registered event listeners.
 *
 * @param {String} event The name of the event.
 * @returns {Boolean} Indication if we've emitted an event.
 * @api public
 */
EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
  if (!this._events || !this._events[event]) return false;

  var listeners = this._events[event]
    , length = listeners.length
    , handler = listeners[0]
    , len = arguments.length
    , args
    , i;

  if (1 === length) {
    switch (len) {
      case 1:
        handler.call(this);
      break;
      case 2:
        handler.call(this, a1);
      break;
      case 3:
        handler.call(this, a1, a2);
      break;
      case 4:
        handler.call(this, a1, a2, a3);
      break;
      case 5:
        handler.call(this, a1, a2, a3, a4);
      break;
      case 6:
        handler.call(this, a1, a2, a3, a4, a5);
      break;

      default:
        for (i = 1, args = new Array(len -1); i < len; i++) {
          args[i - 1] = arguments[i];
        }

        handler.apply(this, args);
    }

    if (handler.once) this.removeListener(event, handler);
  } else {
    for (i = 1, args = new Array(len -1); i < len; i++) {
      args[i - 1] = arguments[i];
    }

    for (i = 0; i < length; i++) {
      listeners[i].apply(this, args);
      if (listeners[i].once) this.removeListener(event, handler[i]);
    }
  }

  return true;
};

/**
 * Register a new EventListener for the given event.
 *
 * @param {String} event Name of the event.
 * @param {Functon} fn Callback function.
 * @api public
 */
EventEmitter.prototype.on = function on(event, fn) {
  if (!this._events) this._events = {};
  if (!this._events[event]) this._events[event] = [];
  this._events[event].push(fn);

  return this;
};

/**
 * Add an EventListener that's only called once.
 *
 * @param {String} event Name of the event.
 * @param {Function} fn Callback function.
 * @api public
 */
EventEmitter.prototype.once = function once(event, fn) {
  fn.once = true;
  return this.on(event, fn);
};

/**
 * Remove event listeners.
 *
 * @param {String} event The event we want to remove.
 * @param {Function} fn The listener that we need to find.
 * @api public
 */
EventEmitter.prototype.removeListener = function removeListener(event, fn) {
  if (!this._events || !this._events[event]) return this;

  var listeners = this._events[event]
    , events = [];

  for (var i = 0, length = listeners.length; i < length; i++) {
    if (fn && listeners[i] !== fn && listeners[i].fn !== fn) {
      events.push(listeners[i]);
    }
  }

  //
  // Reset the array, or remove it completely if we have no more listeners.
  //
  if (events.length) this._events[event] = events;
  else this._events[event] = null;

  return this;
};

/**
 * Remove all listeners or only the listeners for the specified event.
 *
 * @param {String} event The event want to remove all listeners for.
 * @api public
 */
EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
  if (!this._events) return this;

  if (event) this._events[event] = null;
  else this._events = {};

  return this;
};

//
// Alias methods names because people roll like that.
//
EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
EventEmitter.prototype.addListener = EventEmitter.prototype.on;

//
// This function doesn't apply anymore.
//
EventEmitter.prototype.setMaxListeners = function setMaxListeners() {
  return this;
};

//
// Expose the module.
//
EventEmitter.EventEmitter = EventEmitter;
EventEmitter.EventEmitter2 = EventEmitter;
EventEmitter.EventEmitter3 = EventEmitter;

try { module.exports = EventEmitter; }
catch (e) {}

},{}],11:[function(_dereq_,module,exports){
'use strict';

/**
 * Create a new pre-configured iframe.
 *
 * Options:
 *
 * visible: (boolean) Don't hide the iframe by default.
 * sandbox: (array) Sandbox properties.
 *
 * @param {Element} el DOM element where the iframe should be added on.
 * @param {String} id A unique name/id for the iframe.
 * @param {String} options Options.
 * @return {Object}
 * @api private
 */
module.exports = function iframe(el, id, options) {
  var i;

  options = options || {};
  options.sandbox = options.sandbox || [
    'allow-pointer-lock',
    'allow-same-origin',
    'allow-scripts',
    'allow-popups',
    'allow-forms'
  ];

  try {
    //
    // Internet Explorer 6/7 require a unique name attribute in order to work.
    // In addition to that, dynamic name attributes cannot be added using
    // `i.name` as it will just ignore it. Creating it using this oddly <iframe>
    // element fixes these issues.
    //
    i = document.createElement('<iframe name="'+ id +'">');
  } catch (e) {
    i = document.createElement('iframe');
    i.name = id;
  }

  //
  // The iframe needs to be added in to the DOM before we can modify it, make
  // sure it's remains unseen.
  //
  if (!options.visible) {
    i.style.top = i.style.left = -10000;
    i.style.position = 'absolute';
    i.style.display = 'none';
  }

  i.setAttribute('frameBorder', 0);

  if (options.sandbox.length) {
    i.setAttribute('sandbox', (options.sandbox).join(' '));
  }

  i.id = id;

  return {
    /**
     * Return the document which we can use to inject or modify the HTML.
     *
     * @returns {Document}
     * @api public
     */
    document: function doc() {
      return this.window().document;
    },

    /**
     * Return the global or the window from the iframe.
     *
     * @returns {Window}
     * @api public
     */
    window: function win() {
      return i.contentWindow || (i.contentDocument
        ? i.contentDocument.parentWindow || {}
        : {}
      );
    },

    /**
     * Add the iframe to the DOM, use insertBefore first child to avoid
     * `Operation Aborted` error in IE6.
     *
     * @api public
     */
    add: function add() {
      if (!this.attached()) {
        el.insertBefore(i, el.firstChild);
      }

      return this;
    },

    /**
     * Remove the iframe from the DOM.
     *
     * @api public
     */
    remove: function remove() {
      if (this.attached()) {
        el.removeChild(i);
      }

      return this;
    },

    /**
     * Checks if the iframe is currently attached to the DOM.
     *
     * @returns {Boolean} The container is attached to the mount point.
     * @api private
     */
    attached: function attached() {
      return !!document.getElementById(id);
    },

    /**
     * Reference to the iframe element.
     *
     * @type {HTMLIFRAMEElement}
     * @public
     */
    frame: i
  };
};

},{}],12:[function(_dereq_,module,exports){
'use strict';
/**
 * Cache the hasOwnProperty method.
 *
 * @type {Function}
 * @private
 */
var hasOwn = Object.prototype.hasOwnProperty;

/**
 * Detect various of bugs in browsers.
 *
 * @type {Object}
 * @api private
 */
var supports = (function supports() {
  var tests = {}
    , doc = document
    , div = doc.createElement('div')
    , select = doc.createElement('select')
    , input = doc.createElement('input')
    , option = select.appendChild(doc.createElement('option'))
    , documentElement = doc && (doc.ownerDocument || doc).documentElement;

  //
  // Older versions of WebKit return '' instead of 'on' for checked boxes that
  // have no value specified.
  //
  input.type = 'checkbox';
  tests.on = input.value !== '';

  //
  // Make sure that options inside a disabled select are not disabled. Which is
  // the case for WebKit.
  //
  select.disabled = true;
  tests.disabled = !option.disabled;

  //
  // Verify that getAttribute really returns attributes and not properties.
  //
  div.className = 'i';
  tests.attributes = !div.getAttribute('className');

  tests.xml = documentElement ? documentElement.nodeName !== "HTML" : false;
  tests.html = !tests.xml;

  return tests;
}());

/**
 * Get the text or inner text from a given element.
 *
 * @param {Element} element
 * @returns {String} text
 * @api public
 */
function text(element) {
  var type = element.nodeType
    , value = '';

  if (1 === type || 9 === type || 11 === type) {
    //
    // Use `textContent` instead of `innerText` as it's inconsistent with new
    // lines.
    //
    if ('string' === typeof element.textContent) return element.textContent;

    for (element = element.firstChild; element; element = element.nextSibling) {
      value += text(element);
    }
  }

  return 3 === type || 4 === type
  ? element.nodeValue
  : value;
}

/**
 * Trim a given string.
 *
 * @param {String} value
 * @returns {String}
 * @api public
 */
function trim(value) {
  return ((value || '') +'').replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
}

/**
 *
 *
 * @param {Element} element
 * @returns {String} The `.value` of the element.
 * @api private
 */
function attribute(element, name, val) {
  return supports.attributes || !supports.html
  ? element.getAttribute(name)
  : (val = element.getAttributeNode(name)) && val.specified ? val.value : '';
}

/**
 * Get the value from a given element.
 *
 * @param {Element} element The HTML element we need to extract the value from.
 * @returns {Mixed} The value of the element.
 * @api public
 */
function get(element) {
  var name = element.nodeName.toLowerCase()
    , value;

  if (get.parser[element.type] && hasOwn.call(get.parser, element.type)) {
    value = get.parser[element.type](element);
  } else if (get.parser[name] && hasOwn.call(get.parser, name)) {
    value = get.parser[name](element);
  }

  if (value !== undefined) return value;

  value = element.value;

  return 'string' === typeof value
  ? value.replace(/\r/g, '')
  : value === null ? '' : value;
}

/**
 * Dedicated value parsers to combat all the edge cases.
 *
 * @type {Object}
 * @private
 */
get.parser = {
  option: function option(element) {
    var value = attribute(element, 'value');

    return value === null
    ? trim(text(element))
    : value;
  },

  select: function select(element) {
    var values = []
      , options = element.options
      , index = element.selectedIndex
      , one = element.type === 'select-one' || index < 0;

    for (
      var length = one ? index + 1 : options.length
          , i = index < 0 ? length : one ? index : 0;
      i < length;
      i++
    ) {
      var opt = options[i]
        , value;

      //
      // IE 6-9 doesn't update the selected after a form reset. And don't return
      // options that are disabled or have an disabled option group.
      //
      if (
           (opt.selected || index === i)
        && (
           !supports.disabled
           ? opt.getAttribute('disabled') === null
           : !opt.disabled
        )
        && (
           !opt.parentNode.disabled
        || (opt.parentNode.nodeName || '').toLowerCase() !== 'optgroup'
        )
      ) {
        value = get(opt);
        if (one) return value;

        values.push(value);
      }
    }

    return values;
  }
};

//
// Parsers that require feature detection in order to work:
//
if (!supports.on) {
  get.parser.radio = get.parser.checkbox = function input(element) {
    return element.getAttribute('value') !== null
    ? element.value
    : 'on';
  };
}

//
// Expose the methods.
//
get.trim = trim;
get.text = text;

module.exports = get;

},{}],13:[function(_dereq_,module,exports){
/*globals */
'use strict';

var EventEmitter = _dereq_('eventemitter3')
  , collection = _dereq_('./collection')
  , AsyncAsset = _dereq_('async-asset')
  , Fortress = _dereq_('fortress')
  , async = _dereq_('./async')
  , val = _dereq_('parsifal')
  , undefined
  , sandbox;

//
// Async Asset loader.
//
var assets = new AsyncAsset();

/**
 * Representation of a single pagelet.
 *
 * @constructor
 * @param {Pipe} pipe The pipe.
 * @api public
 */
function Pagelet(pipe) {
  EventEmitter.call(this);

  this.orchestrate = pipe.orchestrate;
  this.stream = pipe.stream;
  this.pipe = pipe;

  //
  // Create one single Fortress instance that orchestrates all iframe based client
  // code. This sandbox variable should never be exposed to the outside world in
  // order to prevent leaking.
  //
  this.sandbox = sandbox = sandbox || new Fortress();
}

//
// Inherit from EventEmitter.
//
Pagelet.prototype = new EventEmitter();
Pagelet.prototype.constructor = Pagelet;

/**
 * Configure the Pagelet.
 *
 * @param {String} name The given name of the pagelet.
 * @param {Object} data The data of the pagelet.
 * @param {Array} roots HTML root elements search for targets.
 * @api private
 */
Pagelet.prototype.configure = function configure(name, data, roots) {
  var pipe = this.pipe
    , pagelet = this;

  //
  // Pagelet identification.
  //
  this.id = data.id;                        // ID of the pagelet.
  this.name = name;                         // Name of the pagelet.
  this.css = collection.array(data.css);    // CSS for the Page.
  this.js = collection.array(data.js);      // Dependencies for the page.
  this.run = data.run;                      // Pagelet client code.
  this.rpc = data.rpc;                      // Pagelet RPC methods.
  this.data = data.data;                    // All the template data.
  this.mode = data.mode;                    // Fragment rendering mode.
  this.streaming = !!data.streaming;        // Are we streaming POST/GET.
  this.container = this.sandbox.create();   // Create an application sandbox.
  this.timeout = data.timeout || 25 * 1000; // Resource loading timeout.
  this.hash = data.hash;                    // Hash of the template.

  //
  // This pagelet was actually part of a parent pagelet, so set a reference to
  // the parent pagelet that was loaded.
  //
  this.parent = data.parent ? pipe.get(data.parent) : undefined;

  //
  // Locate all the placeholders for this given pagelet.
  //
  this.placeholders = this.$('data-pagelet', name, roots);

  //
  // The pagelet as we've been given the remove flag.
  //
  if (data.remove) {
    return this.destroy(true);
  }

  //
  // Attach event listeners for FORM posts so we can intercept those.
  //
  this.listen();

  //
  // Create a real-time Substream over which we can communicate over without.
  //
  this.substream = this.stream.substream(this.name);
  this.substream.on('data', function data(packet) {
    pagelet.processor(packet);
  });

  //
  // Register the pagelet with the BigPipe server as an indication that we've
  // been fully loaded and ready for action.
  //
  this.orchestrate.write({ type: 'pagelet', name: name, id: this.id });

  //
  // Generate the RPC methods that we're given by the server. We will make the
  // assumption that:
  //
  // - A callback function is always given as last argument.
  // - The function should return it self in order to chain.
  // - The function given supports and uses error first callback styles.
  // - Does not override the build-in prototypes of the Pagelet.
  //
  collection.each(this.rpc, function rpc(method) {
    var counter = 0;

    //
    // Never override build-in methods as this WILL affect the way a Pagelet is
    // working.
    //
    if (method in Pagelet.prototype) return;

    pagelet[method] = function rpcfactory() {
      var args = Array.prototype.slice.call(arguments, 0)
        , id = method +'#'+ (++counter);

      pagelet.once('rpc:'+ id, args.pop());
      pagelet.substream.write({ method: method, type: 'rpc', args: args, id: id });

      return pagelet;
    };
  });

  //
  // Should be called before we create `rpc` hooks.
  //
  this.broadcast('configured', data);

  async.each(this.css.concat(this.js), function download(url, next) {
    assets.add(url, next);
  }, function done(err) {
    if (err) return pagelet.broadcast('error', err);

    pagelet.broadcast('loaded');

    pagelet.render(pagelet.parse());
    pagelet.initialize();
  }, { context: this.pipe, timeout: this.timeout });
};

/**
 * Get the template for a given type. We currently only support `client` and
 * `error` as types.
 *
 * @param {String} type Template type
 * @returns {Function}
 * @api private
 */
Pagelet.prototype.template = function template(type) {
  type = type || 'client';

  return this.pipe.templates[this.hash[type]];
};

/**
 * Get a pagelet loaded on the page. If we have
 *
 * @param {String} name Name of the pagelet we need.
 * @returns {Pagelet|Undefined}
 */
Pagelet.prototype.pagelet = function pagelet(name) {
  return this.pipe.get(name, this.name);
};

/**
 * Intercept form posts and stream them over our substream instead to prevent
 * full page reload.
 *
 * @returns {Pagelet}
 * @api private
 */
Pagelet.prototype.listen = function listen() {
  var pagelet = this;

  /**
   * Handles the actual form submission.
   *
   * @param {Event} evt The submit event.
   * @api private
   */
  function submission(evt) {
    evt = evt || window.event;
    var form = evt.target || evt.srcElement;

    //
    // In previous versions we had and `evt.preventDefault()` so we could make
    // changes to the form and re-submit it. But there's a big problem with that
    // and that is that in FireFox it loses the reference to the button that
    // triggered the submit. If causes buttons that had a name and value:
    //
    // ```html
    // <button name="key" value="value" type="submit">submit</button>
    // ```
    //
    // To be missing from the POST or GET. We managed to go around it by not
    // simply preventing the default action. If this still does not not work we
    // need to transform the form URLs once the pagelets are loaded.
    //
    if (
         ('getAttribute' in form && form.getAttribute('data-pagelet-async') === 'false')
      || !pagelet.streaming
    ) {
      var action = form.getAttribute('action');
      return form.setAttribute('action', [
        action,
        ~action.indexOf('?') ? '&' : '?',
        '_pagelet=',
        pagelet.name
      ].join(''));
    }

    //
    // As we're submitting the form over our real-time connection and gather the
    // data our self we can safely prevent default.
    //
    evt.preventDefault();
    pagelet.submit(form);
  }

  collection.each(this.placeholders, function each(root) {
    root.addEventListener('submit', submission, false);
  });

  //
  // When the pagelet is removed we want to remove our listeners again. To
  // prevent memory leaks as well possible duplicate listeners when a pagelet is
  // loaded in the same placeholder (in case of a full reload).
  //
  return this.once('destroy', function destroy() {
    collection.each(pagelet.placeholders, function each(root) {
      root.removeEventListener('submit', submission, false);
    });
  });
};

/**
 * Submit the contents of a <form> to the server.
 *
 * @param {FormElement} form Form that needs to be submitted.
 * @returns {Object} The data that is ported to the server.
 * @api public
 */
Pagelet.prototype.submit = function submit(form) {
  var active = document.activeElement
    , elements = form.elements
    , data = {}
    , element
    , i;

  if (active && active.name) {
    data[active.name] = active.value;
  } else {
    active = false;
  }

  for (i = 0; i < elements.length; i++) {
    element = elements[i];

    //
    // Story time children! Once upon a time there was a developer, this
    // developer created a form with a lot of submit buttons. The developer
    // knew that when a user clicked on one of those buttons the value="" and
    // name="" attributes would get send to the server so he could see which
    // button people had clicked. He implemented this and all was good. Until
    // someone captured the `submit` event in the browser which didn't have
    // a reference to the clicked element. This someone found out that the
    // `document.activeElement` pointed to the last clicked element and used
    // that to restore the same functionality and the day was saved again.
    //
    // There are valuable lessons to be learned here. Submit buttons are the
    // suck. PERIOD.
    //
    if (
         element.name
      && !(element.name in data)
      && element.disabled === false
      && /^(?:input|select|textarea|keygen)/i.test(element.nodeName)
      && !/^(?:submit|button|image|reset|file)$/i.test(element.type)
      && (element.checked || !/^(?:checkbox|radio)$/i.test(element.type))
    ) data[element.name] = val(element);
  }

  //
  // Now that we have a JSON object, we can just send it over our real-time
  // connection and wait for a page refresh.
  //
  this.substream.write({
    type: (form.method || 'GET').toLowerCase(),
    body: data
  });

  return data;
};

/**
 * Get the pagelet contents once again.
 *
 * @returns {Pagelet}
 * @api public
 */
Pagelet.prototype.get = function get() {
  this.substream.write({ type: 'get' });

  return this;
};

/**
 * Process the incoming messages from our SubStream.
 *
 * @param {Object} packet The decoded message.
 * @returns {Boolean}
 * @api private
 */
Pagelet.prototype.processor = function processor(packet) {
  if ('object' !== typeof packet) return false;

  switch (packet.type) {
    case 'rpc':
      EventEmitter.prototype.emit.apply(this, ['rpc:'+ packet.id].concat(packet.args || []));
    break;

    case 'event':
      if (packet.args && packet.args.length) {
        EventEmitter.prototype.emit.apply(this, packet.args);
      }
    break;

    case 'fragment':
      this.render(packet.frag.view);
    break;

    case 'redirect':
      window.location.href = packet.url;
    break;

    default:
    return false;
  }

  return true;
};

/**
 * The Pagelet's resource has all been loaded.
 *
 * @api private
 */
Pagelet.prototype.initialize = function initialise() {
  this.broadcast('initialize');

  //
  // Only load the client code in a sandbox when it exists. There no point in
  // spinning up a sandbox if it does nothing
  //
  if (!this.code) return;
  this.sandbox(this.prepare(this.code));
};

/**
 * Emit events on the server side Pagelet instance.
 *
 * @param {String} event
 */
Pagelet.prototype.emit = function emit(event) {
  this.substream.write({
    args: Array.prototype.slice.call(arguments, 0),
    type: 'emit'
  });

  return true;
};

/**
 * Broadcast an event that will be emitted on the pagelet and the page.
 *
 * @param {String} event The name of the event we should emit
 * @returns {Pagelet}
 * @api public
 */
Pagelet.prototype.broadcast = function broadcast(event) {
  EventEmitter.prototype.emit.apply(this, arguments);

  var name = this.name +':'+ event;

  if (this.parent) {
    name = this.parent.name +':'+ name;
  }

  this.pipe.emit.apply(this.pipe, [
    name,
    this
  ].concat(Array.prototype.slice.call(arguments, 1)));

  return this;
};

/**
 * Find the element based on the attribute and value.
 *
 * @param {String} attribute The name of the attribute we're searching.
 * @param {String} value The value that the attribute should equal to.
 * @param {Array} root Optional array of root elements.
 * @returns {Array} A list of HTML elements that match.
 * @api public
 */
Pagelet.prototype.$ = function $(attribute, value, roots) {
  var elements = [];

  collection.each(roots || [document], function each(root) {
    if ('querySelectorAll' in root) return Array.prototype.push.apply(
      elements,
      root.querySelectorAll('['+ attribute +'="'+ value +'"]')
    );

    //
    // No querySelectorAll support, so we're going to do a full DOM scan in
    // order to search for attributes.
    //
    for (var all = root.getElementsByTagName('*'), i = 0, l = all.length; i < l; i++) {
      if (value === all[i].getAttribute(attribute)) {
        elements.push(all[i]);
      }
    }
  });

  return elements;
};

/**
 * Invoke the correct render method for the pagelet.
 *
 * @param {String|Object} html The HTML or data that needs to be rendered.
 * @returns {Boolean} Successfully rendered a pagelet.
 * @api public
 */
Pagelet.prototype.render = function render(html) {
  if (!this.placeholders.length) return false;

  var mode = this.mode in this ? this[this.mode] : this.html
    , template = this.template('client');

  //
  // We have been given an object instead of pure HTML so we are going to make
  // the assumption that this is data for the client side template and render
  // that our selfs. If no HTML is supplied we're going to use the data that has
  // been send to the client
  //
  if (
       'function' === collection.type(template)
    && (
      'object' === collection.type(html)
      || undefined === html && 'object' === collection.type(this.data)
      || html instanceof Error
    )) {
    try {
      if (html instanceof Error) throw html; // So it's captured an processed as error
      html = template(collection.copy(html || {}, this.data || {}));
    }
    catch (e) {
      html = this.template('error')(collection.copy(html || {}, this.data || {}, {
        reason: 'Failed to render: '+ this.name,
        message: e.message,
        stack: e.stack,
        error: e
      }));
    }
  }

  //
  // Failed to get any HTML
  //
  if (!html) return false;

  collection.each(this.placeholders, function each(root) {
    mode.call(this, root, html);
  }, this);

  this.pipe.rendered.push(this.name);
  this.broadcast('render', html);
  return true;
};

/**
 * Render the fragment as HTML (default).
 *
 * @param {Element} root Container.
 * @param {String} content Fragment content.
 * @api public
 */
Pagelet.prototype.html = function html(root, content) {
  this.createElements(root, content);
};

/**
 * Render the fragment as SVG.
 *
 * @param {Element} root Container.
 * @param {String} content Fragment content.
 * @api public
 */
Pagelet.prototype.svg = function svg(root, content) {
  this.createElements(root, content);
};

/**
 * Get the element namespaceURI description based on mode.
 *
 * @param {String} mode Mode the pagelet will be rendered in.
 * @return {String} Element namespace.
 */
Pagelet.prototype.getElementNS = function getElementNS(mode) {
  mode = mode.toLowerCase();

  switch(mode) {
    case 'svg': return 'http://www.w3.org/2000/svg';
    default: return 'http://www.w3.org/1999/xhtml';
  }
};

/**
 * Create elements by namespace and via a document fragment.
 *
 * @param {Element} root Container.
 * @param {String} content Fragment content.
 * @api private
 */
Pagelet.prototype.createElements = function createElements(root, content) {
  var fragment = document.createDocumentFragment()
    , div = document.createElementNS(this.getElementNS(this.mode), 'div')
    , borked = this.pipe.IEV < 7;

  //
  // Clean out old HTML before we append our new HTML or we will get duplicate
  // DOM. Or there might have been a loading placeholder in place that needs
  // to be removed.
  //
  while (root.firstChild) {
    root.removeChild(root.firstChild);
  }

  if (borked) root.appendChild(div);

  div.innerHTML = content;

  while (div.firstChild) {
    fragment.appendChild(div.firstChild);
  }

  root.appendChild(fragment);
  if (borked) root.removeChild(div);
};

/**
 * Parse the included template from the comment node so it can be injected in to
 * the page as initial rendered view.
 *
 * @returns {String} View.
 * @api private
 */
Pagelet.prototype.parse = function parse() {
  var node = this.$('data-pagelet-fragment', this.name)[0]
    , comment;

  //
  // The firstChild of the fragment should have been a HTML comment, this is to
  // prevent the browser from rendering and parsing the template.
  //
  if (!node.firstChild || node.firstChild.nodeType !== 8) return;

  comment = node.firstChild.nodeValue;

  return comment
    .substring(1, comment.length -1)
    .replace(/\\([\s\S]|$)/g, '$1');
};

/**
 * Destroy the pagelet and clean up all references so it can be re-used again in
 * the future.
 *
 * @TODO unload CSS.
 * @TODO unload JavaScript.
 *
 * @param {Boolean} remove Remove the placeholder as well.
 * @api public
 */
Pagelet.prototype.destroy = function destroy(remove) {
  var pagelet = this;

  //
  // Execute any extra destroy hooks. This needs to be done before we remove any
  // elements or destroy anything as there might people subscribed to these
  // events.
  //
  this.broadcast('destroy');

  //
  // Remove all the HTML from the placeholders.
  //
  if (this.placeholders) collection.each(this.placeholders, function remove(root) {
    if (remove && root.parentNode) root.parentNode.removeChild(root);
    else while (root.firstChild) root.removeChild(root.firstChild);
  });

  //
  // Remove the added RPC handlers, make sure we don't delete prototypes.
  //
  if (this.rpc && this.rpc.length) collection.each(this.rpc, function nuke(method) {
    if (method in Pagelet.prototype) return;
    delete pagelet[method];
  });

  //
  // Remove the sandboxing.
  //
  if (this.container) sandbox.kill(this.container.id);
  this.placeholders = this.container = null;

  //
  // Announce the destruction and remove it.
  //
  if (this.substream) this.substream.end();

  //
  // Everything has been cleaned up, release it to our Freelist Pagelet pool.
  //
  this.pipe.free(this);

  return this;
};

//
// Expose the module.
//
module.exports = Pagelet;

},{"./async":1,"./collection":2,"async-asset":4,"eventemitter3":6,"fortress":7,"parsifal":12}]},{},[3])
(3)
});