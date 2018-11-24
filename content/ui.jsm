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
			this.btn.parentNode.removeChild(this.btn);
			this.btn = null;
		}
		if (this.menuItem)
		{
			this.menuItem.parentNode.removeChild(this.menuItem);
			this.menuItem = null;
		}
	},

	updateState: function(state)
	{
		if (state)
			this.btn.setAttribute("ebstate", "disabled");
		else
			this.btn.setAttribute("ebstate", "normal");
		this.menuItem.setAttribute('checked', state);
	}
};

const Notify =
{
	sendUI: function(state, type, msg)
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
		if (state)
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
		let winUI, btn, menu, item, reloadItem;

		btn = doc.createElement("toolbarbutton");
		btn.setAttribute("id", BTN_ID);
		btn.setAttribute("type", "menu");
		btn.setAttribute("removable", "true");
		btn.setAttribute("label", "EasyBlock");
		btn.setAttribute("class", "toolbarbutton-1 easyblock");
		btn.setAttribute("tooltiptext", "EasyBlock toolbar button");

		menu = doc.createElement("menupopup");

		item = doc.createElement("menuitem");
		item.setAttribute("type", "checkbox");
		item.setAttribute("label", "Disabled");
		item.addEventListener("command", (event) =>
		{
			if (!event && !event.target)
				return;

			if (event.target.hasAttribute('checked'))
				addon.disable(ui.updateStatus);
			else
				addon.enable(ui.updateStatus);
		}, false);
		menu.appendChild(item);

		winUI = WinUI.create(btn, item);
		winUI.updateState(addon.disabled);

		reloadItem = doc.createElement("menuitem");
		reloadItem.setAttribute("label", "Reload");
		reloadItem.addEventListener("command", (event) =>
		{
			if (!event && !event.target)
				return;

			addon.reload();
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

	initToolbar: function(doc, addon)
	{
		let toolbars, btn, nextItem;

		if (!ui.toolbox)
			ui.toolbox = doc.getElementById("navigator-toolbox");
		if (!ui.toolbox)
			return;

		btn = ui.createBtn(doc, addon);
		ui.toolbox.palette.appendChild(btn);

		if (!ui.toolbarId)
		{
			toolbars = ui.toolbox.externalToolbars.slice();
			for (let toolbar of toolbars)
			{
				let currentSet = toolbar.getAttribute("currentset");
				if (currentSet)
				{
					let items = currentSet.split(",");
					let index = items.indexOf(BTN_ID);
					if (index >= 0)
					{
						if (index < items.length)
							nextItem = items[index+1];
						ui.toolbarId = toolbar.id;
						ui.nextItemId = nextItem;
						break;
					}
				}
			}
		}

		if (!ui.toolbarId)
			return;

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

	updateStatus: function(state)
	{
		ui.wins.forEach((winUI) => winUI.updateState(state));
	},

	notify: function(addon, msg)
	{
		Notify.sendUI(addon.disabled, 'info', msg);
	}
};
