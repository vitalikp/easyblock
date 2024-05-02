"use strict";

const Cu = Components.utils;


var EXPORTED_SYMBOLS = ["SiteHandler"];

// import
Cu.import("chrome://easyblock/content/eventbus.jsm");


let _cache = null;


const MutConf =
{
	subtree: true,
	childList: true
};

function Site(hostname, grpId)
{
	this.obs = null;
	this.hostname = hostname;
	this.grpId = grpId;
	this.styles = [];
	this.scripts = [];
	this.rules = [];

	this.enabled = true;
	this._disabled = false;
}

Site.prototype =
{
	get disabled()
	{
		return this._disabled || !this.enabled;
	},

	set disabled(value)
	{
		if (this._disabled == value)
			return;

		this._disabled = value;
	},

	toggle(data)
	{
		if (!data)
			return;

		if (data.grpId > 0)
		{
			if (this.grpId == data.grpId)
				this.enabled = data.value;

			return;
		}

		this.disabled = data.value;
	},

	reg(win, node)
	{
		if (this.obs || !win || !node)
			return;

		this.obs = new win.MutationObserver((mutList, obs) => this.onEdit(mutList));
		win.addEventListener("unload", this, { once: true });
		this.obs.observe(node, MutConf);
	},

	unreg()
	{
		if (!this.obs)
			return;

		this.obs.disconnect();
		this.obs = null;
	},

	filter(doc)
	{
		if (this.disabled || !doc)
			return;

		this.apply(doc);
		if (this.rules.length > 0)
		{
			this.reg(doc.defaultView, doc.body);
			this.filterNode(doc.body);
		}
	},

	onEdit(mutList)
	{
		let mut, i, j;

		if (this.disabled || !mutList)
			return;

		i = 0;
		while (i < mutList.length)
		{
			mut = mutList[i++];
			if (!mut)
				continue;

			if (mut.type == 'childList')
			{
				j = 0;
				while (j < mut.addedNodes.length)
					this.filterNode(mut.addedNodes[j++]);
			}
		}
	},

	apply(doc)
	{
		let i;
		let style, script, nonce;

		if (!doc)
			return;

		i = 0;
		while (i < this.styles.length)
		{
			style = doc.createElement("style");
			style.type = "text/css";
			style.innerHTML = this.styles[i++];
			doc.head.appendChild(style);
		}

		nonce = Site.getCspNonce(doc);

		i = 0;
		while (i < this.scripts.length)
		{
			script = doc.createElement("script");
			script.type = "text/javascript";
			if (nonce)
				script.setAttribute("nonce", nonce);
			script.innerHTML = this.scripts[i++];
			doc.head.appendChild(script);
		}
	},

	filterNode(node)
	{
		let nodes, rule, i;

		if (!node || !node.parentElement || node.nodeType != node.ELEMENT_NODE)
			return;

		node = node.parentElement;

		i = 0;
		while (i < this.rules.length)
		{
			rule = this.rules[i++];
			if (!rule || !rule.sel)
				continue;

			nodes = node.querySelectorAll(rule.sel);
			Site.filterNodes(nodes, rule.attrs);
			nodes = null;
		}
	},

	handleEvent(event)
	{
		if (!event)
			return;

		switch (event.type)
		{
			case "unload":
				this.unreg();
				break;
		}
	},

	toString()
	{
		return this.hostname;
	}
};

Site.filterAttrs = function(node, attrs)
{
	let attr, i;

	if (!node || !attrs || attrs.length < 1)
		return;

	i = 0;
	while (i < attrs.length)
	{
		attr = attrs[i++];
		if (!attr)
			continue;

		if (node.hasAttribute(attr))
			node.removeAttribute(attr);
	}
};

Site.filterNodes = function(nodes, attrs)
{
	let i, node, hasAttrs;

	if (!nodes || !nodes.length)
		return;

	hasAttrs = attrs && attrs.length > 0;

	i = 0;
	while (i < nodes.length)
	{
		node = nodes[i++];
		if (node)
		{
			if (!hasAttrs)
				node.remove();
			else
				Site.filterAttrs(node, attrs);
		}
		node = null;
	}
};

Site.getCspNonce = function(doc)
{
	let csp, src, val, i, j;

	if (!doc || !doc.nodePrincipal)
		return null;

	csp = doc.nodePrincipal.cspJSON;
	if (!csp)
		return null;

	try
	{
		csp = JSON.parse(csp.toString());
		csp = csp["csp-policies"];
		if (Array.isArray(csp))
		{
			i = 0;
			while (i < csp.length)
			{
				src = csp[i++]["script-src"];
				if (Array.isArray(src))
				{
					j = 0;
					while (j < src.length)
					{
						val = src[j++];
						if (val.startsWith("'nonce-"))
							return val.slice(7,-1);
					}
				}
			}
		}
	}
	catch(e)
	{
	}

	return null;
}

function ContentBus(mm, handler)
{
	EventBus.call(this, "content", mm);

	this.handler = handler;

	this.regEvent("process");
}

ContentBus.prototype = Object.create(EventBus.prototype);
Object.assign(ContentBus.prototype,
{
	onSite(data)
	{
		if (!data)
			return;

		_cache.set(data.hostname, data);

		this.handler.onFind(data);
	},

	reload()
	{
		this.handler.reload();
	},

	get(name, data)
	{
		let res;

		if (!name)
			return;

		data = Object.assign({ name: name }, data);

		res = this.sendSyncEvent(EventType.GET, data);
		if (!res)
			return null;

		return res[0];
	},

	dom(hostname)
	{
		let data;

		data = this.sendSyncEvent(EventType.DOM, { hostname: hostname });
		if (!data || !data[0])
			return;

		data = data[0];

		if (data.hostname != hostname)
			return;

		this.onSite(data);
	},

	onEvent(event)
	{
		switch (event.type)
		{
			case EventType.TOGGLE:
				this.handler.toggle(event.data);
				break;

			case EventType.RELOAD:
				this.reload();
				break;
		}
	},

	destroy()
	{
		this.unregEvent("process");
	}
});

function SiteHandler(global)
{
	this._disabled = false;

	this.sites = new Map();

	if (!_cache)
		_cache = new Map();

	this.bus = new ContentBus(global, this);

	this._disabled = this.bus.get('disabled');
}

SiteHandler.prototype =
{
	toggle(data)
	{
		let iter, site;

		if (!data)
			return;

		iter = this.sites.values();
		while (!(site=iter.next()).done)
		{
			site = site.value;
			if (!site)
				continue;

			site.toggle(data);
		}

		if (data.grpId > 0)
			return;

		this._disabled = data.value;
	},

	reload()
	{
		if (_cache && _cache.size > 0)
			_cache.clear();

		this.sites.clear();
	},

	onFind(data)
	{
		let site;

		if (!data)
			return;

		site = new Site(data.hostname, data.grpId);
		site.disabled = this._disabled;
		site.styles = data.styles||[];
		site.scripts = data.scripts||[];
		site.rules = data.content||[];

		this.sites.set(data.hostname, site);
	},

	findDom(hostname)
	{
		let data;

		data = _cache.get(hostname);
		if (!data)
		{
			this.bus.dom(hostname);
			return;
		}

		if (this.bus.get("enabled", { grpId: data.grpId }))
			this.onFind(data);
	},

	onCreate(doc)
	{
		let loc, site;

		if (!doc)
			return;

		loc = doc.location;
		if (loc.protocol != "https:" && loc.protocol != "http:")
			return;

		site = this.sites.get(loc.hostname);

		if (!site)
			this.findDom(loc.hostname);
	},

	filterDom(doc)
	{
		let loc, site;

		if (this._disabled || !this.bus)
			return;

		if (!doc || doc.nodeType != doc.DOCUMENT_NODE)
			return;

		loc = doc.location;
		if (loc.protocol != "https:" && loc.protocol != "http:")
			return;

		site = this.sites.get(loc.hostname);

		if (!site)
			return;

		site.filter(doc);
	},

	handleEvent(event)
	{
		let target;

		if (!event || !event.target)
			return;

		target = event.target;

		switch (event.type)
		{
			case "DOMWindowCreated":
				this.onCreate(target);
				break;

			case "DOMContentLoaded":
				this.filterDom(target);
				break;

			case "unload":
				target.removeEventListener("DOMWindowCreated", this);
				target.removeEventListener("DOMContentLoaded", this);
				target.removeEventListener("unload", this);
				this.destroy();
				break;
		}
	},

	destroy()
	{
		let iter, site;

		iter = this.sites.values();
		while (!(site=iter.next()).done)
		{
			site = site.value;
			if (!site)
				continue;

			site.unreg();
		}
		this.sites.clear();

		if (this.bus)
		{
			this.bus.destroy();
			this.bus = null;
		}
	}
};