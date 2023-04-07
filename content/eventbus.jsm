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
