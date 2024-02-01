"use strict";

var EXPORTED_SYMBOLS = ["EventType", "EventBus", "Content"];

const EVENT_TYPE = "EasyBlock";

const EventType =
{
	TOGGLE: 1,
	RELOAD: 2,
	GET: 3,
	DOM: 4
};


function EventBus(name, api)
{
	this.owner = EVENT_TYPE + ":" + name;
	this.api = api;
}

EventBus.prototype =
{
	_sendEvent(type, data)
	{
		throw new Error("Method not implemented");
	},

	regEvent(name)
	{
		this.api.regEvent(EVENT_TYPE + ":" + name, this);
	},

	unregEvent(name)
	{
		this.api.unregEvent(EVENT_TYPE + ":" + name, this);
	},

	sendEvent(type, data)
	{
		this.api.sendEvent(this.owner, { type: type, data: data });
	},

	sendSyncEvent(type, data)
	{
		return this.api.sendSyncEvent(this.owner, { type: type, data: data });
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

function Content(api, obs)
{
	EventBus.call(this, "content", api);

	this.api = api;
	this.obs = obs;

	this.regEvent("process");
}

Content.prototype = Object.create(EventBus.prototype);
Object.assign(Content.prototype,
{
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
