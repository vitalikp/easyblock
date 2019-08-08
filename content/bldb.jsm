"use strict";

const Ci = Components.interfaces;
const Cu = Components.utils;
const Cc = Components.classes;
const Cr = Components.results;


var EXPORTED_SYMBOLS = ["bldb"];

// import
Cu.import("chrome://easyblock/content/io.jsm");
Cu.import("chrome://easyblock/content/blhost.jsm");


const COMM_PATTERN = "^# ([a-z0-9]*): ([a-zA-Z0-9 ]*)$";

const domparser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);
const _doc = domparser.parseFromString('<body/>', 'text/html');


var blsite =
{
	enabled: true,
	name: '',
	host: null,
	query: [],
	type: [],
	dom: [],
	cnt: 0,

	create: function(hostname)
	{
		var site, host, enabled = true;

		if (hostname[0] == '!')
		{
			hostname = hostname.substr(1);
			enabled = false;
		}
		host = new blhost(hostname, true);

		site = Object.create(this);
		site.enabled = enabled;
		site.name = hostname;
		site.host = host;
		site.query = [];
		site.type = [];
		site.dom = [];

		return site;
	},

	get hasRules()
	{
		return this.query.length > 0 || this.type.length > 0 || this.dom.length > 0;
	},

	addRule: function(rule)
	{
		let i;

		if (!rule || !rule.length)
			return false;

		i = 0;
		if (rule[i] != '\t' && rule[i++] != ' ' && rule[i] != ' ')
			return false;
		rule = rule.substr(i+1);

		if (rule.startsWith('type:'))
		{
			this.addType(rule.substr(5));

			return true;
		}

		if (rule.startsWith('dom:'))
		{
			this.addDom(rule.substr(4));

			return true;
		}

		this.addQuery(rule);

		return true;
	},

	hasHost: function(host)
	{
		if (!this.enabled || !host || !this.host)
			return false;

		return this.host.hasHost(host);
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

	addDom: function(line)
	{
		if (!line)
			return;

		line = line.trim();

		_doc.querySelectorAll(line);
		this.dom.push(line);
	},

	get hasDom()
	{
		return this.dom.length > 0;
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

	find: function(host)
	{
		let site;
		let i = 0;

		if (!host || !this.enabled)
			return null;

		while (i < this.data.length)
		{
			site = this.data[i++];
			if (site.hasHost(host))
				return site;
		}

		return null;
	},

	print: function(doc, elem)
	{
		let vbox, label, site;
		let i = 0;

		if (!doc || !elem)
			return;

		vbox = doc.createElement("vbox");
		if (!this.enabled)
			vbox.setAttribute("enabled", false);
		elem.appendChild(vbox);

		label = doc.createElement("label");
		label.setAttribute("value", this + ':');
		vbox.appendChild(label);

		while (i < this.data.length)
		{
			site = this.data[i++];

			label = doc.createElement("label");
			if (!site.enabled)
				label.setAttribute("enabled", false);
			label.setAttribute("value", site);
			vbox.appendChild(label);
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
		let db, site, loadtime;

		db = this;

		loadtime = new Date();
		io.loadText(this.fn, (data) =>
		{
			let arr, res, group, line;
			let i;

			if (!data)
				return;

			group = blgroup.create('Default');
			group.id = 0;
			db.defGroup = group;

			arr = data.split(/\r\n|\n/);

			i = 0;
			while (i < arr.length)
			{
				line = arr[i++];
				if (!line)
				{
					group = db.defGroup;
					continue;
				}

				if (line[0] == '#')
				{
					res = db.commRegEx.exec(line);
					if (!res)
						continue;

					switch (res[1])
					{
						case 'title':
							group = blgroup.create(res[2].trim());
							db.add(group);
							break;
					}
					continue;
				}

				try
				{
					if (site && site.addRule(line))
						continue;
				}
				catch (e)
				{
					io.warn(site.name + ': ignore rule "' + line + '"');
					io.error(new SyntaxError(e.message, db.fn, i));
					continue;
				}

				try
				{
					site = blsite.create(line);
					group.add(site);
				}
				catch (e)
				{
					io.warn('ignore hostname "' + line + '"');
					io.error(new SyntaxError(e.message, db.fn, i));
				}
			}

			db.groups.push(db.defGroup);

			loadtime = new Date() - loadtime;

			if (onLoad)
				onLoad(db);

			io.log("load blacklist sites from '" + db.fn + "' file (" + loadtime + " ms)");
		});
	},

	find: function(hostname)
	{
		let group, site, host;
		let i = 0;

		if (!hostname)
			return null;

		try
		{
			host = new blhost(hostname);
		}
		catch (e)
		{
			return null;
		}

		while (i < this.groups.length)
		{
			group = this.groups[i++];
			site = group.find(host);
			if (!site)
				continue;

			return site;
		}

		return null;
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