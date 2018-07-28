"use strict";

const Ci = Components.interfaces;
const Cu = Components.utils;


function startup(data, reason)
{
	Cu.import("chrome://easyblock/content/easyblock.jsm");

	EasyBlock.startup(data);
}

function shutdown(data,reason)
{
	if (reason == APP_SHUTDOWN)
		return;

	EasyBlock.shutdown();
}

function install(data,reason) { }

function uninstall(data,reason) { }
