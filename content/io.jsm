"use strict";

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

var EXPORTED_SYMBOLS = ["io"];

Cu.import("resource://gre/modules/osfile.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");


const scriptError = Cc["@mozilla.org/scripterror;1"];

const ADDON_NAME = "easyblock";

// db path in profile
const ADDON_PATH = FileUtils.getDir("ProfD", [ADDON_NAME], true);	


var io =
{
	console: Services.console,

	log: function(msg)
	{
		this.console.logStringMessage("[" + ADDON_NAME + "] " + msg);
	},

	warn: function(msg)
	{
		let warn;

		if (!msg)
			return;

		warn = scriptError.createInstance(Ci.nsIScriptError);
		warn.init("[" + ADDON_NAME + "] " + msg, msg.fileName, msg.lineNumber, msg.lineNumber, 0, warn.warningFlag, null);
		this.console.logMessage(warn);
	},

	error: function(msg)
	{
		let err;

		if (!msg)
			return;

		err = scriptError.createInstance(Ci.nsIScriptError);
		err.init("[" + ADDON_NAME + "] " + msg, msg.fileName, msg.lineNumber, msg.lineNumber, 0, err.errorFlag, null);
		this.console.logMessage(err);
	},

	stat: function(fn, callback)
	{
		let path;

		path = OS.Path.join(ADDON_PATH.path, fn);

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

		path = OS.Path.join(ADDON_PATH.path, fn);

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
