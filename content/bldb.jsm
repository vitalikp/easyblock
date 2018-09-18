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
	query: [],
	cnt: 0,

	create: function(host)
	{
		var site;

		site = Object.create(this);
		site.name = host;
		site.host = new RegExp('^' + host, "i");
		site.query = [];

		return site;
	},

	addQuery: function(line)
	{
		if (!line)
			return;

		line = line.trim();
		line = line.replace('*', '.*');
		if (line[0] != '/')
			line = '.*' + line;
		else
			line += '.*';

		this.query.push(new RegExp('^' + line));
	},

	check: function(url)
	{
		let res, i;

		if (!url)
			return false;

		res = this.host.test(url.hostname) || this.host.test('www.'+url.hostname);
		if (!res)
			return false;

		if (this.query.length == 0)
			return true;

		i = 0;
		while (i < this.query.length)
		{
			if (this.query[i++].test(url.pathname))
				return true;
		}

		return false;
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

	add: function(site)
	{
		if (!site || !site.name)
			return;

		if (this.data.findIndex((s) => site.name == s.name) >= 0)
			return;

		this.data.push(site);
//		io.log('add url "' + site.name + '" to blacklist');
	},

	load: function(fn)
	{
		let db, site;

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

				if (site && (line[0] == '\t' || line[0] == ' ' && line[1] == ' '))
				{
					site.addQuery(line);
					return;
				}

				site = blsite.create(line);
				db.add(site);
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
			value += ' (' + site.query.length + ')';
			label.setAttribute("value", value);
			elem.appendChild(label);
		}
	}
};