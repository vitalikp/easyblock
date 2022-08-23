"use strict";

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

var EXPORTED_SYMBOLS = ["io"];

Cu.import("resource://gre/modules/osfile.jsm");
Cu.import("resource://gre/modules/Task.jsm");


const cs = Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);
const ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService2);
const scriptError = Cc["@mozilla.org/scripterror;1"];

const ADDON_NAME = "easyblock";


var io =
{
	init: function()
	{
		let dirSrv, profPath;

		dirSrv = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

		// db path in profile
		profPath = dirSrv.get("ProfD", Ci.nsIFile);
		profPath.append(ADDON_NAME);
		this.addonPath = profPath.path;
	},

	newURI: function(url)
	{
		if (!url)
			return null;

		if (url.indexOf(':') < 0)
			url = "chrome://" + ADDON_NAME + "/content/" + url;

		try
		{
			return ios.newURI(url);
		}
		catch (e)
		{
			return null;
		}
	},

	log: function(msg)
	{
		cs.logStringMessage("[" + ADDON_NAME + "] " + msg);
	},

	logMsg: function(flags, msg)
	{
		let errMsg;

		if (!msg)
			return;

		errMsg = scriptError.createInstance(Ci.nsIScriptError);
		errMsg.initWithWindowID("[" + ADDON_NAME + "] " + msg, msg.fileName, msg.lineNumber, msg.lineNumber, 0, flags, null, 0);

		cs.logMessage(errMsg);
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

	saveFile: function(fn, data)
	{
		let path;

		if (!fn || !data)
			return;

		path = OS.Path.join(this.addonPath, fn);

		switch (typeof(data))
		{
			case 'string':
				data = new TextEncoder().encode(data);
				break;
		}

		Task.spawn(function*()
		{
			let file;

			try
			{
				file = yield OS.File.open(path, { write: true, trunc: true });
				yield file.write(data);
				yield file.flush();
			}
			catch(e)
			{
				io.error('fail to save ' + fn + ' file: ' + e);
			}
			finally
			{
				if (file)
					yield file.close();
			}
		});
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
