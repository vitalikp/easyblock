"use strict";

const Ci = Components.interfaces;
const Cu = Components.utils;
const Cc = Components.classes;


var EXPORTED_SYMBOLS = ["ui", "uitree"];

// import
Cu.import("resource://gre/modules/Services.jsm");

Cu.import("chrome://easyblock/content/io.jsm");

const sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);


const BTN_ID = "easyblock-btn";


const uitree =
{
	create: function(doc, name, expanded)
	{
		let node, label;

		node = doc.createElement("vbox");
		node.setAttribute("class", "tree");

		label = doc.createElement("label");
		label.setAttribute("value", name);
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

	expand: function(node)
	{
		if (!node || !node.hasAttribute("expanded"))
			return;

		node.setAttribute("expanded", true);
	},

	collapse: function(node)
	{
		if (!node || !node.hasAttribute("expanded"))
			return;

		node.setAttribute("expanded", false);
	},

	toggle: function(node)
	{
		if (!node || !node.hasAttribute("expanded"))
			return;

		if (node.getAttribute("expanded") == 'false')
			node.setAttribute("expanded", true);
		else
			node.setAttribute("expanded", false);
	},

	add: function(node, item)
	{
		if (!node || !item)
			return;

		if (!node.root)
		{
			node.root = node.ownerDocument.createElement("vbox");
			node.appendChild(node.root);
		}

		node.root.appendChild(item);
	}
};

function MenuToggle(obj, name, menu, action)
{
	let doc, menuState, elem;

	doc = menu.ownerDocument;

	elem = doc.createElement("menuitem");
	elem.setAttribute("type", "checkbox");
	elem.setAttribute("label", name);
	elem.addEventListener("command", (event) =>
	{
		let value;

		if (!event || !event.target || !obj)
			return;

		value = event.target.hasAttribute('checked');

		if (obj.toggle(value))
			ui.update(action, obj);
	}, false);
	menu.appendChild(elem);

	this.elem = elem;
}

MenuToggle.prototype =
{
	destroy: function()
	{
		if (!this.elem)
			return;

		if (this.elem.parentNode)
			this.elem.parentNode.removeChild(this.elem);
		this.elem = null;
	},

	update: function(state)
	{
		this.elem.setAttribute('checked', state);
	}
};

function GroupUI(group, menu)
{
	let menuItem;

	menuItem = new MenuToggle(group, group.name, menu, 'Group');
	menuItem.update(group.enabled);

	this.group = group;
	this.menuItem = menuItem;
}

GroupUI.prototype =
{
	destroy: function()
	{
		if (this.menuItem)
		{
			this.menuItem.destroy();
			this.menuItem = null;
		}
	},

	update: function(group)
	{
		if (group.name != this.group.name)
			return;

		this.menuItem.update(group.enabled);
	}
};

function WinUI(doc, addon)
{
	let win, popupMenu, grpMenu, item, reloadItem;

	this.btn = doc.createElement("toolbarbutton");
	this.btn.setAttribute("id", BTN_ID);
	this.btn.setAttribute("type", "menu");
	this.btn.setAttribute("removable", "true");
	this.btn.setAttribute("label", "EasyBlock");
	this.btn.setAttribute("class", "toolbarbutton-1 easyblock");
	this.btn.setAttribute("tooltiptext", "EasyBlock toolbar button");

	this.menu = doc.createElement("menupopup");
	this.btn.appendChild(this.menu);

	win = doc.defaultView;

	this.toolbox = doc.getElementById("navigator-toolbox");

	item = doc.createElement("menuitem");
	item.setAttribute("label", "Filters");
	item.addEventListener("command", (event) =>
	{
		if (!event && !event.target)
			return;

		win.open('chrome://easyblock/content/options.xul', 'EasyBlockFilters', 'chrome,titlebar,centerscreen,resizable').focus();
	});
	this.menu.appendChild(item);

	grpMenu = doc.createElement("menu");
	grpMenu.setAttribute("label", "Groups");
	this.menu.appendChild(grpMenu);

	popupMenu = doc.createElement("menupopup");
	grpMenu.appendChild(popupMenu);
	this.grpMenu = popupMenu;

	this.menuItem = new MenuToggle(addon, "Disabled", this.menu, 'State');

	reloadItem = doc.createElement("menuitem");
	reloadItem.setAttribute("label", "Reload");
	reloadItem.addEventListener("command", (event) =>
	{
		if (!event && !event.target)
			return;

		addon.reload((db) =>
		{
			ui.onLoadDB(db);
			ui.notify(addon, 'Blacklist sites reloaded!');
		});
	});
	this.menu.appendChild(reloadItem);

	win.addEventListener('unload', (event) => 
	{
		let i;

		i = ui.wins.indexOf(this);
		if (i >= 0)
		{
			ui.wins[i].destroy();
			ui.wins.splice(i, 1);
		}
	});

	this.groups = [];

	this.updateState(addon);
	this.loadGroups(addon.db.groups);
	this.initToolbar();
}

WinUI.prototype =
{
	initToolbar: function()
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

	moveBtn: function(toolBarId, nextItemId)
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

	destroy: function()
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

	updateState: function(addon)
	{
		if (addon.disabled)
			this.btn.setAttribute("ebstate", "disabled");
		else
			this.btn.setAttribute("ebstate", "normal");
		this.menuItem.update(addon.disabled);
	},

	clearGroups: function()
	{
		this.groups.forEach((grpUI) => grpUI.destroy());
		this.groups = [];
	},

	loadGroups: function(groups)
	{
		this.clearGroups();
		groups.forEach((group) =>
		{
			let grpUI;

			grpUI = new GroupUI(group, this.grpMenu);

			this.groups.push(grpUI);
		});
	},

	updateGroup: function(group)
	{
		this.groups.forEach((grpUI) => grpUI.update(group));
	}
};

const Notify =
{
	sendUI: function(addon, type, msg)
	{
		let win, doc, node;

		if (!type || !msg)
			return;

		win = Services.wm.getMostRecentWindow("navigator:browser");
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
	wins: [],

	init: function(win, addon)
	{
		let winUI;

		if (!win && !win.document)
			return;

		winUI = new WinUI(win.document, addon);

		win.addEventListener("aftercustomization", ui.customize, false);

		ui.wins.push(winUI);
	},

	selectToolbar: function(toolbars)
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

	customize: function(event)
	{
		let toolbox, currentSet, btn;
		let toolbarId, nextItemId;

		if (!event && !event.target)
			return;

		toolbox = event.target;
		btn = toolbox.parentNode.querySelector('#'+BTN_ID);
		if (btn)
		{
			let parent = btn.parentNode,
			nextItem = btn.nextSibling;
			if (parent && ["toolbar", "hbox"].includes(parent.localName))
				toolbarId = parent.id;
			nextItemId = nextItem && nextItem.id;
		}

		ui.wins.forEach((winUI) => winUI.moveBtn(toolbarId, nextItemId));

		WinUI.toolbarId = toolbarId;
		WinUI.nextItemId = nextItemId;
	},

	loadCss: function(style)
	{
		let styleUri = Services.io.newURI("chrome://easyblock/content/" + style + ".css", null, null);
		sss.loadAndRegisterSheet(styleUri, sss.USER_SHEET);
	},

	unloadCss: function(style)
	{
		let styleUri = Services.io.newURI("chrome://easyblock/content/" + style + ".css", null, null);
		sss.unregisterSheet(styleUri, sss.USER_SHEET);
	},

	onLoadDB: function(db)
	{
		ui.wins.forEach((winUI) => winUI.loadGroups(db.groups));
	},

	update: function(action, data)
	{
		action = 'update' + action;
		ui.wins.forEach((winUI) => winUI[action](data));
	},

	notify: function(addon, msg)
	{
		Notify.sendUI(addon, 'info', msg);
	}
};
