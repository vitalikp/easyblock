"use strict";

const Cu = Components.utils;


var EXPORTED_SYMBOLS = ["bldb"];

//import
Cu.import("chrome://easyblock/content/io.jsm");


var blsite =
{
	name: '',
	host: '',

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
		return this.host.test(url) || this.host.test('www.'+url);
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

	add: function(pattern)
	{
		let site;

		if (!pattern || pattern.startsWith('!'))
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
			arr.forEach((line) => { db.add(line); });
		});
	},

	parse: function(uri)
	{
		if (!uri)
			return;

		return uri.replace(/^(http(s)?:\/\/)?(www\.)?/,'');
	},

	hasUrl: function(url)
	{
		let site;
		let i = 0;

		while (i < this.data.length)
		{
			site = this.data[i++];
			if (site.check(url))
				return true;
		}

		return false;
	},

	print: function(doc, elem)
	{
		let label, site;
		let i = 0;

		if (!doc || !elem)
			return;

		while (i < this.data.length)
		{
			site = this.data[i++];

			label = doc.createElement("label");
			label.setAttribute("value", site.name);
			elem.appendChild(label);
		}
	}
};