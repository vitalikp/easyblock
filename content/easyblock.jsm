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
const OBS_WIN_OPEN = "domwindowopened"


const ProcessAPI =
{
	loadScript: function(name)
	{
		Services.mm.loadFrameScript("chrome://easyblock/content/" + name, true);
	},

	regEvent: function(event, handler)
	{
		Services.mm.addMessageListener(event, handler);
	},

	sendEvent: function(event, data)
	{
		Services.mm.broadcastAsyncMessage(event, data);
	}
};

var EasyBlock =
{
	db: {},
	_disabled: false,
	prefs: {},
	filter: null,

	get disabled()
	{
		return this._disabled;
	},

	set disabled(value)
	{
		if (this._disabled == value)
			return;

		this.prefs.setBoolPref('disabled', value);

		this.filter.toggle(value);

		if (!value)
			io.log("Enable 'EasyBlock' addon...");
		else
			io.log("Disable 'EasyBlock' addon...");

		this._disabled = value;
	},

	startup: function(addonData)
	{
		var windows, defprefs;

		EasyBlock.observer.reg(os, OBS_REQ);
		EasyBlock.observer.reg(os, OBS_RESP);

		this.db = bldb.create('blacklist.txt', ui.onLoadDB);

		// init default prefs
		defprefs = Services.prefs.getDefaultBranch("extensions.easyblock.");
		defprefs.setBoolPref('disabled', false);

		this.prefs = Services.prefs.getBranch("extensions.easyblock.");

		// restore pref options from prefs store
		this.disabled = this.prefs.getBoolPref('disabled');

		windows = Services.wm.getEnumerator("navigator:browser");

		while (windows.hasMoreElements())
			this.loadWindow(windows.getNext().QueryInterface(Ci.nsIDOMWindow));
		EasyBlock.observer.reg(os, OBS_WIN_OPEN);

		ui.loadCss("easyblock");
		io.log("easyblock " + addonData.version + " started!");

		if (!this.filter)
		{
			let filter = {};

			// import filter API
			Cu.import("chrome://easyblock/content/filter.js", filter);
			this.filter = new filter.Process(ProcessAPI, this);
		}
	},

	shutdown: function()
	{
		EasyBlock.observer.unreg(os, OBS_REQ);
		EasyBlock.observer.unreg(os, OBS_RESP);
		EasyBlock.observer.unreg(os, OBS_WIN_OPEN);

		this.db.close();

		ui.unloadCss("easyblock");
	},

	loadWindow: function(window)
	{
		if (!window)
			return;

		ui.init(window, EasyBlock);
	},

	watchWindow: function(window)
	{
		let listener;

		listener = (event) =>
		{
			window.removeEventListener("load", listener, false);
			ui.init(window, EasyBlock);
		};
		window.addEventListener("load", listener, false);
	},

	toggle: function(value, grpId)
	{
		if (grpId > 0)
		{
			let group;

			group = this.db.get(grpId);
			if (!group)
				return;

			if (group.toggle(value))
			{
				this.filter.toggle(value, grpId);
				ui.wins.forEach((winUI) => winUI.updateGroup(group));
			}

			return;
		}

		if (this.disabled == value)
			return;

		this.disabled = value;
		ui.wins.forEach((winUI) => winUI.updateState(this));
	},

	findSite: function(hostname)
	{
		if (!hostname || !this.db)
			return;

		return this.db.find(hostname);
	},

	reload: function(onLoad)
	{
		this.filter.reload();
		this.db.load(onLoad);
	},

	blockHttp: function(req, isResp)
	{
		let type, site;

		if (this.disabled || !req)
			return;

		req.QueryInterface(Ci.nsIHttpChannel);

		if (isResp)
			type = req.contentType;

		if (!req.URI)
			return;

		site = this.findSite(req.URI.host);
		if (!site)
			return;

		if (site.hasRules)
		{
			if (!site.hasType(type) && !site.hasPath(req.URI.path))
				return;
		}

		req.loadFlags = Ci.nsICachingChannel.LOAD_ONLY_FROM_CACHE;
		req.cancel(Cr.NS_BINDING_ABORTED);

		site.onBlock();
	},

	print: function(doc, elem)
	{
		this.db.print(doc, elem);
	},

	observer:
	{
		reg: function(obs, topic)
		{
			if (!obs || !topic)
				return;

			io.log("reg '" + topic + "' observer handler");
			obs.addObserver(this, topic, false);
		},

		unreg: function(obs, topic)
		{
			if (!obs || !topic)
				return;

			io.log("unreg '" + topic + "' observer handler");
			obs.removeObserver(this, topic, false);
		},

		observe: function(subject, topic, data)
		{
			switch (topic)
			{
				case OBS_REQ:
					EasyBlock.blockHttp(subject);
					return;

				case OBS_RESP:
					EasyBlock.blockHttp(subject, true);
					return;

				case OBS_WIN_OPEN:
					EasyBlock.watchWindow(subject);
					return;
			}
		}
	}
};
