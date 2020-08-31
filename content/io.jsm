"use strict";

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

var EXPORTED_SYMBOLS = ["io"];

Cu.import("resource://gre/modules/osfile.jsm");


const scriptError = Cc["@mozilla.org/scripterror;1"];

const ADDON_NAME = "easyblock";


var io =
{
	init: function()
	{
		let dirSrv, profPath;

		if (this.console)
			return;

		dirSrv = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

		// db path in profile
		profPath = dirSrv.get("ProfD", Ci.nsIFile);
		profPath.append(ADDON_NAME);
		this.addonPath = profPath.path;

		this.console = Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);
	},

	log: function(msg)
	{
		this.console.logStringMessage("[" + ADDON_NAME + "] " + msg);
	},

	logMsg: function(flags, msg)
	{
		let errMsg;

		if (!msg)
			return;

		errMsg = scriptError.createInstance(Ci.nsIScriptError);
		errMsg.initWithWindowID("[" + ADDON_NAME + "] " + msg, msg.fileName, msg.lineNumber, msg.lineNumber, 0, flags, null, 0);

		this.console.logMessage(errMsg);
	},

	warn: function(msg)
	{
		return this.logMsg(Ci.nsIScriptError.warningFlag, msg);
	},

	error: function(msg)
	{
		return this.logMsg(Ci.nsIScriptError.errorFlag, msg);
	},

	stat: function(fn, callback)
	{
		let path;

		path = OS.Path.join(this.addonPath, fn);

		OS.File.stat(path).then(callback, (res) =>
		{
			io.warn('file not found: ' + fn + ' ' + res);
		});
	},

	load: function(path, callback)
	{
		if (!path || !callback)
			return;

		if (path.startsWith("chrome://"))
		{
			netutil.loadHttp(path, "arraybuffer", callback);
			return;
		}

		this.loadFile(path, (data) =>
		{
			callback(data.buffer);
		});
	},

	loadText: function(path, callback)
	{
		if (!path || !callback)
			return;

		if (path.startsWith("chrome://"))
		{
			netutil.loadHttp(path, "text", callback);
			return;
		}

		this.loadFile(path, (data) =>
		{
			let dec;

			dec = new TextDecoder();

			try
			{
				callback(dec.decode(data));
			}
			catch (e)
			{
				io.error('fail to read ' + path + ' file: ' + e);
			}
		});
	},

	loadFile: function(fn, callback)
	{
		let path;

		if (!fn || !callback)
			return;

		path = OS.Path.join(this.addonPath, fn);

		try
		{
			this.stat(fn, (stat) =>
			{
				this.onLoad(path, stat, callback);
			});
		}
		catch(e)
		{
			io.error('fail to load ' + fn + ' file: ' + e);
		}
	},

	onLoad: function(path, stat, callback)
	{
		if (stat.isDir)
			return;

		try
		{
			OS.File.read(path).then((data) =>
			{
				if (!data || !data.byteLength)
					return;

				callback(data);
			});
		}
		catch(e)
		{
			io.error('fail to read ' + path + ' file: ' + e);
		}
	}
};
io.init();
