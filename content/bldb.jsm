"use strict";

const Ci = Components.interfaces;
const Cu = Components.utils;
const Cc = Components.classes;
const Cr = Components.results;


var EXPORTED_SYMBOLS = ["bldb"];

// import
Cu.import("chrome://easyblock/content/io.jsm");
Cu.import("chrome://easyblock/content/blhost.jsm");
Cu.import("chrome://easyblock/content/ui.jsm");


const COMM_PATTERN = "^# ([a-z0-9]*): ([a-zA-Z0-9 \(\)|]*)$";

const domparser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);
const _doc = domparser.parseFromString('<body/>', 'text/html');


function blsite(hostname)
{
	this.grpId = 0;

	this.enabled = true;
	if (hostname[0] == '!')
	{
		hostname = hostname.substr(1);
		this.enabled = false;
	}

	this.name = hostname;
	this.host = new blhost(hostname, true);
	this.ua = '';
	this.query = [];
	this.type = [];
	this.dom = [];
	this.css = [];
	this.cnt = 0;
}

blsite.prototype =
{
	get hasRules()
	{
		return this.ua.length > 0 || this.query.length > 0 || this.type.length > 0 || this.dom.length > 0 || this.css.length > 0;
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

		if (rule.startsWith('ua:'))
		{
			this.ua = rule.substr(3);

			return true;
		}

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

		if (rule.startsWith('css:'))
		{
			this.addCss(rule.substr(4));

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
			if (line[line.length-1] == '/')
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

	get styles()
	{
		return this.css;
	},

	addCss: function(line)
	{
		let style, fn;

		if (!line)
			return;

		fn = line.trim() + '.css';
		io.loadText(fn, (data) =>
		{
			let ln;

			ln = data.split('\n').length;

			io.log("css: style " + fn + " loaded (" + ln + ' lines)');
			this.css.push(data);
		});
	},

	get hasDom()
	{
		return this.dom.length > 0 || this.css.length > 0;
	},

	onBlock: function()
	{
		if (this.hasDom)
			io.log("Blocking content site '" + this.name + "'");
		else
		{
			this.cnt++;
			io.log("Blocking site '" + this.name + "'");
		}
	},

	print: function(doc, elem)
	{
		let label;

		label = doc.createElement("label");
		if (!this.enabled)
			label.setAttribute("enabled", false);
		label.setAttribute("value", this);

		uitree.add(elem, label);
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


function blgroup(name)
{
	this.id = -1;
	this.name = name;
	this.data = [];
	this.enabled = true;
	this.hidden = false;
}

blgroup.prototype =
{
	setFlags: function(val)
	{
		let flags, i;

		if (!val || val.length < 3)
			return;

		if (val[0] != '(' && val[val.length-1] != ')')
			return;
		val = val.slice(1,-1);

		flags = val.split('|');

		i = 0;
		while (i < flags.length)
		{
			switch (flags[i++])
			{
				case "disabled":
					this.enabled = false;
					break;

				case "hidden":
					this.hidden = true;
					break;
			}
		}
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
		if (!site || site.grpId > 0)
			return;

		this.data.push(site);
		site.grpId = this.id;
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

		if (this.data.length > 0)
			vbox = uitree.create(doc, this + ':', this.data.length <= 10);
		else
			vbox = uitree.create(doc, this + ':');
		if (!this.enabled)
			vbox.setAttribute("enabled", false);
		elem.appendChild(vbox);

		while (i < this.data.length)
		{
			site = this.data[i++];

			site.print(doc, vbox);
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

function bldb(fn)
{
	this.commRegEx = new RegExp(COMM_PATTERN);
	this.fn = fn;
	this.defGroup = null;
	this.groups = [];
}

bldb.prototype =
{
	close: function()
	{
		this.groups = [];
	},

	get: function(grpId)
	{
		if (!grpId || grpId <= 0)
			return null;

		return this.groups[grpId - 1];
	},

	add: function(group)
	{
		let id;

		if (!group || !group.name)
			return;

		if (this.groups.findIndex((g) => group.name == g.name) >= 0)
			return;

		id = this.groups.length + 1;

		this.groups.push(group);
		group.id = id;
//		io.log('add group "' + group.name + '" to blacklist');
	},

	load: function(onLoad)
	{
		let db, site, loadtime;

		db = this;

		loadtime = new Date();
		db.groups = [];
		io.loadText(this.fn, (data) =>
		{
			let arr, res, group, line;
			let i;

			if (!data)
				return;

			group = new blgroup('Default');
			group.hidden = true;
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
							group = new blgroup(res[2].trim());
							db.add(group);
							break;

						case 'flags':
							group.setFlags(res[2].trim());
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
					site = new blsite(line);
					group.add(site);
				}
				catch (e)
				{
					io.warn('ignore hostname "' + line + '"');
					io.error(new SyntaxError(e.message, db.fn, i));
				}
			}

			db.add(db.defGroup);

			loadtime = new Date() - loadtime;

			if (onLoad)
				onLoad(db);

			io.log("load blacklist sites from '" + db.fn + "' file (" + loadtime + " ms)");
		});
	},

	find: function(hostname, path)
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

			if (path && site.hasRules)
			{
				if (!site.hasPath(path))
					continue;
			}

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