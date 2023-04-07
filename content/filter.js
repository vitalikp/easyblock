"use strict";

var EXPORTED_SYMBOLS = ["EventType", "EventBus", "Process"];

const EVENT_TYPE = "EasyBlock";

const EventType =
{
	TOGGLE: 1,
	RELOAD: 2,
	GET: 3,
	DOM: 4
};


function EventBus(name)
{
	this.owner = EVENT_TYPE + ":" + name;
}

EventBus.prototype =
{
	_regEvent(type, handler)
	{
		throw new Error("Method not implemented");
	},

	_unregEvent(type, handler)
	{
		throw new Error("Method not implemented");
	},

	_sendEvent(type, data)
	{
		throw new Error("Method not implemented");
	},

	_sendSyncEvent(type, data)
	{
		throw new Error("Method not implemented");
	},

	regEvent(name)
	{
		this._regEvent(EVENT_TYPE + ":" + name, this);
	},

	unregEvent(name)
	{
		this._unregEvent(EVENT_TYPE + ":" + name, this);
	},

	sendEvent(type, data)
	{
		this._sendEvent(this.owner, { type: type, data: data });
	},

	sendSyncEvent(type, data)
	{
		return this._sendSyncEvent(this.owner, { type: type, data: data });
	},

	onEvent(event)
	{
		throw new Error("Method not implemented");
	},

	receiveMessage(msg)
	{
		if (!msg || this.owner == msg.name)
			return;

		return this.onEvent(msg.data);
	}
}

function Process(api, addon)
{
	EventBus.call(this, "process");
	this.api = api;
	this.addon = addon;

	this.regEvent("content");
}

Process.prototype = Object.create(EventBus.prototype);
Object.assign(Process.prototype,
{
	_regEvent(type, handler)
	{
		this.api.regEvent(type, handler);
	},

	_unregEvent(type, handler)
	{
		this.api.unregEvent(type, handler);
	},

	_sendEvent(type, data)
	{
		this.api.sendEvent(type, data);
	},

	toggle(value, grpId)
	{
		this.sendEvent(EventType.TOGGLE, { grpId: grpId, value: value });
	},

	reload()
	{
		this.sendEvent(EventType.RELOAD);
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
	},

	destroy()
	{
		this.unregEvent("content");
	}
});
