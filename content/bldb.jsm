"use strict";

const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;


var EXPORTED_SYMBOLS = ["bldb"];

// import
Cu.importGlobalProperties(["URL"]);

Cu.import("chrome://easyblock/content/io.jsm");


const COMM_PATTERN = "^# (title): ([a-zA-Z0-9]*)$";


var blsite =
{
	name: '',
	host: '',
	query: [],
	type: [],
	cnt: 0,

	create: function(host)
	{
		var site;

		site = Object.create(this);
		site.name = host;
		site.host = new RegExp('^' + host, "i");
		site.query = [];
		site.type = [];

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

	addType: function(line)
	{
		if (!line)
			return;

		line = line.trim();
		line = line.replace('*', '.*');

		this.type.push(new RegExp(line));
	},

	check: function(url, type)
	{
		let res, i;

		if (!url)
			return false;

		res = this.host.test(url.hostname) || this.host.test('www.'+url.hostname);
		if (!res)
			return false;

		if (type && this.type.length > 0)
		{
			i = 0;
			while (i < this.type.length)
			{
				if (this.type[i++].test(type))
					return true;
			}
		}

		if (this.query.length == 0)
			return this.type.length == 0;

		i = 0;
		while (i < this.query.length)
		{
			if (this.query[i++].test(url.pathname))
				return true;
		}

		return false;
	},

	block: function(subject)
	{
		if (!subject)
			return;

		this.cnt++;
		io.log("Blocking site '" + this.name + "'");

		subject.loadFlags = Ci.nsICachingChannel.LOAD_ONLY_FROM_CACHE;
		subject.cancel(Cr.NS_BINDING_ABORTED);
	},

	toString: function()
	{
		let res;

		res = '[' + this.cnt + '] ';
		res += this.name;
		res += ' (' + this.query.length + ')';

		return res;
	}
};

var blgroup =
{
	id: -1,
	name: '',
	data: [],
	enabled: true,

	create: function(name)
	{
		var group;

		group = Object.create(this);
		group.name = name;
		group.data = [];

		return group;
	},

	addSite: function(site)
	{
		if (!site)
			return;

		this.data.push(site);
//		io.log(this.name + ': add url "' + site.name + '"');
	},

	find: function(url, type)
	{
		let site;
		let i = 0;

		if (!this.enabled)
			return null;

		if (!url && !type)
			return null;

		while (i < this.data.length)
		{
			site = this.data[i++];
			if (site.check(url, type))
				return site;
		}

		return null;
	},

	print: function(doc, elem)
	{
		let label, site;
		let i = 0;

		if (!doc || !elem)
			return;

		label = doc.createElement("label");
		label.setAttribute("value", this + ':');
		elem.appendChild(label);

		while (i < this.data.length)
		{
			site = this.data[i++];

			label = doc.createElement("label");
			label.setAttribute("value", site);
			elem.appendChild(label);
		}
	},

	toString: function()
	{
		let res;

		res = this.name;
		res += ' (' + this.data.length + ')';

		return res;
	}
};

var bldb =
{
	commRegEx: '',
	defGroup: null,
	groups: [],

	create: function(fn)
	{
		var db;

		db = Object.create(bldb);
		db.commRegEx = new RegExp(COMM_PATTERN);
		db.load(fn);

		return db;
	},

	close: function()
	{
		this.groups = [];
	},

	add: function(group)
	{
		let id;

		if (!group || !group.name)
			return;

		if (this.groups.findIndex((g) => group.name == g.name) >= 0)
			return;

		id = this.groups.length;

		this.groups.push(group);
		group.id = id;
		if (!id)
			this.defGroup = group;
//		io.log('add group "' + group.name + '" to blacklist');
	},

	load: function(fn, onLoad)
	{
		let db, site, index;

		io.log("load blacklist sites from '" + fn + "' file");

		db = this;

		io.loadText(fn, (data) =>
		{
			let arr, res, group;

			if (!data)
				return;

			group = blgroup.create('Default');
			db.add(group);
			if (!db.defGroup)
				return;

			arr = data.split(/\r\n|\n/);
			arr.forEach((line) =>
			{
				if (!line)
				{
					group = db.defGroup;
					return;
				}

				if (line[0] == '#' || line[0] == '!')
				{
					res = db.commRegEx.exec(line);
					if (!res)
						return;

					switch (res[1])
					{
						case 'title':
							group = blgroup.create(res[2]);
							db.add(group);
							break;
					}
					return;
				}

				if (site && (line[0] == '\t' || line[0] == ' ' && line[1] == ' '))
				{
					index = line.indexOf('type:');
					if (index > 0)
						site.addType(line.substr(index+5));
					else
						site.addQuery(line);
					return;
				}

				site = blsite.create(line);
				group.addSite(site);
			});

			if (onLoad)
				onLoad();
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

	find: function(url, type)
	{
		let group, site;
		let i = 0;

		if (!url && !type)
			return null;

		while (i < this.groups.length)
		{
			group = this.groups[i++];
			site = group.find(url, type);
			if (!site)
				continue;

			if (site.check(url, type))
				return site;
		}

		return null;
	},

	hasUrl: function(url)
	{
		return !this.find(url);
	},

	blockReq: function(subject)
	{
		let url, site;

		if (!subject)
			return;

		subject.QueryInterface(Ci.nsIHttpChannel);

		url = this.parse(subject.URI.spec);
		if (!url)
			return;

		site = this.find(url);
		if (!site)
			return;

		site.block(subject);
	},

	blockResp: function(subject)
	{
		let url, site;
		let type;

		if (!subject)
			return;

		type = subject.contentType;

		subject.QueryInterface(Ci.nsIHttpChannel);

		url = this.parse(subject.URI.spec);
		if (!url)
			return;

		site = this.find(url, type);
		if (!site)
			return;

		site.block(subject);
	},

	print: function(doc, elem)
	{
		let group;
		let i = 0;

		if (!doc || !elem)
			return;

		while (i < this.groups.length)
		{
			group = this.groups[i++];

			group.print(doc, elem);
		}
	}
};