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

	get hasRules()
	{
		return this.query.length > 0 || this.type.length > 0;
	},

	hasHost: function(host)
	{
		if (!host || !this.host)
			return false;

		return this.host.test(host) || this.host.test('www.'+host);
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

	hasPath: function(path)
	{
		let i;

		if (!path || !this.query.length)
			return false;

		i = 0;
		while (i < this.query.length)
		{
			if (this.query[i++].test(path))
				return true;
		}

		return false;
	},

	addType: function(line)
	{
		if (!line)
			return;

		line = line.trim();
		line = line.replace('*', '.*');

		this.type.push(new RegExp(line));
	},

	hasType: function(type)
	{
		let i;

		if (!type || !this.type.length)
			return false;

		i = 0;
		while (i < this.type.length)
		{
			if (this.type[i++].test(type))
				return true;
		}

		return false;
	},

	onBlock: function()
	{
		this.cnt++;
		io.log("Blocking site '" + this.name + "'");
	},

	toString: function()
	{
		let res;

		res = '[' + this.cnt + '] ';
		res += this.name;
		if (this.query.length > 0)
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

	toggle: function(value)
	{
		if (this.enabled == value)
			return false;

		this.enabled = value;
		if (value)
			io.log("Enable '" + this.name + "' group");
		else
			io.log("Disable '" + this.name + "' group");

		return true;
	},

	add: function(site)
	{
		if (!site)
			return;

		this.data.push(site);
//		io.log(this.name + ': add url "' + site.name + '"');
	},

	find: function(url)
	{
		let site;
		let i = 0;

		if (!this.enabled)
			return null;

		if (!url)
			return null;

		while (i < this.data.length)
		{
			site = this.data[i++];
			if (site.hasHost(url.hostname))
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
	fn: '',
	commRegEx: '',
	defGroup: null,
	groups: [],

	create: function(fn, onLoad)
	{
		var db;

		db = Object.create(bldb);
		db.commRegEx = new RegExp(COMM_PATTERN);
		db.fn = fn;
		db.load(onLoad);

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
//		io.log('add group "' + group.name + '" to blacklist');
	},

	load: function(onLoad)
	{
		let db, site, index;

		io.log("load blacklist sites from '" + this.fn + "' file");

		db = this;

		io.loadText(this.fn, (data) =>
		{
			let arr, res, group;

			if (!data)
				return;

			group = blgroup.create('Default');
			group.id = 0;
			db.defGroup = group;
			db.groups.push(group);

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
				group.add(site);
			});

			if (onLoad)
				onLoad(db);
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
		let group, site;
		let i = 0;

		if (!url)
			return null;

		while (i < this.groups.length)
		{
			group = this.groups[i++];
			site = group.find(url);
			if (!site)
				continue;

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