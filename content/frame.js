"use strict";

const Cu = Components.utils;


// import
Cu.import("chrome://easyblock/content/content.js");


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

handler = new SiteHandler(ContentAPI);
addEventListener("DOMContentLoaded", handler);
addEventListener("unload", handler); // once is ignored here
