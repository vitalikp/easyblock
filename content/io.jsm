"use strict";

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;
const CC = Components.Constructor;

var EXPORTED_SYMBOLS = ["LogLevel", "OFlags", "log", "io"];

Cu.import("resource://gre/modules/osfile.jsm");


const cs = Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);
const ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService2);
const LocalFile = CC("@mozilla.org/file/local;1", Ci.nsIFile, "initWithPath");
const FileStream = CC("@mozilla.org/network/file-stream;1", Ci.nsIFileStream, "init");
const BinaryInputStream = CC("@mozilla.org/binaryinputstream;1", Ci.nsIBinaryInputStream, "setInputStream");
const scriptError = Cc["@mozilla.org/scripterror;1"];

const ADDON_NAME = "easyblock";

const LogLevel =
{
	NONE: 0,
	ERROR: 1,
	WARN: 2,
	INFO: 3,
	DEBUG: 4,
	ALL: 5
};

/** open flags */
const OFlags =
{
	NONE: -1,
	RDONLY: 0x01,
	WRONLY: 0x02,
	RDWR: 0x04,
	CREAT: 0x08,
	APPEND: 0x10,
	TRUNC: 0x20
};


var log =
{
	_level: LogLevel.INFO,

	get level()
	{
		return this._level;
	},

	set level(value)
	{
		if (value < LogLevel.NONE || value > LogLevel.ALL)
			return;

		if (this._level == value)
			return;

		this._level = value;
	},

	_logMsg(flags, msg)
	{
		let errMsg;

		if (!msg)
			return;

		errMsg = scriptError.createInstance(Ci.nsIScriptError);
		errMsg.initWithWindowID("[" + ADDON_NAME + "] " + msg, msg.fileName, msg.lineNumber, msg.lineNumber, 0, flags, null, 0);

		cs.logMessage(errMsg);
	},

	error(msg)
	{
		if (this.level < LogLevel.ERROR)
			return;

		return this._logMsg(Ci.nsIScriptError.errorFlag, msg);
	},

	warn(msg)
	{
		if (this.level < LogLevel.WARN)
			return;

		return this._logMsg(Ci.nsIScriptError.warningFlag, msg);
	},

	info(msg)
	{
		if (this.level < LogLevel.INFO)
			return;

		cs.logStringMessage("[" + ADDON_NAME + "] " + msg);
	},

	debug(msg)
	{
		if (this.level < LogLevel.DEBUG)
			return;

		dump(msg + "\n");
		cs.logStringMessage("[" + ADDON_NAME + "] " + msg);
	}
};

var io =
{
	init()
	{
		let dirSrv, profPath;

		dirSrv = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

		// db path in profile
		profPath = dirSrv.get("ProfD", Ci.nsIFile);
		profPath.append(ADDON_NAME);
		this.addonPath = profPath.path;
	},

	newURI(url)
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

	stat(fn, callback)
	{
		let path;

		path = OS.Path.join(this.addonPath, fn);

		OS.File.stat(path).then(callback, (res) =>
		{
			log.warn('file not found: ' + fn + ' ' + res);
		});
	},

	load(path, callback)
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

	loadText(path, callback)
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
				log.error('fail to read ' + path + ' file: ' + e);
			}
		});
	},

	loadFile(fn, callback)
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
			log.error('fail to load ' + fn + ' file: ' + e);
		}
	},

	saveFile(fn, data)
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

		(async()=>
		{
			let file;

			try
			{
				file = await OS.File.open(path, { write: true, trunc: true });
				await file.write(data);
				await file.flush();
			}
			catch(e)
			{
				log.error('fail to save ' + fn + ' file: ' + e);
			}
			finally
			{
				if (file)
					await file.close();
			}
		})();
	},

	onLoad(path, stat, callback)
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
			log.error('fail to read ' + path + ' file: ' + e);
		}
	}
};
io.init();
