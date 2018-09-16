"use strict";

const Cu = Components.utils;


var EXPORTED_SYMBOLS = ["bldb"];

// import
Cu.importGlobalProperties(["URL"]);

Cu.import("chrome://easyblock/content/io.jsm");


var blsite =
{
	name: '',
	host: '',
	cnt: 0,

	create: function(host)
	{
		var site;

		site = Object.create(this);
		site.name = host;
		site.host = new RegExp('^' + host, "i");

		return site;
	},

	check: function(url)
	{
		if (!url)
			return false;

		return this.host.test(url.hostname) || this.host.test('www.'+url.hostname);
	},

	block: function(cb, data)
	{
		if (!cb || !data)
			return;

		this.cnt++;
		io.log("Blocking site '" + this.name + "'");

		cb(data);
	}
};

var bldb =
{
	data: [],

	create: function(fn)
	{
		var db;

		db = Object.create(bldb);
		db.load(fn);

		return db;
	},

	close: function()
	{
		this.data = [];
	},

	add: function(pattern)
	{
		let site;

		if (this.data.findIndex((s) => pattern == s.name) >= 0)
			return;

		site = blsite.create(pattern);
		this.data.push(site);
//		io.log('add url "' + pattern + '" to blacklist');
	},

	load: function(fn)
	{
		let db;

		io.log("load blacklist sites from '" + fn + "' file");

		db = this;

		io.loadText(fn, (data) =>
		{
			let arr;

			if (!data)
				return;

			arr = data.split(/\r\n|\n/);
			arr.forEach((line) =>
			{
				if (!line)
					return;

				if (line[0] == '#' || line[0] == '!')
					return;

				db.add(line);
			});
		});
	},

	parse: function(uri)
	{
		let url;

		if (!uri)
			return null;

		url = new URL(uri);
		url.hostname = url.hostname.replace(/^(www\.)?/,'');

		return url;
	},

	find: function(url)
	{
		let site;
		let i = 0;

		if (!url)
			return null;

		while (i < this.data.length)
		{
			site = this.data[i++];
			if (site.check(url))
				return site;
		}

		return null;
	},

	hasUrl: function(url)
	{
		return !this.find(url);
	},

	print: function(doc, elem)
	{
		let label, site, value;
		let i = 0;

		if (!doc || !elem)
			return;

		while (i < this.data.length)
		{
			site = this.data[i++];

			label = doc.createElement("label");
			value = '[' + site.cnt + '] ';
			value += site.name;
			label.setAttribute("value", value);
			elem.appendChild(label);
		}
	}
};