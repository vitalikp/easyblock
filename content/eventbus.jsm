"use strict";

const Ci = Components.interfaces;
const Cc = Components.classes;

var EXPORTED_SYMBOLS = ["EventType", "EventBus"];

const cpmm = Cc["@mozilla.org/childprocessmessagemanager;1"].getService(Ci.nsISyncMessageSender);


const EVENT_TYPE = "EasyBlock";

const EventType =
{
	TOGGLE: 1,
	RELOAD: 2,
	GET: 3,
	DOM: 4
};


function EventBus(name, mm = cpmm)
{
	this.owner = EVENT_TYPE + ":" + name;
	this.mm = mm;
}

EventBus.prototype =
{
	_sendEvent(type, data)
	{
		this.mm.sendAsyncMessage(type, data);
	},

	regEvent(name)
	{
		this.mm.addMessageListener(EVENT_TYPE + ":" + name, this);
	},

	unregEvent(name)
	{
		this.mm.removeMessageListener(EVENT_TYPE + ":" + name, this);
	},

	sendEvent(type, data)
	{
		this._sendEvent(this.owner, { type, data });
	},

	sendSyncEvent(type, data)
	{
		return this.mm.sendSyncMessage(this.owner, { type, data });
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