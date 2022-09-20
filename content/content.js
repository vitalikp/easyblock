"use strict";

const Cu = Components.utils;


const ContentAPI =
{
	regEvent: function(event, handler)
	{
		addMessageListener(event, handler);
	},

	sendSyncEvent: function(event, data)
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
	let filter = {};

	this.obs = null;
	this.hostname = hostname;
	this.grpId = grpId;
	this.styles = [];
	this.scripts = [];
	this.rules = [];

	this.enabled = true;
	this._disabled = false;

	// import filter API
	Cu.import("chrome://easyblock/content/filter.js", filter);
	this._filter = new filter.Content(ContentAPI, this);
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

	toggle: function(data)
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

	reload: function()
	{
		this.clear();
	},

	clear: function()
	{
		this.hostname = '';
		this.grpId = 0;
		this.enabled = true;
		this.styles = [];
		this.scripts = [];
		this.rules = [];
	},

	reg: function(win, node)
	{
		if (this.obs || !win || !node)
			return;

		this.obs = new win.MutationObserver((mutList, obs) => this.onEdit(mutList));
		win.addEventListener("beforeunload", this);
		this.obs.observe(node, MutConf);
	},

	unreg: function()
	{
		if (!this.obs)
			return;

		this.obs.disconnect();
		this.obs = null;
	},

	onFind: function(doc, data)
	{
		if (!doc || !data)
			return;

		this.unreg();
		this.hostname = data.hostname;
		this.grpId = data.grpId;
		this.enabled = this._filter.get('enabled', { grpId: data.grpId });
		this.styles = data.styles;
		this.scripts = data.scripts||[];
		this.rules = data.content||[];

		this.filter(doc);
	},

	filter: function(doc)
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

	onEdit: function(mutList)
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

	apply: function(doc)
	{
		let i;
		let style, script;

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

		i = 0;
		while (i < this.scripts.length)
		{
			script = doc.createElement("script");
			script.type = "text/javascript";
			script.innerHTML = this.scripts[i++];
			doc.head.appendChild(script);
		}
	},

	filterNode: function(node)
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

	handleEvent: function(event)
	{
		if (!event)
			return;

		switch (event.type)
		{
			case "beforeunload":
				removeEventListener("beforeunload", this);
				this.unreg();
				break;
		}
	},

	toString: function()
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

function SiteHandler()
{
	let filter = {};

	this._disabled = false;
	this.site = null;

	// import filter API
	Cu.import("chrome://easyblock/content/filter.js", filter);
	this._filter = new filter.Content(ContentAPI, this);

	this._disabled = this._filter.get('disabled');
}

SiteHandler.prototype =
{
	toggle: function(data)
	{
		if (!data)
			return;

		if (this.site)
			this.site.toggle(data);

		if (data.grpId > 0)
			return;

		this._disabled = data.value;
	},

	reload: function()
	{
		this.site = null;
	},

	onFind: function(doc, data)
	{
		let site;

		if (!doc || !data)
			return;

		site = new Site(data.hostname, data.grpId);
		site.enabled = this._filter.get('enabled', { grpId: data.grpId });
		site.disabled = this._disabled;
		site.styles = data.styles||[];
		site.scripts = data.scripts||[];
		site.rules = data.content||[];

		if (this.site)
			this.site.unreg();
		this.site = site;

		site.filter(doc);
	},

	filterDom: function(doc)
	{
		let loc, site;

		if (this._disabled || !this._filter)
			return;

		if (!doc || doc.nodeType != doc.DOCUMENT_NODE)
			return;

		if (doc.defaultView.top != doc.defaultView.self)
			return;

		loc = doc.location;
		if (loc.protocol != "https:" && loc.protocol != "http:")
			return;

		site = this.site;
		if (!site || site.hostname != loc.hostname)
		{
			this._filter.findDom(loc.hostname, (data) => this.onFind(doc, data));
			return;
		}

		site.filter(doc);
	},

	handleEvent: function(event)
	{
		if (!event)
			return;

		switch (event.type)
		{
			case "DOMContentLoaded":
				this.filterDom(event.originalTarget);
				break;

			case "unload":
				removeEventListener("DOMContentLoaded", this);
				removeEventListener("unload", this);
				this.destroy();
				break;
		}
	},

	destroy: function()
	{
		if (this.site)
		{
			this.site.unreg();
			this.site = null;
		}
	}
};

let handler;

handler = new SiteHandler();
addEventListener("DOMContentLoaded", handler);
addEventListener('unload', handler);
