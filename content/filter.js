"use strict";

var EXPORTED_SYMBOLS = ["Process", "Content"];

const SCRIPT_CONTENT = "content.js";

const EVENT_RELOAD = "EasyBlock:reload";
const EVENT_FILTER = "EasyBlock:filter";
const EVENT_DOM = "EasyBlock:DOM";


// content data
let _cache = null;


function Process(api, addon)
{
	this.api = api;
	this.addon = addon;

	this.api.loadScript(SCRIPT_CONTENT);
	this.api.regEvent(EVENT_DOM, this);
}

Process.prototype =
{
	reload: function()
	{
		this.api.sendEvent(EVENT_RELOAD, {});
	},

	findDom: function(data)
	{
		let site;

		if (!data)
			return;

		site = this.addon.findSite(data.hostname);
		if (!site || !site.hasDom)
			return;

		return { hostname: data.hostname, dom: site.dom };
	},

	receiveMessage: function(msg)
	{
		if (!msg || !msg.name)
			return;

		switch (msg.name)
		{
			case EVENT_DOM:
				return this.findDom(msg.data);
		}
	}
};

function Content(api)
{
	if (!_cache)
		_cache = new Map();

	this.api = api;

	this.api.regEvent(EVENT_RELOAD, this);
}

Content.prototype =
{
	clear: function()
	{
		if (!_cache || !_cache.size)
			return;

		_cache.clear();
	},

	findDom: function(hostname)
	{
		let data;

		data = _cache.get(hostname);
		if (!data)
		{
			data = this.api.sendSyncEvent(EVENT_DOM, { hostname: hostname });
			if (!data || !data[0])
				return;

			data = data[0];
			_cache.set(data.hostname, data);
		}

		return data;
	},

	receiveMessage: function(msg)
	{
		if (!msg || !msg.name)
			return;

		switch (msg.name)
		{
			case EVENT_RELOAD:
				this.clear();
				break;
		}
	}
};
