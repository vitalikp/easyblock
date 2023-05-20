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
	let doc, elem, label;

	doc = menu.ownerDocument;

	elem = doc.createElement("menuitem");
	elem.setAttribute("class", "menuToggle");
	elem.addEventListener("command", (event) =>
	{
		if (!event || !event.target || !obj)
			return;

		obj.toggle(!this.toggled);
	}, false);

	label = doc.createElement("label");
	label.textContent = name;
	elem.appendChild(label);

	menu.appendChild(elem);

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
		this.addon.toggle(value, this.id);
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
		this.sendEvent(EventType.TOGGLE, { grpId: grpId, value: value });
	},

	reload()
	{
		this.sendEvent(EventType.RELOAD);
	},

	onEvent(event)
	{
		switch (event.type)
		{
			case EventType.GET:
				return this.winUI.onGet(event.data);

			case EventType.DOM:
				return this.winUI.onDom(event.data);
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

	this._disabled = false;

	this.win = win;
	this.addon = addon;
	this.bus = new UiBus(win.messageManager, this);

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

	item = doc.createElement("menuitem");
	item.cmdId = "winFilters";
	item.setAttribute("label", "Filters");
	item.addEventListener("command", this);
	this.menu.appendChild(item);

	grpMenu = doc.createElement("menu");
	grpMenu.setAttribute("label", "Groups");
	this.menu.appendChild(grpMenu);

	popupMenu = doc.createElement("menupopup");
	grpMenu.appendChild(popupMenu);
	this.grpMenu = popupMenu;

	this.menuItem = new MenuToggle(this, "Disabled", this.menu);

	reloadItem = doc.createElement("menuitem");
	reloadItem.cmdId = "reload";
	reloadItem.setAttribute("label", "Reload");
	reloadItem.addEventListener("command", this);
	this.menu.appendChild(reloadItem);

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

	openWin(name, url)
	{
		if (!this.win || !url)
			return;

		this.win.open("chrome://easyblock/content/" + url, "EasyBlock" + name, 'chrome,titlebar,centerscreen,resizable').focus();
	},

	onCmd(node)
	{
		if (!node || !node.cmdId)
			return;

		switch (node.cmdId)
		{
			case "winFilters":
				this.openWin("Filters", "filters.xul");
				break;

			case "reload":
				this.addon.reload();
				break;
		}
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
	},

	toggle(value, grpId)
	{
		if (!this.addon)
			return;

		this.addon.toggle(value, grpId);
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

					group = this.addon.getGroup(data.grpId);
					if (!group)
						return null;

					return group.enabled;
				}

			case 'disabled':
				return this.addon.disabled;
		}
	},

	onDom(data)
	{
		let site, eventData, grpId;

		if (!data)
			return;

		site = this.addon.findSite(data.hostname);
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

		return eventData;
	},

	initToolbar()
	{
		if (!this.toolbox)
			return;

		if (!WinUI.toolbarId)
			ui.selectToolbar(this.toolbox.childNodes);

		if (!WinUI.toolbarId)
			ui.selectToolbar(this.toolbox.externalToolbars);

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
			case "command":
				this.onCmd(event.target);
				break;

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
		if (this.bus)
		{
			this.bus.destroy();
			this.bus = null;
		}

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


const Notify =
{
	sendUI(addon, type, msg)
	{
		let win, doc, node;

		if (!type || !msg)
			return;

		win = wm.getMostRecentWindow("navigator:browser");
		doc = win.document;

		let notificationBox = win.getBrowser().getNotificationBox();

		node = doc.createElement("notification");
		node.setAttribute("type", type);
		node.setAttribute("class", "easyblock");
		node.setAttribute("label", msg);
		if (addon.disabled)
			node.setAttribute("ebstate", "disabled");
		else
			node.setAttribute("ebstate", "normal");
		notificationBox.appendChild(node);
	}
};

var ui =
{
	selectToolbar(toolbars)
	{
		let toolbar, currSet, items, nextItem;
		let i, index;

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
			WinUI.toolbarId = toolbar._customizationTarget.id;
			WinUI.nextItemId = nextItem;
			break;
		}
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

	notify(addon, msg)
	{
		Notify.sendUI(addon, 'info', msg);
	}
};
