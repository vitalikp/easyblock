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
	},

	onEvent: function(event)
	{
		switch (event.type)
		{
			case EVENT_DOM:
				return this.findDom(event.data);
		}
	}
};

function Content(api, obs)
{
	if (!_cache)
		_cache = new Map();

	this.api = api;
	this.obs = obs;

	this.api.regEvent(EVENT_RELOAD, this);
}

Content.prototype =
{
	clear: function()
	{
		if (!_cache || !_cache.size)
			return;

		_cache.clear();
		this.obs.clear();
	},

	findDom: function(hostname, onFind)
	{
		let data;

		if (!onFind)
			return;

		data = _cache.get(hostname);
		if (!data)
		{
			data = this.api.sendSyncEvent(EVENT_DOM, { hostname: hostname });
			if (!data || !data[0])
				return;

			data = data[0];

			if (data.hostname != hostname)
				return;

			_cache.set(data.hostname, data);
		}

		onFind(data.dom);
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
	},

	onEvent: function(event)
	{
		switch (event.type)
		{
			case EVENT_RELOAD:
				this.clear();
				break;
		}
	}
};
