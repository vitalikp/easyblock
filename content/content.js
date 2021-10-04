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

function ContentObserver()
{
	let filter = {};

	this.obs = null;
	this.hostname = '';
	this.grpId = 0;
	this.styles = [];
	this.dom = null;
	this.enabled = true;
	this._disabled = false;

	// import filter API
	Cu.import("chrome://easyblock/content/filter.js", filter);
	this.filter = new filter.Content(ContentAPI, this);

	this.disabled = this.filter.get('disabled');

	addEventListener("DOMContentLoaded", this);
	addEventListener('unload', this);
}

ContentObserver.prototype =
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
		this.dom = null;
	},

	reg: function(win, node)
	{
		if (!this.dom || this.obs || !win || !node)
			return;

		this.obs = new win.MutationObserver((mutList, obs) => this.onDomEdit(mutList));
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
		let dom;

		if (!doc || !data)
			return;
		dom = data.content;

		this.unreg();
		this.hostname = data.hostname;
		this.grpId = data.grpId;
		this.enabled = this.filter.get('enabled', { grpId: data.grpId });
		this.styles = data.styles;
		if (dom && dom.length > 0)
			this.dom = dom;
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

	onDomEdit: function(mutList)
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
		let style;

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

		this.filterNode(doc.body);
	},

	filterNode: function(node)
	{
		let nodes, obj, i;

		if (this.disabled || !this.dom || !node || !node.parentElement || node.nodeType != node.ELEMENT_NODE)
			return;

		node = node.parentElement;

		i = 0;
		while (i < this.dom.length)
		{
			obj = this.dom[i++];
			if (!obj || !obj.sel)
				continue;

			nodes = node.querySelectorAll(obj.sel);
			ContentObserver.filterNodes(nodes, obj.attrs);
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
				this.destroy();
				break;
		}
	},

	destroy: function()
	{
		this.unreg();
		this.clear();
	}
};

ContentObserver.filterNodeAttrs = function(node, attrs)
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

ContentObserver.filterNodes = function(nodes, attrs)
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
				ContentObserver.filterNodeAttrs(node, attrs);
		}
		node = null;
	}
};

function init(event)
{
	let obs;

	removeEventListener("DOMContentLoaded", init);

	if (!event)
		return;

	obs = new ContentObserver();
	obs.filterDom(event.originalTarget);
}
addEventListener('DOMContentLoaded', init);
