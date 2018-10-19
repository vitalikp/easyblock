"use strict";

const Ci = Components.interfaces;
const Cu = Components.utils;
const Cc = Components.classes;
const Cr = Components.results;

const EXPORTED_SYMBOLS = ["EasyBlock"];

// import
Cu.import("chrome://easyblock/content/io.jsm");
Cu.import("chrome://easyblock/content/bldb.jsm");


const os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);


const OBS_REQ = "http-on-modify-request";
const OBS_RESP = "http-on-examine-response";


var EasyBlock =
{
	db: {},
	disabled: false,

	startup: function(addonData)
	{
		EasyBlock.observer.reg(os);

		this.db = bldb.create('blacklist.txt');

		io.log("easyblock " + addonData.version + " started!");
	},

	shutdown: function()
	{
		EasyBlock.observer.unreg(os);

		this.db.close();
	},

	enable: function(cb)
	{
		if (!this.disabled || !cb)
			return;

		this.disabled = false;
		cb(this.disabled);
		io.log("Enable 'EasyBlock' addon...");
	},

	block: function(subject)
	{
		subject.loadFlags = Ci.nsICachingChannel.LOAD_ONLY_FROM_CACHE;
		subject.cancel(Cr.NS_BINDING_ABORTED);
	},

	print: function(doc, elem)
	{
		this.db.print(doc, elem);
	},

	observer:
	{
		reg: function(obs)
		{
			if (!obs)
				return;

			io.log("reg '" + OBS_REQ + "' observer handler");
			obs.addObserver(this, OBS_REQ, false);

			io.log("reg '" + OBS_RESP + "' observer handler");
			obs.addObserver(this, OBS_RESP, false);
		},

		unreg: function(obs)
		{
			if (!obs)
				return;

			io.log("unreg '" + OBS_REQ + "' observer handler");
			obs.removeObserver(this, OBS_REQ, false);

			io.log("unreg '" + OBS_RESP + "' observer handler");
			obs.removeObserver(this, OBS_RESP, false);
		},

		observe: function(subject, topic, data)
		{
			if (EasyBlock.disabled)
				return;

			if (topic != OBS_REQ && topic != OBS_RESP)
				return;

			let type = '?';
			let url, site;

			if (topic == OBS_RESP)
				type = subject.contentType;

			subject.QueryInterface(Ci.nsIHttpChannel);

			url = bldb.parse(subject.URI.spec);
			if (!url)
				return;

			site = bldb.find(url);
			if (!site)
				return;

			site.block(EasyBlock.block, subject);
		}
	}
};
