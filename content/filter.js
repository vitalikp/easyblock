"use strict";

var EXPORTED_SYMBOLS = ["Process", "Content"];

const SCRIPT_CONTENT = "content.js";

const EVENT_TYPE = "EasyBlock";

const EVENT_TOGGLE = 1;
const EVENT_RELOAD = 2;
const EVENT_GET = 3;
const EVENT_DOM = 4;


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
		this.bus.sendEvent(EVENT_RELOAD);
	},

	get: function(data)
	{
		if (!data)
			return;

		switch (data.name)
		{
			case 'enabled':
				{
					let group;

					group = this.addon.getGroup(data.grpId);
					if (!group)
						return null;

					return group.enabled;
				}

			case 'disabled':
				return this.addon.disabled;
		}
	},

	findDom: function(data)
	{
		let site, eventData, grpId;

		if (!data)
			return;

		site = this.addon.findSite(data.hostname);
		if (!site || !site.hasDom)
			return;

		grpId = -1;
		if (site.group)
			grpId = site.group.id;

		eventData =
		{
			hostname: data.hostname,
			grpId: grpId,
			dom: site.dom,
			styles: site.styles
		};

		return eventData;
	},

	onEvent: function(event)
	{
		switch (event.type)
		{
			case EVENT_GET:
				return this.get(event.data);

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
		if (_cache && _cache.size > 0)
			_cache.clear();
		this.obs.clear();
	},

	get: function(name, data)
	{
		let res;

		if (!name)
			return;

		data = Object.assign({ name: name }, data);

		res = this.bus.sendSyncEvent(EVENT_GET, data);
		if (!res)
			return null;

		return res[0];
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
