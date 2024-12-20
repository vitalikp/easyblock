"use strict";

const Ci = Components.interfaces;
const Cu = Components.utils;
const Cc = Components.classes;
const Cr = Components.results;

const EXPORTED_SYMBOLS = ["EasyBlock"];

// import
Cu.import("chrome://easyblock/content/io.jsm");
Cu.import("chrome://easyblock/content/ui.jsm");
Cu.import("chrome://easyblock/content/bldb.jsm");
Cu.import("chrome://easyblock/content/eventbus.jsm");


const os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
const ps = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);
const wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);


const ADDON_PREF = "extensions.easyblock.";

const OBS_REQ = "http-on-modify-request";
const OBS_RESP = "http-on-examine-response";
const OBS_WIN_OPEN = "domwindowopened";
const PREF_CHANGE = "nsPref:changed";

const TYPE_DOC = Ci.nsIContentPolicy.TYPE_DOCUMENT;


function ObsHandler(addon)
{
	this.addon = addon;
}

ObsHandler.prototype =
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

	onReq(req)
	{
		if (!req || this.addon.disabled)
			return;

		req.QueryInterface(Ci.nsIHttpChannel);
		if (!req.URI)
			return;

		this.addon.setReqUA(req);
		this.addon.blockHttp(req);
	},

	onResp(req)
	{
		if (!req || this.addon.disabled)
			return;

		req.QueryInterface(Ci.nsIHttpChannel);
		if (!req.URI)
			return;

		this.addon.blockHttp(req, true);
	},

	onWinOpen(win)
	{
		if (!win)
			return;

		win.addEventListener("load", this.addon, { once: true });
	},

	observe(subject, topic, data)
	{
		switch (topic)
		{
			case OBS_REQ:
				this.onReq(subject);
				return;

			case OBS_RESP:
				this.onResp(subject);
				return;

			case OBS_WIN_OPEN:
				this.onWinOpen(subject);
				return;
		}
	}
};

function PrefHandler(addon)
{
	let defbranch;

	this.addon = addon;

	defbranch = ps.getDefaultBranch(ADDON_PREF);

	// init default prefs
	defbranch.setBoolPref('disabled', addon.disabled);
	defbranch.setIntPref('logLevel', log.level);

	this.branch = this.reg(ADDON_PREF);

	// restore addon options from prefs store
	this.addon.disabled = this.disabled;
	log.level = this.logLevel
}

PrefHandler.prototype =
{
	get disabled()
	{
		if (!this.branch)
			return false;

		return this.branch.getBoolPref('disabled');
	},

	set disabled(value)
	{
		if (!this.branch)
			return;

		this.branch.setBoolPref('disabled', value);
	},

	get logLevel()
	{
		if (!this.branch)
			return LogLevel.NONE;

		return this.branch.getIntPref('logLevel');
	},

	set logLevel(value)
	{
		if (!this.branch)
			return;

		this.branch.setIntPref('logLevel', value);
	},

	reg(name = "", topic = "")
	{
		let branch, key;

		if (!name)
			return null;

		branch = ps.getBranch(name);
		if (!branch)
			return null;

		key = branch.root;
		if (topic)
			key += topic;
		else
			key += "*";

		log.info("reg '" + key + "' pref handler");
		branch.addObserver(topic, this, false);

		return branch;
	},

	unreg(branch, topic = "")
	{
		let key;

		if (!branch)
			return;

		key = branch.root;
		if (topic)
			key += topic;
		else
			key += "*";

		log.info("unreg '" + key + "' pref handler");
		branch.removeObserver(topic, this);
	},

	onPref(prefs, name)
	{
		if (!prefs)
			return;

		switch (name)
		{
			case "disabled":
				this.addon.disabled = prefs.getBoolPref(name);
				break;

			case "logLevel":
				log.level = prefs.getIntPref(name);
				if (log.level != this.logLevel)
					this.logLevel = log.level;
				break;
		}
	},

	observe(subject, topic, data)
	{
		switch (topic)
		{
			case PREF_CHANGE:
				this.onPref(subject, data);
				break;
		}
	},

	destroy()
	{
		this.unreg(this.branch);

		this.addon = null;
		this.branch = null;
	}
};

var EasyBlock =
{
	db: new bldb('blacklist.txt'),
	_disabled: false,
	prefs: {},
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

		this.prefs.disabled = value;

		this.wins.forEach((winUI) => winUI.onState(value));

		if (!value)
			log.info("Enable 'EasyBlock' addon...");
		else
			log.info("Disable 'EasyBlock' addon...");
	},

	startup(addonData)
	{
		var windows;

		EasyBlock.observer = new ObsHandler(this);
		EasyBlock.observer.reg(os, OBS_REQ);
		EasyBlock.observer.reg(os, OBS_RESP);

		windows = wm.getEnumerator("navigator:browser");

		while (windows.hasMoreElements())
			this.loadWindow(windows.getNext());
		EasyBlock.observer.reg(os, OBS_WIN_OPEN);

		this.db.load((db) =>
		{
			this.wins.forEach((winUI) => this.loadDBWin(winUI, db));
		});

		this.prefs = new PrefHandler(this);

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

		this.prefs.destroy();

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

		winUI = new WinUI(window, this);
		winUI.disabled = this.disabled;
		this.loadDBWin(winUI, this.db);
		window.addEventListener("unload", winUI);
		window.addEventListener("aftercustomization", winUI);

		this.wins.push(winUI);
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

	toggle(grpId)
	{
		if (grpId > 0)
		{
			let group;

			group = this.db.get(grpId);
			if (!group)
				return;

			if (group.toggle(!group.enabled))
				this.wins.forEach((winUI) => winUI.onToggle(group));

			return;
		}

		this.disabled = !this.disabled;
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
		this.db.load((db) =>
		{
			this.wins.forEach((winUI) => winUI.onReload(db));
		});
	},

	setReqUA(req)
	{
		let type, origin, dn, ua;

		if (!req || !req.URI)
			return;

		type = req.loadInfo && req.loadInfo.externalContentPolicyType;

		dn = req.URI.host;

		if (type != TYPE_DOC)
		{
			if (req.referrer)
				dn = req.referrer.host;
			else
			{
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
		}

		ua = this.db.findUA(dn);
		if (!ua)
			return;

		req.setRequestHeader("User-Agent", ua, false);
	},

	blockHttp(req, isResp)
	{
		let type, site;

		if (!req)
			return;

		if (isResp)
			type = req.contentType;

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

	handleEvent(event)
	{
		let target;

		if (!event || !event.target)
			return;

		target = event.target;

		switch (event.type)
		{
			case "load":
				this.loadWindow(target.defaultView);
				break;
		}
	}
};
