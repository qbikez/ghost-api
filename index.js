'use strict';

/**
 * Dependencies
 */

//var prependHttp = require('prepend-http');
var stringify = require('querystring').stringify;
var Promise = require('pinkie-promise');
var assign = require('object-assign');
var format = require('util').format;
var got = require('got');

var json = JSON.stringify;


function prependHttp (url, secure) {
	if (typeof url !== 'string') {
		throw new TypeError('Expected a string');
	}

	url = url.trim();

	if (/^\.*\//.test(url)) {
		return url;
	}
    if (/^localhost/.test(url)) {
        secure = false;
    }
	return url.replace(/^(?!(?:\w+:)?\/\/)/, secure ? 'https://' : 'http://');
};


/**
 * Expose `ghost-api`
 */

module.exports = Client;


/**
 * Unofficial API client for Ghost blogs
 */

function Client (endpoint) {
  if (!(this instanceof Client)) return new Client(endpoint);

  this.endpoint = prependHttp(endpoint, true) + '/ghost/api/v0.1';

  bindAll(this, ['posts']);
}


/**
 * Overwrite default options and return a new object
 */

Client.prototype.options = function (options) {
  var defaults = {
    headers: {
      'authorization': 'Bearer ' + this.token,
      'content-type': 'application/json'
    }
  };

  return assign({}, defaults, options);
};


/**
 * Authenticate via OAuth
 */

Client.prototype.auth = function (email, password, client_id, client_secret) {
  var url = this.endpoint + '/authentication/token';

  var self = this;
  
  if (!client_id || !client_secret) {
    // TODO: parse host and client secret from repo path 
  // or get ghost-admin client_secret from /ghost meta tags
        client_id = "ghost-admin";
        client_secret = "59a57ba8d150";
  }

  return req(url, {
    method: 'post',
    body: {
      username: email,
      password: password,
      grant_type: 'password',
      client_id: client_id,
      client_secret: client_secret
    }
  }).then(function (res) {
    self.token = JSON.parse(res.body).access_token;

    return self.token;
  });
};


/**
 * Posts API
 */

Client.prototype.posts = {};


/**
 * Find posts with pagination
 *
 * @param {Object} query
 * @return {Array}
 */

Client.prototype.posts.find = function (query) {
  query = assign({}, {
    include: 'tags',
    status: 'all',
    page: 1
  }, query);

  var url = format('%s/posts/?%s', this.endpoint, stringify(query));

  var options = this.options({
    json: true
  });

  return got(url, options).then(function (res) {
    return res.body.posts;
  });
};

/**
 * Find all posts
 *
 * @return {Array}
 */

Client.prototype.posts.all = function () {
  return this.posts.find({
    limit: 'all',
    status: 'all'
  });
};


/**
 * Find one post
 *
 * @param {Number} id
 * @return {Object}
 */

Client.prototype.posts.findOne = function (id, query) {
  var url = this.endpoint;

  if (typeof id === 'string') {
    url += format('/posts/slug/%s/?', id);
  } else {
    url += format('/posts/%s/?', id);
  }

  query = assign({
    status: 'all',
    include: 'tags'
  }, query);

  url += stringify(query);

  var options = this.options({
    json: true
  });

  return got(url, options).then(function (res) {
    return res.body.posts[0];
  });
};


/**
 * Create a new post
 *
 * @param {Object} data
 * @return {Object}
 */

Client.prototype.posts.create = function (data) {
  if (!data) {
    data = {};
  }

  if (!data.title) {
    var err = new Error('Post requires a `title` property');

    return Promise.reject(err);
  }

  var url = this.endpoint + '/posts';

  var options = this.options({
    method: 'post',
    body: json({
      posts: [data]
    })
  });

  return req(url, options).then(function (res) {
    return JSON.parse(res.body).posts[0];
  });
};


/**
 * Update an existing post
 *
 * @param {Number} id
 * @param {Object} data
 * @return {Object}
 */

Client.prototype.posts.update = function (id, data) {
  var url = format('%s/posts/%s', this.endpoint, id);

  var options = this.options({
    method: 'put',
    body: json({
      posts: [data]
    })
  });

  return req(url, options).then(function (res) {
    return JSON.parse(res.body).posts[0];
  });
};


/**
 * Delete a post
 *
 * @param {Number} id
 * @return {Object}
 */

Client.prototype.posts.destroy = function (id) {
  var url = format('%s/posts/%s', this.endpoint, id);

  var options = this.options({
    method: 'delete'
  });

  return req(url, options).then(function (res) {
    return JSON.parse(res.body).posts[0];
  });
};


/**
 * Helpers
 */


/**
 * Wrapper around got to follow redirect on POST/PUT/DELETE requests
 */

function req (url, options) {
  return got(url, options).catch(function (err) {
    var isRedirect = err instanceof got.HTTPError && err.statusCode === 302;

    if (!isRedirect) {
      return Promise.reject(err);
    }

    url = err.response.headers.location;

    return got(url, options);
  });
}


/**
 * Bind all object methods to a context
 */

function bindAll (obj, props) {
  props.forEach(function (prop) {
    var keys = Object.keys(obj[prop]);

    keys.forEach(function (key) {
      obj[prop][key] = obj[prop][key].bind(obj);
    });
  });
}
