"use strict";

const Ci = Components.interfaces;
const Cu = Components.utils;
const Cc = Components.classes;


var EXPORTED_SYMBOLS = ["ui", "uitree", "WinUI"];

// import
Cu.import("chrome://easyblock/content/io.jsm");
Cu.import("chrome://easyblock/content/eventbus.jsm");

const sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
const wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);


const XHTML_NS = "http://www.w3.org/1999/xhtml";
const BTN_ID = "easyblock-btn";


const ui =
{
	addLabel(node, text)
	{
		let doc, label;

		if (!node)
			return;

		doc = node.ownerDocument;

		label = doc.createElement("label");
		label.textContent = text;
		node.appendChild(label);
	},

	newMenu(name, parent)
	{
		let doc, menu, popup;

		if (!name || !parent)
			return;

		doc = parent.ownerDocument;

		menu = doc.createElement("menu");
		ui.addLabel(menu, name);

		popup = doc.createElement("menupopup");
		menu.appendChild(popup);

		parent.appendChild(menu);

		return popup;
	},

	newMenuItem(name, parent)
	{
		let doc, menuItem;

		if (!name || !parent)
			return;

		doc = parent.ownerDocument;

		menuItem = doc.createElement("menuitem");
		ui.addLabel(menuItem, name);

		parent.appendChild(menuItem);

		return menuItem;
	},

	loadCss(style)
	{
		let styleUri = io.newURI(style + ".css");
		sss.loadAndRegisterSheet(styleUri, sss.USER_SHEET);
	},

	unloadCss(style)
	{
		let styleUri = io.newURI(style + ".css");
		sss.unregisterSheet(styleUri, sss.USER_SHEET);
	},

	getWinId(win)
	{
		let utils;

		if (!win)
			return -1;

		utils = win.getInterface(Ci.nsIDOMWindowUtils);
		if (!utils)
			return -1;

		return utils.outerWindowID;
	}
};

const uitree =
{
	create(doc, name, expanded)
	{
		let node, label;

		node = doc.createElementNS(XHTML_NS, "div");
		node.setAttribute("class", "tree");

		label = doc.createElement("label");
		label.textContent = name;
		node.appendChild(label);

		if (expanded != undefined)
		{
			node.setAttribute("expanded", expanded);
		
			label.addEventListener('click', (event) =>
			{
				if (!event || !event.target)
					return;
	
				this.toggle(event.target.parentElement);
			});
		}

		return node;
	},

	expand(node)
	{
		if (!node || !node.hasAttribute("expanded"))
			return;

		node.setAttribute("expanded", true);
	},

	collapse(node)
	{
		if (!node || !node.hasAttribute("expanded"))
			return;

		node.setAttribute("expanded", false);
	},

	toggle(node)
	{
		if (!node || !node.hasAttribute("expanded"))
			return;

		if (node.getAttribute("expanded") == 'false')
			node.setAttribute("expanded", true);
		else
			node.setAttribute("expanded", false);
	},

	add(node, item)
	{
		if (!node || !item)
			return;

		if (!node.root)
		{
			node.root = node.ownerDocument.createElementNS(XHTML_NS, "div");
			node.appendChild(node.root);
		}

		node.root.appendChild(item);
	},

	addLabel(node, text)
	{
		let doc, label;

		if (!node)
			return;

		doc = node.ownerDocument;

		label = doc.createElement("label");
		label.textContent = text;

		uitree.add(node, label);
	}
};

function MenuToggle(obj, name, menu)
{
	let doc, elem;

	doc = menu.ownerDocument;

	elem = ui.newMenuItem(name, menu);
	elem.addEventListener("command", (event) =>
	{
		if (!event || !event.target || !obj)
			return;

		obj.toggle(!this.toggled);
	}, false);

	this.elem = elem;
	this._toggled = false;
}

MenuToggle.prototype =
{
	get toggled()
	{
		return this._toggled;
	},

	set toggled(value)
	{
		if (!this.elem || this._toggled == value)
			return;

		if (value)
			this.elem.setAttribute("toggled", "true");
		else
			this.elem.removeAttribute("toggled");

		this._toggled = value;
	},

	destroy()
	{
		if (!this.elem)
			return;

		if (this.elem.parentNode)
			this.elem.parentNode.removeChild(this.elem);
		this.elem = null;
	}
};

function GroupUI(group, menu, addon)
{
	let menuItem;

	menuItem = new MenuToggle(this, group.name, menu);
	menuItem.toggled = group.enabled;

	this.id = group.id;
	this.menuItem = menuItem;
	this.addon = addon;
}

GroupUI.prototype =
{
	toggle(value)
	{
		this.addon.toggle(this.id);
	},

	destroy()
	{
		if (this.menuItem)
		{
			this.menuItem.destroy();
			this.menuItem = null;
		}
	},

	update(group)
	{
		if (this.id != group.id)
			return;

		this.menuItem.toggled = group.enabled;
	}
};

function UiBus(mm, winUI)
{
	EventBus.call(this, "ui", mm);

	this.winUI = winUI;
	this.regEvent("content");

	this.scripts = [];
}

UiBus.prototype = Object.create(EventBus.prototype);
Object.assign(UiBus.prototype,
{
	_sendEvent(type, data)
	{
		this.mm.broadcastAsyncMessage(type, data);
	},

	toggle(value, grpId)
	{
		this.sendEvent(EventType.TOGGLE, { grpId, value });
	},

	reload()
	{
		this.sendEvent(EventType.RELOAD);
	},

	loadScript(name)
	{
		if (this.scripts.includes(name))
			return;

		this.mm.loadFrameScript("chrome://easyblock/content/" + name, true);
		this.scripts.push(name);
	},

	onEvent(event)
	{
		switch (event.type)
		{
			case EventType.FRAME:
				this.winUI.onFrame(event.data, event.target);
				break;

			case EventType.CLOSE:
				this.winUI.onClose(event.data);
				break;
		}
	},

	destroy()
	{
		let script, i;

		i = 0;
		while (i < this.scripts.length)
		{
			script = this.scripts[i++];
			if (!script)
				continue;

			this.mm.removeDelayedFrameScript("chrome://easyblock/content/" + script);
		}
		this.scripts = [];

		this.unregEvent("content");
	}
});

function TabUI(winUI, mm, id)
{
	EventBus.call(this, "ui", mm);

	this.winUI = winUI;
	this.regEvent("content");

	this.id = id;
}

TabUI.prototype = Object.create(EventBus.prototype);
Object.assign(TabUI.prototype,
{
	init(data)
	{
		if (!data)
			return;

		this.sendEvent(EventType.INIT, data);
	},

	site(data)
	{
		if (!data)
			return;

		this.sendEvent(EventType.SITE, data);
	},

	onDom(data, target)
	{
		let site, eventData, grpId;

		if (!data || !target)
			return;

		if (data.grpId > 0)
		{
			let group;

			group = this.winUI.getGroup(data.grpId);
			if (!group || !group.enabled)
				return;

			this.site({ hostname: data.hostname });
			return;
		}

		site = this.winUI.getSite(data.hostname);
		if (!site || !site.hasDom)
			return;

		grpId = -1;
		if (site.group)
			grpId = site.group.id;

		eventData =
		{
			hostname: data.hostname,
			grpId: grpId,
			content: site.content,
			styles: site.styles,
			scripts: site.scripts
		};

		this.site(eventData);
	},

	onEvent(event)
	{
		switch (event.type)
		{
			case EventType.DOM:
				this.onDom(event.data, event.target);
				break;
		}
	},

	destroy()
	{
		this.unregEvent("content");
	}
});

function WinUI(win, addon)
{
	let doc, popupMenu, grpMenu, item, reloadItem;

	this.id = ui.getWinId(win);
	this._disabled = false;

	this.win = win;
	this.addon = addon;

	this.tabs = new Map();

	this.bus = new UiBus(win.messageManager, this);
	this.bus.loadScript("frame.js");

	doc = win.document;

	this.btn = doc.createElement("toolbarbutton");
	this.btn.setAttribute("id", BTN_ID);
	this.btn.setAttribute("removable", "true");
	this.btn.setAttribute("label", "EasyBlock");
	this.btn.setAttribute("class", "toolbarbutton-1 easyblock");
	this.btn.setAttribute("tooltiptext", "EasyBlock toolbar button");
	this.btn.addEventListener("command", (event) =>
	{
		if (!event && !event.target)
			return;

		this.menu.openPopup(this.btn, "after_start", 0, -3, false, false);
	});

	this.menu = doc.createElement("menupopup");
	this.btn.appendChild(this.menu);

	this.toolbox = doc.getElementById("navigator-toolbox");

	item = ui.newMenuItem("Filters", this.menu);
	item.addEventListener("command", (event) =>
	{
		if (!event && !event.target)
			return;

		this.openWin("Filters", "filters.xul");
	});

	this.grpMenu = ui.newMenu("Groups", this.menu);

	this.menuItem = new MenuToggle(this, "Disabled", this.menu);

	reloadItem = ui.newMenuItem("Reload", this.menu);
	reloadItem.addEventListener("command", (event) =>
	{
		if (!event && !event.target)
			return;

		addon.reload();
	});

	this.groups = [];

	this.initToolbar();
}

WinUI.prototype =
{
	get disabled()
	{
		return this._disabled;
	},

	set disabled(value)
	{
		if (this._disabled == value)
			return;

		if (value)
			this.btn.setAttribute("ebstate", "disabled");
		else
			this.btn.setAttribute("ebstate", "normal");
		this.menuItem.toggled = value;

		this._disabled = value;
	},

	getGroup(grpId)
	{
		return this.addon.getGroup(grpId);
	},

	getSite(hostname)
	{
		return this.addon.findSite(hostname);
	},

	notify(msg)
	{
		let doc, node;

		if (!this.win || !msg)
			return;

		doc = this.win.document;

		let notificationBox = this.win.gBrowser.getNotificationBox();

		node = doc.createElement("notification");
		node.setAttribute("type", "info");
		node.setAttribute("class", "easyblock");
		node.setAttribute("label", msg);
		if (this.disabled)
			node.setAttribute("ebstate", "disabled");
		else
			node.setAttribute("ebstate", "normal");
		notificationBox.appendChild(node);
	},

	openWin(name, url)
	{
		if (!this.win || !url)
			return;

		this.win.open("chrome://easyblock/content/" + url, "EasyBlock" + name, 'chrome,titlebar,centerscreen,resizable').focus();
	},

	onState(state)
	{
		this.bus.toggle(state);
		this.disabled = state;
	},

	onToggle(group)
	{
		this.bus.toggle(group.enabled, group.id);

		this.groups.forEach((grpUI) => grpUI.update(group));
	},

	onReload(db)
	{
		this.bus.reload();

		this.clearGroups();
		this.addon.loadDBWin(this, db);

		if (this.win == wm.getMostRecentWindow("navigator:browser"))
			this.notify("Blacklist sites reloaded!");
	},

	getTab(id)
	{
		if (!id)
			return null;

		return this.tabs.get(id);
	},

	onFrame(data, target)
	{
		let tabUI, mm;

		if (!data || !target)
			return;

		tabUI = this.tabs.get(data.tabId);
		if (tabUI)
			return;
		mm = target.messageManager;

		tabUI = new TabUI(this, mm, data.tabId);

		this.tabs.set(data.tabId, tabUI);

		tabUI.init({ disabled: this.disabled });
	},

	toggle(value, grpId)
	{
		if (!this.addon)
			return;

		this.addon.toggle(grpId);
	},

	onGet(data)
	{
		if (!data)
			return;

		switch (data.name)
		{
			case 'enabled':
				{
					let group;

					group = this.getGroup(data.grpId);
					if (!group)
						return null;

					return group.enabled;
				}

			case 'disabled':
				return this.addon.disabled;
		}
	},

	onClose(data)
	{
		let tabUI;

		if (!data)
			return;

		tabUI = this.tabs.get(data.id);
		if (!tabUI)
			return;

		this.tabs.delete(tabUI.id);
		tabUI.destroy();
	},

	initToolbar()
	{
		if (!this.toolbox)
			return;

		if (!WinUI.toolbarId)
			WinUI.selectToolbar(this.toolbox.childNodes);

		if (!WinUI.toolbarId)
			WinUI.selectToolbar(this.toolbox.externalToolbars);

		if (!WinUI.toolbarId)
		{
			this.toolbox.palette.appendChild(this.btn);
			return;
		}

		this.moveBtn(WinUI.toolbarId, WinUI.nextItemId);
	},

	moveBtn(toolBarId, nextItemId)
	{
		let toolbar, nextItem;

		if (!this.btn || !toolBarId)
			return;

		toolbar = this.btn.parentNode;
		if (toolbar)
		{
			if (toolbar.id == toolBarId && nextItemId)
			{
				nextItem = this.btn.nextSibling;
				if (nextItem && nextItem.id == nextItemId)
					return; // already placed
			}

			toolbar.removeChild(this.btn);
		}

		if (this.toolbox && nextItemId)
		{
			toolbar = this.toolbox.querySelector('#'+toolBarId);
			if (toolbar)
			{
				nextItem = toolbar.querySelector('#'+nextItemId);
				if (nextItem)
					toolbar.insertBefore(this.btn, nextItem);
			}
		}
	},

	addGroup(group)
	{
		let grpUI;

		if (!group)
			return;

		grpUI = new GroupUI(group, this.grpMenu, this.addon);

		this.groups.push(grpUI);
	},

	handleEvent(event)
	{
		if (!event)
			return;

		switch (event.type)
		{
			case "unload":
				this.addon.unloadWin(this);
				break;

			case "aftercustomization":
				this.addon.customizeUI(event.target);
				break;
		}
	},

	destroy()
	{
		let iter, tabUI;

		if (this.bus)
		{
			this.bus.destroy();
			this.bus = null;
		}

		iter = this.tabs.values();
		while (!(tabUI=iter.next()).done)
		{
			tabUI = tabUI.value;
			if (!tabUI)
				continue;

			tabUI.destroy();
		}
		this.tabs.clear();

		if (this.btn)
		{
			if (this.btn.parentNode)
				this.btn.parentNode.removeChild(this.btn);
			this.btn = null;
		}

		if (this.menuItem)
		{
			this.menuItem.destroy();
			this.menuItem = null;
		}

		this.clearGroups();
	},

	clearGroups()
	{
		this.groups.forEach((grpUI) => grpUI.destroy());
		this.groups = [];
	}
};

WinUI.customize = function(toolbox)
{
	let currentSet, btn;
	let toolbarId, nextItemId;

	if (!toolbox)
		return;

	btn = toolbox.parentNode.querySelector('#'+BTN_ID);
	if (btn)
	{
		let parent = btn.parentNode,
		nextItem = btn.nextSibling;
		if (parent && ["toolbar", "hbox"].includes(parent.localName))
			toolbarId = parent.id;
		nextItemId = nextItem && nextItem.id;
	}

	WinUI.toolbarId = toolbarId;
	WinUI.nextItemId = nextItemId;
};

WinUI.selectToolbar = function(toolbars)
{
	let toolbar, currSet, items, nextItem;
	let i, index;

	if (!toolbars)
		return;

	i = 0;
	while (i < toolbars.length)
	{
		toolbar = toolbars[i++];
		if (!toolbar)
			continue;

		currSet = toolbar.getAttribute("currentset");
		if (!currSet)
			continue;

		items = currSet.split(",");
		index = items.indexOf(BTN_ID);
		if (index < 0)
			continue;

		if (index < items.length)
			nextItem = items[index+1];
		if (toolbar.hasAttribute("customizationtarget"))
			WinUI.toolbarId = toolbar.getAttribute("customizationtarget");
		else
			WinUI.toolbarId = toolbar.id;
		WinUI.nextItemId = nextItem;
		break;
	}
};