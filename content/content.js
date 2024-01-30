"use strict";

const Cu = Components.utils;


const ContentAPI =
{
	regEvent(event, handler)
	{
		addMessageListener(event, handler);
	},

	unregEvent(event, handler)
	{
		removeMessageListener(event, handler);
	},

	sendSyncEvent(event, data)
	{
		return sendSyncMessage(event, data);
	}
};

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

function SiteHandler(api, global)
{
	let filter = {};

	this._disabled = false;
	this.site = null;
	this.frames = new Map();

	// import filter API
	Cu.import("chrome://easyblock/content/filter.js", filter);
	this._filter = new filter.Content(api, this);

	this._disabled = this._filter.get('disabled');
}

SiteHandler.prototype =
{
	toggle(data)
	{
		let iter, site;

		if (!data)
			return;

		if (this.site)
			this.site.toggle(data);

		iter = this.frames.values();
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
		this.site = null;
		this.frames.clear();
	},

	onFind(doc, data, isFrame)
	{
		let site;

		if (!doc || !data)
			return;

		site = new Site(data.hostname, data.grpId);
		site.disabled = this._disabled;
		site.styles = data.styles||[];
		site.scripts = data.scripts||[];
		site.rules = data.content||[];

		if (!isFrame)
		{
			if (this.site)
				this.site.unreg();
			this.frames.clear();
			this.site = site;
		}
		else
			this.frames.set(data.hostname, site);
	},

	findDom(hostname, onFind)
	{
		if (!onFind)
			return;

		return this._filter.findDom(hostname, onFind);
	},

	onCreate(doc)
	{
		let loc, site, isFrame;

		if (!doc)
			return;

		loc = doc.location;
		if (loc.protocol != "https:" && loc.protocol != "http:")
			return;

		isFrame = doc.defaultView.top != doc.defaultView.self;

		if (!isFrame)
			site = this.site; // doc is root site
		else
			site = this.frames.get(loc.hostname); // doc is frame site

		if (!site || site.hostname != loc.hostname)
			this.findDom(loc.hostname, (data) => this.onFind(doc, data, isFrame));
	},

	filterDom(doc)
	{
		let loc, site;

		if (this._disabled || !this._filter)
			return;

		if (!doc || doc.nodeType != doc.DOCUMENT_NODE)
			return;

		loc = doc.location;
		if (loc.protocol != "https:" && loc.protocol != "http:")
			return;

		if (doc.defaultView.top == doc.defaultView.self) // doc is root site
			site = this.site;
		else
			site = this.frames.get(loc.hostname); // doc is frame site

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

		if (this.site)
		{
			this.site.unreg();
			this.site = null;
		}

		iter = this.frames.values();
		while (!(site=iter.next()).done)
		{
			site = site.value;
			if (!site)
				continue;

			site.unreg();
		}
		this.frames.clear();

		if (this._filter)
		{
			this._filter.destroy();
			this._filter = null;
		}
	}
};

let handler;

handler = new SiteHandler(ContentAPI, this);
addEventListener("DOMWindowCreated", handler);
addEventListener("DOMContentLoaded", handler);
addEventListener('unload', handler); // once is ignored here
