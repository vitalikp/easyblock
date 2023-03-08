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
const gmm = Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIMessageBroadcaster);


const ADDON_PREF = "extensions.easyblock.";

const OBS_REQ = "http-on-modify-request";
const OBS_RESP = "http-on-examine-response";
const OBS_WIN_OPEN = "domwindowopened";

const TYPE_DOC = Ci.nsIContentPolicy.TYPE_DOCUMENT;

const CONTENT_SCRIPT = "chrome://easyblock/content/content.js";

const ProcessAPI =
{
	regEvent(event, handler)
	{
		gmm.addMessageListener(event, handler);
	},

	sendEvent(event, data)
	{
		gmm.broadcastAsyncMessage(event, data);
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
			log.info("Enable 'EasyBlock' addon...");
		else
			log.info("Disable 'EasyBlock' addon...");
	},

	startup(addonData)
	{
		var windows, defprefs;

		gmm.loadFrameScript(CONTENT_SCRIPT, true);

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
		defprefs = ps.getDefaultBranch(ADDON_PREF);
		defprefs.setBoolPref('disabled', false);

		this.prefs = ps.getBranch(ADDON_PREF);

		// restore pref options from prefs store
		this.disabled = this.prefs.getBoolPref('disabled');

		windows = Services.wm.getEnumerator("navigator:browser");

		while (windows.hasMoreElements())
			this.loadWindow(windows.getNext().QueryInterface(Ci.nsIDOMWindow));
		EasyBlock.observer.reg(os, OBS_WIN_OPEN);

		ui.loadCss("easyblock");
		log.info("easyblock " + addonData.version + " started!");
	},

	shutdown()
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

	loadWindow(window)
	{
		let winUI;

		if (!window && !window.document)
			return;

		if (!window.locationbar.visible)
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

	watchWindow(window)
	{
		let listener;

		listener = (event) =>
		{
			window.removeEventListener("load", listener, false);
			this.loadWindow(window);
		};
		window.addEventListener("load", listener, false);
	},

	customizeUI(toolbox)
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

	loadDBWin(winUI, db)
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

	unloadWin(winUI)
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

	toggle(value, grpId)
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

	getGroup(grpId)
	{
		if (!this.db)
			return;

		return this.db.get(grpId);
	},

	findSite(hostname, path)
	{
		if (!hostname || !this.db)
			return;

		return this.db.find(hostname, path);
	},

	reload()
	{
		this.db.clear();
		this.filter.reload();
		this.db.load((db) =>
		{
			this.wins.forEach((winUI) => this.loadDBWin(winUI, db));
			ui.notify(this, 'Blacklist sites reloaded!');
		});
	},

	setReqUA(req)
	{
		let type, origin, dn, ua;

		if (!req || !req.URI)
			return;

		type = req.loadInfo && req.loadInfo.externalContentPolicyType;

		if (type != TYPE_DOC && req.referrer)
		{
			dn = req.referrer.host;

			try
			{
				origin = req.getRequestHeader("Origin");
				if (origin)
					dn = io.newURI(origin).host;
			}
			catch (e)
			{
				
			}
		}
		else
			dn = req.URI.host;

		ua = this.db.findUA(dn);
		if (!ua)
			return;

		req.setRequestHeader("User-Agent", ua, false);
	},

	blockHttp(req, isResp)
	{
		let type, site;

		if (this.disabled || !req)
			return;

		req.QueryInterface(Ci.nsIHttpChannel);

		if (isResp)
			type = req.contentType;
		else
			this.setReqUA(req);

		if (!req.URI)
			return;

		site = this.findSite(req.URI.host, req.URI.path);
		if (!site)
			return;

		if (site.hasRules)
		{
			if (!site.hasType(type) && !site.hasPath(req.URI.path))
				return;
		}

		req.cancel(Cr.NS_BINDING_ABORTED);

		site.onBlock();
	},

	print(doc, elem)
	{
		this.db.print(doc, elem);
	},

	observer:
	{
		reg(obs, topic)
		{
			if (!obs || !topic)
				return;

			log.info("reg '" + topic + "' observer handler");
			obs.addObserver(this, topic, false);
		},

		unreg(obs, topic)
		{
			if (!obs || !topic)
				return;

			log.info("unreg '" + topic + "' observer handler");
			obs.removeObserver(this, topic, false);
		},

		observe(subject, topic, data)
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
