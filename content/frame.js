"use strict";

const Cu = Components.utils;


// import
Cu.import("chrome://easyblock/content/content.js");

const global = this;


const ContentAPI =
{
	regEvent(event, handler)
	{
		addMessageListener(event, handler);
	},

	unregEvent(event, handler)
	{
		removeMessageListener(event, handler);
	},

	sendSyncEvent(event, data)
	{
		return sendSyncMessage(event, data);
	}
};


let handler;

handler = new SiteHandler(ContentAPI, global);
addEventListener("DOMWindowCreated", handler);
addEventListener("DOMContentLoaded", handler);
addEventListener("unload", handler); // once is ignored here
