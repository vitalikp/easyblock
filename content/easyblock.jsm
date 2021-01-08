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
const ps = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);


const OBS_REQ = "http-on-modify-request";
const OBS_RESP = "http-on-examine-response";
const OBS_WIN_OPEN = "domwindowopened";


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
	wins: [],

	get disabled()
	{
		return this._disabled;
	},

	set disabled(value)
	{
		if (this._disabled == value)
			return;

		this._disabled = value;

		this.prefs.setBoolPref('disabled', value);

		this.filter.toggle(value);

		this.wins.forEach((winUI) => winUI.updateState(this));

		if (!value)
			io.log("Enable 'EasyBlock' addon...");
		else
			io.log("Disable 'EasyBlock' addon...");
	},

	startup: function(addonData)
	{
		var windows, defprefs;

		if (!this.filter)
		{
			let filter = {};

			// import filter API
			Cu.import("chrome://easyblock/content/filter.js", filter);
			this.filter = new filter.Process(ProcessAPI, this);
		}

		EasyBlock.observer.reg(os, OBS_REQ);
		EasyBlock.observer.reg(os, OBS_RESP);

		this.db = new bldb('blacklist.txt');
		this.db.load((db) =>
		{
			this.wins.forEach((winUI) => this.loadDBWin(winUI, db));
		});

		// init default prefs
		defprefs = ps.getDefaultBranch("extensions.easyblock.");
		defprefs.setBoolPref('disabled', false);

		this.prefs = ps.getBranch("extensions.easyblock.");

		// restore pref options from prefs store
		this.disabled = this.prefs.getBoolPref('disabled');

		windows = Services.wm.getEnumerator("navigator:browser");

		while (windows.hasMoreElements())
			this.loadWindow(windows.getNext().QueryInterface(Ci.nsIDOMWindow));
		EasyBlock.observer.reg(os, OBS_WIN_OPEN);

		ui.loadCss("easyblock");
		io.log("easyblock " + addonData.version + " started!");
	},

	shutdown: function()
	{
		let i;

		i = 0;
		while (i < this.wins.length)
			this.wins[i++].destroy();
		this.wins = [];

		EasyBlock.observer.unreg(os, OBS_REQ);
		EasyBlock.observer.unreg(os, OBS_RESP);
		EasyBlock.observer.unreg(os, OBS_WIN_OPEN);

		this.db.close();

		ui.unloadCss("easyblock");
	},

	loadWindow: function(window)
	{
		let winUI;

		if (!window && !window.document)
			return;

		winUI = new WinUI(window.document, this);
		window.addEventListener("aftercustomization", (event) =>
		{
			if (!event)
				return;

			this.customizeUI(event.target);
		});

		this.wins.push(winUI);
	},

	watchWindow: function(window)
	{
		let listener;

		listener = (event) =>
		{
			window.removeEventListener("load", listener, false);
			this.loadWindow(window);
		};
		window.addEventListener("load", listener, false);
	},

	customizeUI: function(toolbox)
	{
		let winUI, i;

		if (!toolbox)
			return;

		WinUI.customize(toolbox);

		i = 0;
		while (i < this.wins.length)
		{
			winUI = this.wins[i++];
			winUI.moveBtn(WinUI.toolbarId, WinUI.nextItemId);
		}
	},

	loadDBWin: function(winUI, db)
	{
		let group, grp, i;

		if (!winUI || !db)
			return;

		winUI.clearGroups();

		i = 0;
		while (i < db.groups.length)
		{
			group = db.groups[i++];
			if (group.hidden)
				continue;

			grp =
			{
				id: group.id,
				name: group.name,
				enabled: group.enabled
			};

			winUI.addGroup(grp);
		}
	},

	unloadWin: function(winUI)
	{
		let i;

		if (!winUI)
			return;

		i = this.wins.indexOf(winUI);
		if (i >= 0)
		{
			this.wins[i].destroy();
			this.wins.splice(i, 1);
		}
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
				this.wins.forEach((winUI) => winUI.updateGroup(group));
			}

			return;
		}

		this.disabled = value;
	},

	getGroup: function(grpId)
	{
		if (!this.db)
			return;

		return this.db.get(grpId);
	},

	findSite: function(hostname, path)
	{
		if (!hostname || !this.db)
			return;

		return this.db.find(hostname, path);
	},

	reload: function()
	{
		this.db.clear();
		this.filter.reload();
		this.db.load((db) =>
		{
			this.wins.forEach((winUI) => this.loadDBWin(winUI, db));
			ui.notify(this, 'Blacklist sites reloaded!');
		});
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

		site = this.findSite(req.URI.host, req.URI.path);
		if (!site)
			return;

		if (site.hasRules)
		{
			if (site.ua)
				req.setRequestHeader("User-Agent", site.ua, false);

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
