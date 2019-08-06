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
	this.dom = null;
}

ContentObserver.prototype =
{
	clear: function()
	{
		this.dom = null;
	},

	onFind: function(doc, dom)
	{
		if (!doc || !dom || !dom.length)
			return;

		this.dom = dom;
		this.filterNode(doc.body);
	},

	onDomLoad: function(event, content)
	{
		let doc, loc;

		if (!event || !content)
			return;

		doc = event.originalTarget;
		if (!doc || doc.nodeType != doc.DOCUMENT_NODE)
			return;

		loc = doc.location;
		if (loc.protocol != "https:" && loc.protocol != "http:")
			return;

		if (this.dom)
			this.filterNode(doc.body);
		else
			content.findDom(loc.hostname, (dom) => this.onFind(doc, dom));
	},

	filterNode: function(node)
	{
		let nodes, sel, i;

		if (!this.dom || !node || !node.parentElement || node.nodeType != node.ELEMENT_NODE)
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