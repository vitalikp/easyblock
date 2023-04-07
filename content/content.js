"use strict";

const Cu = Components.utils;


var EXPORTED_SYMBOLS = ["SiteHandler"];

// import filter API
Cu.import("chrome://easyblock/content/filter.js");


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
		win.addEventListener("beforeunload", this);
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
		let win;

		if (!event || !event.target)
			return;

		win = event.target.defaultView;
		if (!win)
			return;

		switch (event.type)
		{
			case "beforeunload":
				win.removeEventListener("beforeunload", this);
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

function Content(api, obs)
{
	EventBus.call(this, "content");

	this.api = api;
	this.obs = obs;

	this.regEvent("process");
}

Content.prototype = Object.create(EventBus.prototype);
Object.assign(Content.prototype,
{
	_regEvent(type, handler)
	{
		this.api.regEvent(type, handler);
	},

	_unregEvent(type, handler)
	{
		this.api.unregEvent(type, handler);
	},

	_sendSyncEvent(type, data)
	{
		return this.api.sendSyncEvent(type, data);
	},

	reload()
	{
		this.obs.reload();
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

	findDom(hostname, onFind)
	{
		let data;

		data = this.sendSyncEvent(EventType.DOM, { hostname: hostname });
		if (!data || !data[0])
			return;

		data = data[0];

		if (data.hostname != hostname)
			return;

		return data;
	},

	onEvent(event)
	{
		switch (event.type)
		{
			case EventType.TOGGLE:
				this.obs.toggle(event.data);
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

function SiteHandler(api)
{
	this._disabled = false;
	this.site = null;
	this.frames = new Map();

	if (!_cache)
		_cache = new Map();

	this._filter = new Content(api, this);

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
		if (_cache && _cache.size > 0)
			_cache.clear();

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

		site.filter(doc);
	},

	findDom(hostname, onFind)
	{
		let data;

		if (!onFind)
			return;

		data = _cache.get(hostname);
		if (!data)
		{
			data = this._filter.findDom(hostname);
			if (!data)
				return;

			_cache.set(hostname, data);
		}
		else
		{
			if (!this._filter.get('enabled', { grpId: data.grpId }))
				return;
		}

		onFind(data);
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

		site = this.site;
		if (!site || site.hostname != loc.hostname)
		{
			if (doc.defaultView.top == doc.defaultView.self) // doc is root site
			{
				this.findDom(loc.hostname, (data) => this.onFind(doc, data));
				return;
			}

			site = this.frames.get(loc.hostname); // doc is frame site
			if (!site || site.hostname != loc.hostname)
			{
				this.findDom(loc.hostname, (data) => this.onFind(doc, data, true));
				return;
			}
		}

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
			case "DOMContentLoaded":
				this.filterDom(target);
				break;

			case "unload":
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
