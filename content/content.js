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

function Site(hostname)
{
	let filter = {};

	this.obs = null;
	this.hostname = hostname;
	this.grpId = 0;
	this.styles = [];
	this.scripts = [];
	this.rules = [];
	this.enabled = true;
	this._disabled = false;

	// import filter API
	Cu.import("chrome://easyblock/content/filter.js", filter);
	this.filter = new filter.Content(ContentAPI, this);

	this.disabled = this.filter.get('disabled');
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
		if (this.rules.length <= 0 || this.obs || !win || !node)
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
		this.enabled = this.filter.get('enabled', { grpId: data.grpId });
		this.styles = data.styles;
		this.scripts = data.scripts||[];
		this.rules = data.content||[];
		this.reg(doc.defaultView, doc.body);
		this.apply(doc);
	},

	filterDom: function(doc)
	{
		let loc;

		if (this.disabled || !this.filter)
			return;

		if (!doc || doc.nodeType != doc.DOCUMENT_NODE)
			return;

		if (doc.defaultView.top != doc.defaultView.self)
			return;

		loc = doc.location;
		if (loc.protocol != "https:" && loc.protocol != "http:")
			return;

		if (this.hostname != loc.hostname)
		{
			this.filter.findDom(loc.hostname, (data) => this.onFind(doc, data));
			return;
		}

		this.reg(doc.defaultView, doc.body);
		this.apply(doc);
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

		if (this.disabled || !doc)
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

		this.filterNode(doc.body);
	},

	filterNode: function(node)
	{
		let nodes, rule, i;

		if (this.disabled || this.rules.length <= 0 || !node || !node.parentElement || node.nodeType != node.ELEMENT_NODE)
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
			case "DOMContentLoaded":
				this.filterDom(event.originalTarget);
				break;

			case "beforeunload":
				removeEventListener("beforeunload", this);
				this.unreg();
				break;

			case "unload":
				removeEventListener("DOMContentLoaded", this);
				removeEventListener("unload", this);
				this.unreg();
				this.clear();
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

let obs;

obs = new Site("");
addEventListener("DOMContentLoaded", obs);
addEventListener('unload', obs);
