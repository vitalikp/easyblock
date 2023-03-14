"use strict";

var EXPORTED_SYMBOLS = ["Process", "Content"];

const EVENT_TYPE = "EasyBlock";

const EventType =
{
	TOGGLE: 1,
	RELOAD: 2,
	GET: 3,
	DOM: 4
};


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
	regEvent(name)
	{
		this.api.regEvent(EVENT_TYPE + ":" + name, this);
	},

	sendEvent(type, data)
	{
		this.api.sendEvent(this.owner, { type: type, data: data });
	},

	sendSyncEvent(type, data)
	{
		return this.api.sendSyncEvent(this.owner, { type: type, data: data });
	},

	receiveMessage(msg)
	{
		if (!msg || this.owner == msg.name)
			return;

		return this.handler.onEvent(msg.data);
	}
}

function Process(api, addon)
{
	EventBus.call(this, "process", api, this);
	this.api = api;
	this.addon = addon;

	this.bus = new EventBus("process", api, this);
	this.bus.regEvent("content");
}

Process.prototype = Object.create(EventBus.prototype);
Object.assign(Process.prototype,
{
	toggle(value, grpId)
	{
		this.bus.sendEvent(EventType.TOGGLE, { grpId: grpId, value: value });
	},

	reload()
	{
		this.bus.sendEvent(EventType.RELOAD);
	},

	get(data)
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

	findDom(data)
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
			content: site.content,
			styles: site.styles,
			scripts: site.scripts
		};

		return eventData;
	},

	onEvent(event)
	{
		switch (event.type)
		{
			case EventType.GET:
				return this.get(event.data);

			case EventType.DOM:
				return this.findDom(event.data);
		}
	}
});

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
	reload()
	{
		if (_cache && _cache.size > 0)
			_cache.clear();
		this.obs.reload();
	},

	get(name, data)
	{
		let res;

		if (!name)
			return;

		data = Object.assign({ name: name }, data);

		res = this.bus.sendSyncEvent(EventType.GET, data);
		if (!res)
			return null;

		return res[0];
	},

	findDom(hostname, onFind)
	{
		let data;

		if (!onFind)
			return;

		data = _cache.get(hostname);
		if (!data)
		{
			data = this.bus.sendSyncEvent(EventType.DOM, { hostname: hostname });
			if (!data || !data[0])
				return;

			data = data[0];

			if (data.hostname != hostname)
				return;

			_cache.set(data.hostname, data);
		}
		else
		{
			if (!this.get('enabled', { grpId: data.grpId }))
				return;
		}

		onFind(data);
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
	}
};
