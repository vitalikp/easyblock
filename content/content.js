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
	this.config = { childList: true, subtree: true };
	this.obs = null;
	this.dom = null;
	this.disabled = false;
}

ContentObserver.prototype =
{
	clear: function()
	{
		this.unreg();
		this.disabled = false;
		this.dom = null;
	},

	reg: function(win, node)
	{
		if (this.obs || !win || !node)
			return;

		this.obs = new win.MutationObserver((mutList, obs) => this.onDomEdit(mutList));
		win.addEventListener("beforeunload", (event) => this.unreg());
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
		if (!dom || !dom.length)
			return;

		this.dom = dom;
		this.reg(doc.defaultView, doc.body);
		this.filterNode(doc.body);
	},

	onDomLoad: function(event, content)
	{
		let doc, loc;

		if (this.disabled || !event || !content)
			return;

		doc = event.originalTarget;
		if (!doc || doc.nodeType != doc.DOCUMENT_NODE)
			return;

		loc = doc.location;
		if (loc.protocol != "https:" && loc.protocol != "http:")
			return;

		if (this.dom)
		{
			this.reg(doc.defaultView, doc.body);
			this.filterNode(doc.body);
		}
		else
			content.findDom(loc.hostname, (data) => this.onFind(doc, data));
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
	}
};

function init(e)
{
	let filter = {}, obs, content;

	removeEventListener("load", init, true);

	obs = new ContentObserver();

	// import filter API
	Cu.import("chrome://easyblock/content/filter.js", filter);
	content = new filter.Content(ContentAPI, obs);

	addEventListener("DOMContentLoaded", (event) => obs.onDomLoad(event, content));
}
addEventListener('load', init, true);