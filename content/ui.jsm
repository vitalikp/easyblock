"use strict";

const Ci = Components.interfaces;
const Cu = Components.utils;
const Cc = Components.classes;


var EXPORTED_SYMBOLS = ["ui", "uitree", "WinUI"];

// import
Cu.import("chrome://easyblock/content/io.jsm");

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

function GroupUI(group, menu, winUI)
{
	let menuItem;

	menuItem = new MenuToggle(this, group.name, menu);
	menuItem.toggled = group.enabled;

	this.id = group.id;
	this.menuItem = menuItem;
	this.winUI = winUI;
}

GroupUI.prototype =
{
	toggle(value)
	{
		this.menuItem.toggled = value;

		this.winUI.toggle(value, this.id);
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

function WinUI(win, addon)
{
	let doc, popupMenu, grpMenu, item, reloadItem;

	this._disabled = false;

	this.win = win;
	this.addon = addon;

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

		this.win.open('chrome://easyblock/content/filters.xul', 'EasyBlockFilters', 'chrome,titlebar,centerscreen,resizable').focus();
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

	this.loadGroups(addon.db.groups);
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

	onState(state)
	{
		this.disabled = state;
	},

	onToggle(group)
	{
		this.groups.forEach((grpUI) => grpUI.update(group));
	},

	onReload(db)
	{
		this.addon.loadDBWin(this, db);

		if (this.win == wm.getMostRecentWindow("navigator:browser"))
			this.notify("Blacklist sites reloaded!");
	},

	toggle(value, grpId)
	{
		if (!this.addon)
			return;

		this.addon.toggle(value, grpId);
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

		grpUI = new GroupUI(group, this.grpMenu, this);

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
	},

	loadGroups(groups)
	{
		this.clearGroups();
		groups.forEach((group) =>
		{
			if (group.hidden)
				return;

			this.addGroup(group);
		});
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