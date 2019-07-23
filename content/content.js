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

const ContentFilter =
{
	filter: null,

	init: function(filter)
	{
		this.filter = filter;
	},

	_rmNodes: function(nodes)
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

	_rm: function(node, dom)
	{
		let nodes, sel, i;

		if (!node || !dom || !dom.length)
			return;

		i = 0;
		while (i < dom.length)
		{
			sel = dom[i++];
			if (!sel)
				continue;

			nodes = node.querySelectorAll(sel);
			this._rmNodes(nodes);
			nodes = null;
		}
	},

	filterDom: function(doc)
	{
		let loc, data;

		if (!this.filter || !doc || doc.nodeType != doc.DOCUMENT_NODE)
			return;

		loc = doc.location;
		if (loc.protocol != "https:" && loc.protocol != "http:")
			return;

		data = this.filter.findDom(loc.hostname);
		if (!data)
			return;

		if (data.hostname != doc.location.hostname)
			return;

		this._rm(doc, data.dom);
	}
};

function init(e)
{
	let filter = {};

	removeEventListener("load", init, true);

	// import filter API
	Cu.import("chrome://easyblock/content/filter.js", filter);
	ContentFilter.init(new filter.Content(ContentAPI));

	addEventListener("DOMContentLoaded", (event) =>
	{
		if (!event)
			return;

		ContentFilter.filterDom(event.originalTarget);
	});
}
addEventListener('load', init, true);