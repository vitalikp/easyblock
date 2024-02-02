"use strict";

var EXPORTED_SYMBOLS = ["EventType", "EventBus"];

const EVENT_TYPE = "EasyBlock";

const EventType =
{
	TOGGLE: 1,
	RELOAD: 2,
	GET: 3,
	DOM: 4
};


function EventBus(name, api, mm)
{
	this.owner = EVENT_TYPE + ":" + name;
	this.api = api;
	this.mm = mm;
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