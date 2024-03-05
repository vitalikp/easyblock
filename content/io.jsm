"use strict";

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;
const CC = Components.Constructor;

var EXPORTED_SYMBOLS = ["LogLevel", "OFlags", "log", "io"];


const cs = Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);
const ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService2);
const LocalFile = CC("@mozilla.org/file/local;1", Ci.nsIFile, "initWithPath");
const FileStream = CC("@mozilla.org/network/file-stream;1", Ci.nsIFileStream, "init");
const BinaryInputStream = CC("@mozilla.org/binaryinputstream;1", Ci.nsIBinaryInputStream, "setInputStream");
const BinaryOutputStream = CC("@mozilla.org/binaryoutputstream;1", Ci.nsIBinaryOutputStream, "setOutputStream");
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


function File(path, parent)
{
	let file;

	if (parent)
	{
		file = new LocalFile(parent);
		file.append(path);
	}
	else
		file = new LocalFile(path);

	this.file = file;
	this.is = null;
	this.os = null;

	this.size = 0;
	this.sz = 0;
}

File.prototype =
{
	creat(mode = 0o640)
	{
		return this.open(OFlags.WRONLY|OFlags.CREAT|OFlags.TRUNC, mode);
	},

	open(oflags = OFlags.RDONLY, mode = 0)
	{
		let fs;

		if (this.is || this.os)
		{
			log.warn('file "' + this.file.path + '" already open?!');
			return false;
		}

		if (!this.file.exists() || !this.file.isFile())
		{
			if ((oflags & OFlags.CREAT) != OFlags.CREAT)
			{
				log.warn('file "' + this.file.path + '" not found!');
				return false;
			}
		}

		try
		{
			fs = new FileStream(this.file, oflags, mode, 0);

			if ((oflags & (OFlags.RDONLY|OFlags.RDWR)) != 0)
			{
				this.is = new BinaryInputStream(fs);
				this.size = this.file.fileSizeOfLink;
			}

			if ((oflags & (OFlags.WRONLY|OFlags.RDWR)) != 0)
				this.os = new BinaryOutputStream(fs);
		}
		catch (e)
		{
			log.error('fail to open "' + this.file.path + '" file: ' + e);
		}

		return this.is||this.os;
	},

	readInt(size)
	{
		if (!this.file || !this.is)
			return null;

		try
		{
			switch (size)
			{
				case 4:
					return this.is.read32();

				case 2:
					return this.is.read16();

				case 1:
					return this.is.read8();

				default:
					return null;
			}
		}
		catch (e)
		{
			log.error('fail to read from "' + this.file.path + '" file: ' + e);
		}
	},

	readStr(size = -1)
	{
		let dec, data;

		data = this.read(size);
		if (!data)
			return null;

		dec = new TextDecoder();

		try
		{
			return dec.decode(new Uint8Array(data));
		}
		catch (e)
		{
			log.error('fail to read from "' + this.file.path + '" file: ' + e);
		}
	},

	read(size = -1)
	{
		if (!this.file || !this.is)
			return null;

		try
		{
			if (size < 0)
				size = this.is.available();

			return this.is.readByteArray(size);
		}
		catch (e)
		{
			log.error('fail to read from "' + this.file.path + '" file: ' + e);
		}
	},

	writeInt(val, size)
	{
		if (Number.isInteger(val))
			return -1;

		if (!this.file || !this.os)
			return -1;

		try
		{
			switch (size)
			{
				case 4:
					this.os.write32(val);
					break;

				case 2:
					this.os.write16(val);
					break;

				case 1:
					this.os.write8(val);
					break;

				default:
					return -1;
			}

			this.sz += size;

			return size;
		}
		catch (e)
		{
			log.error('fail write to "' + this.file.path + '" file: ' + e);
		}
	},

	writeStr(data)
	{
		let enc;

		if (typeof data != "string")
			return -1;

		enc = new TextEncoder();

		try
		{
			data = enc.encode(data);
			return this.write(Array.from(data));
		}
		catch (e)
		{
			log.error('fail write to "' + this.file.path + '" file: ' + e);
		}
	},

	write(data)
	{
		let len;

		if (!Array.isArray(data))
			return -1;

		if (!this.file || !this.os)
			return -1;

		try
		{
			this.os.writeByteArray(data, data.length);
			this.sz += data.length;

			return data.length;
		}
		catch (e)
		{
			log.error('fail write to "' + this.file.path + '" file: ' + e);
		}
	},

	flush()
	{
		if (!this.os || this.sz < 1)
			return;

		this.os.flush();
		this.sz = 0;
	},

	close()
	{
		this.flush();
		if (this.is)
		{
			this.is.close();
			this.is = null;
		}
		if (this.os)
		{
			this.os.close();
			this.os = null;
		}
	},

	destroy()
	{
		this.file = null;
		this.close();
	}
}

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

		this.loadFile(path, callback);
	},

	loadFile(fn, callback)
	{
		let file;

		if (!fn || !callback)
			return;

		file = new File(fn, this.addonPath);

		if (file.open())
		{
			callback(file.readStr());
			file.close();
		}
	},

	saveFile(fn, data)
	{
		let file;

		if (!fn || !data)
			return;

		file = new File(fn, this.addonPath);
		if (file.creat())
		{
			file.writeStr(data);
			file.close();
		}
	}
};
io.init();