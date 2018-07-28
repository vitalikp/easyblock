"use strict";

const Cu = Components.utils;

// import
Cu.import("chrome://easyblock/content/easyblock.jsm");


function init()
{
	let elem;

	elem = document.getElementById("bl");

	EasyBlock.print(document, elem);
}
