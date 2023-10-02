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


const domparser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);
const _doc = domparser.parseFromString('<body/>', 'text/html');


const RULE_NONE = 0;
const RULE_COMM = 1;
const RULE_PROP = 2;

function BlRule(ln)
{
	this.ln = ln;
	this.parent = null;
	this.level = 0;
	this.disabled = false;
	this.type = RULE_NONE;
	this.name = null;
	this.rules = [];
	this.value = '';
}

BlRule.prototype = 
{
	parse(line)
	{
		let level, i;

		if (!line || !line.length)
			return;

		i = 0;
		level = 0;
		while (line[i] == '\t' || line[i++] == ' ' && line[i] == ' ')
		{
			level++;
			line = line.substr(i+1);
			i = 0;
		}
		this.level = level;

		switch (line[0])
		{
			case '#':
				this.type = RULE_COMM;
				line = line.substr(1);
				break;

			case '!':
				this.disabled = true;
				line = line.substr(1);
				break;
		}

		i = line.indexOf(':');
		if (i >= 0 && i < line.length)
		{
			this.name = line.substr(0, i).trim();
			line = line.substr(i+1);
			if (this.type == RULE_COMM)
				this.type = RULE_PROP;
		}

		this.value = line.trim();
	},

	add(rule)
	{
		if (!rule)
			return false;

		if (this.level < rule.level - 1)
		{
			if (this.rules.length < 1)
				return false;

			return this.rules[this.rules.length-1].add(rule);
		}

		rule.parent = this;
		this.rules.push(rule);

		return true;
	},

	toString()
	{
		let res = '';

		if (this.name)
		{
			res += 'name=';
			res += this.name;
			res += ' ';
		}

		res += '"';
		res += this.value;
		res += '" ';

		return res;
	}
};

BlRule.parseFlags = function(val)
{
	if (!val || val.length < 3)
		return [];

	if (val[0] != '(' && val[val.length-1] != ')')
		return [];

	val = val.slice(1,-1);

	return val.split('|');
};

BlRule.parse = function(fn, data, off, rules)
{
	let prule, rule;
	let ch, begin, line, ln;

	if (!data || data.length <= off)
		return;

	begin = off;
	ln = 0;
	while (off < data.length)
	{
		ch = data[off++];
		if (ch == '\r')
			continue;

		if (ch == '\n')
		{
			rule = null;
			line = data.substr(begin, off - begin - 1);
			begin = off;
			ln++;

			if (line)
			{
				rule = new BlRule(ln);
				rule.parse(line);
			}
			else
			{
				prule = null;
				continue;
			}

			if (!prule || prule.level >= rule.level)
			{
				if (rule.level > 0)
				{
					if (rule.name)
						log.error(new SyntaxError('ignore ' + rule.name + ' rule "' + rule.value + '"', fn, rule.ln));
					else
						log.error(new SyntaxError('ignore rule "' + rule.value + '"', fn, rule.ln));

					continue;
				}
			}
			else
			{
				if (prule.add(rule))
					continue;

				if (rule.name)
					log.error(new SyntaxError(prule.value + ': ignore ' + rule.name + ' rule "' + rule.value + '"', fn, rule.ln));
				else
					log.error(new SyntaxError(prule.value + ': ignore rule "' + rule.value + '"', fn, rule.ln));

				continue;
			}

			if (rule.type != RULE_COMM)
				prule = rule;
			rules.push(rule);
		}
	}
};

function StrRule(name, value)
{
	this.name = name;
	this.value = value;
}

StrRule.prototype =
{
	print(doc, elem)
	{
		let tree;

		tree = uitree.create(doc, this.name, false);
		uitree.add(elem, tree);

		uitree.addLabel(tree, this);
	},

	toString()
	{
		return this.value;
	}
};

function DomRule(rule)
{
	this.attrs = [];
	this.value = '';

	this._parse(rule);
}

DomRule.prototype =
{
	_parseAttr(rule)
	{
		if (rule.name != 'attr')
			throw new Error('ignore ' + rule.name + ' rule "' + rule.value + '": rule is unknown');

		if (rule.rules.length > 0)
			throw new Error('ignore ' + rule.name + ' rule "' + rule.value + '": subrules is not supported');

		this.attrs.push(rule.value);
	},

	_parse(rule)
	{
		let subrule, i;

		if (!rule || !rule.value)
			return;

		if (rule.rules.length > 0)
		{
			i = 0;
			while (i < rule.rules.length)
			{
				subrule = rule.rules[i++];
				if (!subrule || subrule.type != RULE_NONE)
					continue;

				try
				{
					this._parseAttr(subrule);
				}
				catch (e)
				{
					log.error(new SyntaxError(rule.name + ': ' + e.message, '?', subrule.ln)); // FIXME need set filename!
					continue;
				}
			}
	
			if (this.attrs.length < 1)
				throw new Error('no valid subrules found');
		}

		try
		{
			_doc.querySelectorAll(rule.value);
		}
		catch (e)
		{
			throw new Error('selector is not a valid');
		}

		this.value = rule.value;
	},

	print(doc, elem)
	{
		let node, tree, i;

		if (this.attrs.length > 0)
		{
			node = uitree.create(doc, this.value, false);

			tree = uitree.create(doc, "Attribute (" + this.attrs.length + ")", false);
			uitree.add(node, tree);

			i = 0;
			while (i < this.attrs.length)
			{
				uitree.addLabel(tree, this.attrs[i++]);
			}
		}
		else
			node = uitree.create(doc, this.value);

		uitree.add(elem, node);
	},

	toString()
	{
		return this.value;
	}
};

function CssRule(name)
{
	this.name = name.trim();
	this.data = '';

	this.load(this.name + '.css');
}

CssRule.prototype =
{
	load(fn)
	{
		io.loadText(fn, (data) =>
		{
			let ln;

			ln = data.split('\n').length;

			log.info("css: style " + fn + " loaded (" + ln + ' lines)');
			this.data = data;
		});
	},

	toString()
	{
		return this.name;
	}
};

function JsRule(name)
{
	this.name = name.trim();
	this.data = '';

	this.load(this.name + '.js');
}

JsRule.prototype =
{
	load(fn)
	{
		io.loadText(fn, (data) =>
		{
			let ln;

			ln = data.split('\n').length;

			log.info("js: javascript " + fn + " loaded (" + ln + ' lines)');
			this.data = data;
		});
	},

	toString()
	{
		return this.name;
	}
};

function PathRule(path)
{
	this.path = path;
	this.data = [];

	this._parse();
}

PathRule.cmp = function(val1, val2)
{
	if (val1 == val2)
		return true;

	if (val1.test)
		return val1.test(val2);

	return false;
};

PathRule.prototype =
{
	_parse()
	{
		let data, val, i;

		data = this.path.split('/');

		i = 0;
		while (i < data.length)
		{
			val = data[i];
			if (val.indexOf('*') >= 0)
				data[i] = new RegExp('^'+val.replace('*', '.*'));

			i++;
		}

		this.data = data;
	},

	hasPath(path)
	{
		let data, len, dlen, i, j;

		if (!path)
			return false;

		data = path.split('/');
		len = this.data.length;
		dlen = data.length;

		if (!this.data[len-1])
		{
			len--;
			dlen--;
		}

		i = 0;
		j = 0;

		if (!data[0])
		{
			if (this.data[0])
			{
				j++;
			}
		}

		while (i < len)
		{
			if (j >= dlen)
				return false;

			if (!PathRule.cmp(this.data[i], data[j++]))
			{
				if (this.data[0] && i < 1)
					continue;

				return false;
			}

			i++;
		}

		return true;
	},

	toString()
	{
		return this.path;
	}
};

function blsite(rule)
{
	this.group = null;

	this.enabled = !rule.disabled;

	this.name = rule.value;
	this.host = new blhost(rule.value, true);
	this.ua = null;
	this.aliases = [];
	this.pathes = [];
	this.type = [];
	this.dom = [];
	this.css = [];
	this.js = [];
	this.cnt = 0;
}

blsite.prototype =
{
	get hasPathes()
	{
		return this.pathes.length > 0;
	},

	get hasRules()
	{
		return this.ua || this.pathes.length > 0 || this.type.length > 0 || this.dom.length > 0 || this.css.length > 0 || this.js.length > 0;
	},

	addAlias(hostname)
	{
		let host = new blhost(hostname, true);

		if (this.hasHost(host))
			return;

		this.aliases.push(host);
	},

	addRule(rule)
	{
		if (!rule || rule.level < 1)
			return;

		if (rule.type != RULE_NONE)
			return;

		if (!rule.name)
		{
			this.addPath(rule);

			return;
		}

		if (rule.disabled)
			return;

		switch (rule.name)
		{
			case "ua":
				if (rule.rules.length > 0)
					throw new Error('subrules is not supported');

				this.ua = new StrRule("User-Agent", rule.value);
				break;

			case "cn":
				this.addAlias(rule.value);
				break;

			case "type":
				this.addType(rule);
				break;

			case "dom":
				this.addDom(rule);
				break;

			case "css":
				this.addCss(rule);
				break;

			case "js":
				this.addJs(rule);
				break;

			default:
				throw new Error('rule is unknown');
		}
	},

	hasHost(host)
	{
		let i;

		if (!this.enabled || !host || !this.host)
			return false;

		if (this.host.hasHost(host))
			return true;

		i = 0;
		while (i < this.aliases.length)
		{
			if (this.aliases[i++].hasHost(host))
				return true;
		}

		return false;
	},

	addPath(rule)
	{
		if (!rule || !rule.value)
			return;

		if (rule.rules.length > 0)
			throw new Error('subrules is not supported');

		this.pathes.push(new PathRule(rule.value));
	},

	hasPath(path)
	{
		let i;

		if (!path || !this.pathes.length)
			return false;

		i = path.indexOf('?');
		if (i > 0 && i < path.length)
			path = path.substr(0, i);

		i = 0;
		while (i < this.pathes.length)
		{
			if (this.pathes[i++].hasPath(path))
				return true;
		}

		return false;
	},

	addType(rule)
	{
		let line;

		if (!rule || !rule.value)
			return;

		if (rule.rules.length > 0)
			throw new Error('subrules is not supported');

		line = rule.value;
		line = line.replace('*', '.*');

		this.type.push(new RegExp(line));
	},

	hasType(type)
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

	get content()
	{
		let content, rule, obj, i;

		content = [];
		i = 0;
		while (i < this.dom.length)
		{
			rule = this.dom[i++];
			if (!rule)
				continue;

			obj =
			{
				sel: rule.value,
				attrs: rule.attrs
			};

			content.push(obj);
		}

		return content;
	},

	addDom(rule)
	{
		this.dom.push(new DomRule(rule));
	},

	get styles()
	{
		let styles, i;

		styles = [];
		i = 0;
		while (i < this.css.length)
			styles.push(this.css[i++].data);

		return styles;
	},

	get scripts()
	{
		let scripts, i;

		scripts = [];
		i = 0;
		while (i < this.js.length)
			scripts.push(this.js[i++].data);

		return scripts;
	},

	addCss(rule)
	{
		if (!rule || !rule.value)
			return;

		if (rule.rules.length > 0)
			throw new Error('subrules is not supported');

		this.css.push(new CssRule(rule.value));
	},

	addJs(rule)
	{
		if (!rule || !rule.value)
			return;

		if (rule.rules.length > 0)
			throw new Error('subrules is not supported');

		this.js.push(new JsRule(rule.value));
	},

	get hasDom()
	{
		return this.dom.length > 0 || this.css.length > 0 || this.js.length > 0;
	},

	onBlock()
	{
		this.cnt++;
		log.debug("Blocking site '" + this.name + "'");
	},

	print(doc, elem)
	{
		let node, tree, rule;
		let i;

		if (this.hasRules)
			node = uitree.create(doc, this, false);
		else
			node = uitree.create(doc, this);
		if (!this.enabled)
			node.setAttribute("enabled", false);

		uitree.add(elem, node);

		if (this.ua)
			this.ua.print(doc, node);

		if (this.aliases.length > 0)
		{
			tree = uitree.create(doc, "Alias (" + this.aliases.length + ")", false);
			uitree.add(node, tree);

			i = 0;
			while (i < this.aliases.length)
			{
				rule = this.aliases[i++];
				if (!rule)
					continue;

				uitree.addLabel(tree, rule);
			}
		}

		if (this.pathes.length > 0)
		{
			tree = uitree.create(doc, "Path (" + this.pathes.length + ")", false);
			uitree.add(node, tree);

			i = 0;
			while (i < this.pathes.length)
			{
				rule = this.pathes[i++];
				if (!rule)
					continue;

				uitree.addLabel(tree, rule);
			}
		}

		if (this.type.length > 0)
		{
			tree = uitree.create(doc, "Type (" + this.type.length + ")", false);
			uitree.add(node, tree);

			i = 0;
			while (i < this.type.length)
			{
				rule = this.type[i++];
				rule = rule.source;

				uitree.addLabel(tree, rule);
			}
		}

		if (this.dom.length > 0)
		{
			tree = uitree.create(doc, "Content (" + this.dom.length + ")", false);
			uitree.add(node, tree);

			i = 0;
			while (i < this.dom.length)
			{
				rule = this.dom[i++];
				if (!rule)
					continue;
	
				rule.print(doc, tree);
			}
		}

		if (this.css.length > 0)
		{
			tree = uitree.create(doc, "CSS (" + this.css.length + ")", false);
			uitree.add(node, tree);

			i = 0;
			while (i < this.css.length)
			{
				rule = this.css[i++];
				if (!rule)
					continue;

				uitree.addLabel(tree, rule);
			}
		}

		if (this.js.length > 0)
		{
			tree = uitree.create(doc, "JS (" + this.js.length + ")", false);
			uitree.add(node, tree);

			i = 0;
			while (i < this.js.length)
			{
				rule = this.js[i++];
				if (!rule)
					continue;

				uitree.addLabel(tree, rule);
			}
		}
	},

	toString()
	{
		let res;

		res = '[' + this.cnt + '] ';
		res += this.name;
		if (this.pathes.length > 0)
			res += ' (' + this.pathes.length + ')';

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
	setFlags(val)
	{
		let flags, i;

		flags = BlRule.parseFlags(val);

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

	toggle(value)
	{
		if (this.enabled == value)
			return false;

		this.enabled = value;
		if (value)
			log.info("Enable '" + this.name + "' group");
		else
			log.info("Disable '" + this.name + "' group");

		return true;
	},

	add(site)
	{
		if (!site || site.group)
			return;

		this.data.push(site);
		site.group = this;
		log.debug(this.name + ': add url "' + site.name + '"');
	},

	find(host)
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

	print(doc, elem)
	{
		let tree, label, site;
		let i = 0;

		if (!doc || !elem)
			return;

		if (this.data.length > 0)
			tree = uitree.create(doc, this + ':', this.data.length <= 10);
		else
			tree = uitree.create(doc, this + ':');
		if (!this.enabled)
			tree.setAttribute("enabled", false);
		elem.appendChild(tree);

		while (i < this.data.length)
		{
			site = this.data[i++];

			site.print(doc, tree);
		}
	},

	toString()
	{
		let res;

		res = this.name;
		res += ' (' + this.data.length + ')';

		return res;
	}
};

blgroup.validName = function(name)
{
	let i, ch;

	if (!name || name.length < 1)
		return false;

	i = 0;
	while (i < name.length)
	{
		ch = name.charCodeAt(i++);
		if (ch != 0x20 && ch < 0x30 || ch > 0x7a)
			return false;

		if (ch > 0x39 && ch < 0x41)
			return false;

		if (ch > 0x5a && ch < 0x61)
			return false;
	}

	return true;
};

function bldb(fn)
{
	this.fn = fn;
	this.defGroup = null;
	this.groups = [];
}

bldb.prototype =
{
	clear()
	{
		this.groups = [];
	},

	close()
	{
		this.clear();
	},

	get(grpId)
	{
		if (!grpId || grpId <= 0)
			return null;

		return this.groups[grpId - 1];
	},

	add(group)
	{
		let id;

		if (!group || !group.name)
			return;

		if (this.groups.findIndex((g) => group.name == g.name) >= 0)
			return;

		id = this.groups.length + 1;

		this.groups.push(group);
		group.id = id;
		log.debug('add group "' + group.name + '" to blacklist');
	},

	load(onLoad)
	{
		let db, loadtime;

		db = this;

		loadtime = new Date();
		io.loadText(this.fn, (data) =>
		{
			if (!data)
				return;

			bldb.parse(db, data);

			loadtime = new Date() - loadtime;

			if (onLoad)
				onLoad(db);

			log.info("load blacklist sites from '" + db.fn + "' file (" + loadtime + " ms)");
		});
	},

	find(hostname, path)
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

			if (path && site.hasPathes)
			{
				if (!site.hasPath(path))
					continue;
			}

			return site;
		}

		return null;
	},

	findUA(dn)
	{
		let group, site, host, ua;
		let i;

		if (!dn)
			return null;

		try
		{
			host = new blhost(dn);
		}
		catch (e)
		{
			return null;
		}

		ua = null;

		i = 0;
		while (i < this.groups.length)
		{
			group = this.groups[i++];
			site = group.find(host);
			if (!site || !site.ua)
				continue;

			ua = site.ua;
		}

		return ua;
	},

	print(doc, elem)
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

bldb.parse = function(db, data)
{
	let rules, rule, subrule, group, site, i, j;

	if (!db || !data)
		return;

	rules = [];
	BlRule.parse(db.fn, data, 0, rules);

	group = new blgroup('Default');
	group.hidden = true;
	db.defGroup = group;

	i = 0;
	while (i < rules.length)
	{
		rule = rules[i++];
		if (!rule)
		{
			group = db.defGroup;
			continue;
		}

		switch (rule.type)
		{
			case RULE_COMM:
				continue;

			case RULE_PROP:
				switch (rule.name)
				{
					case 'group':
						if (!blgroup.validName(rule.value))
							continue;

						group = new blgroup(rule.value);
						db.add(group);
						break;

					case 'flags':
						group.setFlags(rule.value);
						break;
				}
				continue;

			default:
				try
				{
					site = new blsite(rule);
					group.add(site);
				}
				catch (e)
				{
					log.error(new SyntaxError('ignore hostname "' + rule.value + '": ' + e.message, db.fn, rule.ln));
					continue;
				}
	
				j = 0;
				while (j < rule.rules.length)
				{
					subrule = rule.rules[j++];
	
					try
					{
						site.addRule(subrule);
					}
					catch (e)
					{
						if (subrule.name)
							log.error(new SyntaxError(site.name + ': ignore ' + subrule.name + ' rule "' + subrule.value + '": ' + e.message, db.fn, subrule.ln));
						else
							log.error(new SyntaxError(site.name + ': ignore rule "' + subrule.value + '": ' + e.message, db.fn, subrule.ln));
					}
				}
		}
	}

	db.add(db.defGroup);
};
