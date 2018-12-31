"use strict";

const Ci = Components.interfaces;
const Cu = Components.utils;
const Cc = Components.classes;
const Cr = Components.results;

const EXPORTED_SYMBOLS = ["EasyBlock"];

// import
Cu.import("resource://gre/modules/Services.jsm");

Cu.import("chrome://easyblock/content/io.jsm");
Cu.import("chrome://easyblock/content/ui.jsm");
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
		var windows;

		EasyBlock.observer.reg(os);

		this.db = bldb.create('blacklist.txt', ui.onLoadDB);

		windows = Services.wm.getEnumerator("navigator:browser");

		while (windows.hasMoreElements())
			this.loadWindow(windows.getNext().QueryInterface(Ci.nsIDOMWindow));
		Services.ww.registerNotification(this.watchWindow);

		ui.loadCss("easyblock");
		io.log("easyblock " + addonData.version + " started!");
	},

	shutdown: function()
	{
		EasyBlock.observer.unreg(os);

		this.db.close();

		Services.ww.unregisterNotification(this.watchWindow);

		ui.unloadCss("easyblock");
	},

	loadWindow: function(window)
	{
		if (!window)
			return;

		ui.init(window, EasyBlock);
		window.addEventListener("aftercustomization", ui.customize, false);
	},

	watchWindow: function(window, topic)
	{
		let listener;

		if (topic != "domwindowopened")
			return;

		listener = (event) =>
		{
			window.removeEventListener("load", listener, false);
			ui.init(window, EasyBlock);
		};
		window.addEventListener("load", listener, false);
	},

	toggle: function(value)
	{
		if (this.disabled == value)
			return false;

		this.disabled = value;
		if (!value)
			io.log("Enable 'EasyBlock' addon...");
		else
			io.log("Disable 'EasyBlock' addon...");

		return true;
	},

	reload: function(onLoad)
	{
		this.db.close();
		this.db.load(onLoad);
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

			switch (topic)
			{
				case OBS_REQ:
					EasyBlock.db.blockReq(subject);
					return;

				case OBS_RESP:
					EasyBlock.db.blockResp(subject);
					return;
			}
		}
	}
};
