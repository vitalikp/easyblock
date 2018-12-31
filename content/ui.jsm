"use strict";

const Ci = Components.interfaces;
const Cu = Components.utils;
const Cc = Components.classes;


var EXPORTED_SYMBOLS = ["ui"];

// import
Cu.import("resource://gre/modules/Services.jsm");

Cu.import("chrome://easyblock/content/io.jsm");

const sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);


const BTN_ID = "easyblock-btn";


const MenuToggle =
{
	elem: null,

	create: function(obj, name, menu, action)
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

		menuState = Object.create(MenuToggle);
		menuState.elem = elem;

		return menuState;
	},

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

const WinUI =
{
	btn: null,
	menuItem: null,

	create: function(btn, menuItem)
	{
		let winUI;

		winUI = Object.create(WinUI);
		winUI.btn = btn;
		winUI.menuItem = menuItem;

		return winUI;
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
	},

	updateState: function(addon)
	{
		if (addon.disabled)
			this.btn.setAttribute("ebstate", "disabled");
		else
			this.btn.setAttribute("ebstate", "normal");
		this.menuItem.update(addon.disabled);
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
	toolbox: null,
	toolbarId: null,
	nextItemId: null,
	wins: [],

	init: function(win, addon)
	{
		if (!win && !win.document)
			return;

		ui.initToolbar(win.document, addon);
	},

	createBtn: function(doc, addon)
	{
		let winUI, btn, menu, popupMenu, grpMenu, item, reloadItem;

		btn = doc.createElement("toolbarbutton");
		btn.setAttribute("id", BTN_ID);
		btn.setAttribute("type", "menu");
		btn.setAttribute("removable", "true");
		btn.setAttribute("label", "EasyBlock");
		btn.setAttribute("class", "toolbarbutton-1 easyblock");
		btn.setAttribute("tooltiptext", "EasyBlock toolbar button");

		menu = doc.createElement("menupopup");

		grpMenu = doc.createElement("menu");
		grpMenu.setAttribute("label", "Groups");
		menu.appendChild(grpMenu);

		popupMenu = doc.createElement("menupopup");
		grpMenu.appendChild(popupMenu);
		grpMenu = popupMenu;

		item = MenuToggle.create(addon, "Disabled", menu, 'State');

		winUI = WinUI.create(btn, item);
		winUI.updateState(addon);

		reloadItem = doc.createElement("menuitem");
		reloadItem.setAttribute("label", "Reload");
		reloadItem.addEventListener("command", (event) =>
		{
			if (!event && !event.target)
				return;

			addon.reload((db) =>
			{
				ui.notify(addon, 'Blacklist sites reloaded!');
			});
		}, false);
		menu.appendChild(reloadItem);

		doc.defaultView.addEventListener('unload', (event) => 
		{
			let i;

			i = ui.wins.indexOf(winUI);
			if (i >= 0)
			{
				ui.wins[i].destroy();
				ui.wins.splice(i, 1);
			}
		});

		ui.wins.push(winUI);
		btn.appendChild(menu);

		return btn;
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
			ui.toolbarId = toolbar._customizationTarget.id;
			ui.nextItemId = nextItem;
			break;
		}
	},

	initToolbar: function(doc, addon)
	{
		let btn;

		if (!ui.toolbox)
			ui.toolbox = doc.getElementById("navigator-toolbox");
		if (!ui.toolbox)
			return;

		btn = ui.createBtn(doc, addon);

		if (!ui.toolbarId)
			ui.selectToolbar(ui.toolbox.childNodes);

		if (!ui.toolbarId)
			ui.selectToolbar(ui.toolbox.externalToolbars);

		if (!ui.toolbarId)
		{
			ui.toolbox.palette.appendChild(btn);
			return;
		}

		let toolbox = doc.getElementById(ui.toolbarId);
		if (toolbox)
		{
			let nextItem = null;
			if (ui.nextItemId)
				nextItem = doc.getElementById(ui.nextItemId);
			if (!toolbox.querySelector('#'+BTN_ID))
				toolbox.insertBefore(btn, nextItem);
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
			if (parent && parent.localName == "toolbar")
				toolbarId = parent.id;
			nextItemId = nextItem && nextItem.id;
		}

		ui.toolBarId = toolbarId;
		ui.nextItemId = nextItemId;
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
