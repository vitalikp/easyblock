"use strict";

var EXPORTED_SYMBOLS = ["Process", "Content"];

const SCRIPT_CONTENT = "content.js";

const EVENT_TYPE = "EasyBlock";

const EVENT_TOGGLE = 1;
const EVENT_RELOAD = 2;
const EVENT_DOM = 3;


// content data
let _cache = null;


function EventBus(name, api, handler)
{
	this.owner = EVENT_TYPE + ":" + name;
	this.api = api;
	this.handler = handler;
}

EventBus.prototype =
{
	regEvent: function(name)
	{
		this.api.regEvent(EVENT_TYPE + ":" + name, this);
	},

	sendEvent: function(type, data)
	{
		this.api.sendEvent(this.owner, { type: type, data: data });
	},

	sendSyncEvent: function(type, data)
	{
		return this.api.sendSyncEvent(this.owner, { type: type, data: data });
	},

	receiveMessage: function(msg)
	{
		if (!msg || this.owner == msg.name)
			return;

		return this.handler.onEvent(msg.data);
	}
}

function Process(api, addon)
{
	this.api = api;
	this.addon = addon;

	this.api.loadScript(SCRIPT_CONTENT);
	this.bus = new EventBus("process", api, this);
	this.bus.regEvent("content");
}

Process.prototype =
{
	toggle: function(value, grpId)
	{
		this.bus.sendEvent(EVENT_TOGGLE, { grpId: grpId, value: value });
	},

	reload: function()
	{
		this.bus.sendEvent(EVENT_RELOAD, {});
	},

	findDom: function(data)
	{
		let site, eventData;

		if (!data)
			return;

		site = this.addon.findSite(data.hostname);
		if (!site || !site.hasDom)
			return;

		eventData =
		{
			hostname: data.hostname,
			grpId: site.grpId,
			dom: site.dom,
			css: site.css
		};

		return eventData;
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

	this.bus = new EventBus("content", api, this);
	this.bus.regEvent("process");
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
			data = this.bus.sendSyncEvent(EVENT_DOM, { hostname: hostname });
			if (!data || !data[0])
				return;

			data = data[0];

			if (data.hostname != hostname)
				return;

			_cache.set(data.hostname, data);
		}

		onFind(data);
	},

	onEvent: function(event)
	{
		switch (event.type)
		{
			case EVENT_TOGGLE:
				this.obs.toggle(event.data);
				break;

			case EVENT_RELOAD:
				this.clear();
				break;
		}
	}
};
