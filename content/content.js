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

function ContentObserver()
{
	let filter = {};

	this.config = { childList: true, subtree: true };
	this.obs = null;
	this.grpId = 0;
	this.styles = [];
	this.dom = null;
	this.enabled = true;
	this._disabled = false;

	// import filter API
	Cu.import("chrome://easyblock/content/filter.js", filter);
	this.filter = new filter.Content(ContentAPI, this);

	addEventListener("DOMContentLoaded", this);
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

	clear: function()
	{
		this.unreg();
		this.grpId = 0;
		this.enabled = true;
		this._disabled = false;
		this.styles = [];
		this.dom = null;
	},

	reg: function(win, node)
	{
		if (this.obs || !win || !node)
			return;

		this.obs = new win.MutationObserver((mutList, obs) => this.onDomEdit(mutList));
		win.addEventListener("beforeunload", this);
		this.obs.observe(node, this.config);
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
		dom = data.dom;

		if (data.css && data.css.length > 0)
		{
			let style, i;

			this.styles = [];

			i = 0;
			while (i < data.css.length)
			{
				style = '<style type="text/css">';
				style += data.css[i++];
				style += '</style>';

				this.styles.push(style);
				doc.head.innerHTML += style;
			}
		}

		if (!dom || !dom.length)
			return;

		this.grpId = data.grpId;
		this.dom = dom;
		this.reg(doc.defaultView, doc.body);
		this.filterNode(doc.body);
	},

	filterDom: function(doc)
	{
		let loc, i;

		if (this.disabled || !this.filter)
			return;

		if (!doc || doc.nodeType != doc.DOCUMENT_NODE)
			return;

		loc = doc.location;
		if (loc.protocol != "https:" && loc.protocol != "http:")
			return;

		i = 0;
		while (i < this.styles.length)
			doc.head.innerHTML += this.styles[i++];

		if (this.dom)
		{
			this.reg(doc.defaultView, doc.body);
			this.filterNode(doc.body);
		}
		else
			this.filter.findDom(loc.hostname, (data) => this.onFind(doc, data));
	},

	onDomLoad: function(event)
	{
		if (!event)
			return;

		this.filterDom(event.originalTarget);
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

	filterNode: function(node)
	{
		let nodes, sel, i;

		if (this.disabled || !this.dom || !node || !node.parentElement || node.nodeType != node.ELEMENT_NODE)
			return;

		node = node.parentElement;

		i = 0;
		while (i < this.dom.length)
		{
			sel = this.dom[i++];
			if (!sel)
				continue;

			nodes = node.querySelectorAll(sel);
			this.filterNodes(nodes);
			nodes = null;
		}
	},

	filterNodes: function(nodes)
	{
		let i, node;

		if (!nodes || !nodes.length)
			return;

		i = 0;
		while (i < nodes.length)
		{
			node = nodes[i++];
			if (node && node.parentElement)
				node.parentElement.removeChild(node);
			node = null;
		}
	},

	handleEvent: function(event)
	{
		if (!event)
			return;

		switch (event.type)
		{
			case "DOMContentLoaded":
				this.onDomLoad(event);
				break;

			case "beforeunload":
				this.unreg();
				break;
		}
	}
};

function init(e)
{
	let obs;

	removeEventListener("load", init, true);

	obs = new ContentObserver();
}
addEventListener('load', init, true);