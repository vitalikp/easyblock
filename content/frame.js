"use strict";

const Cu = Components.utils;


// import
Cu.import("chrome://easyblock/content/content.js");

const global = this;


let handler;

handler = new SiteHandler(global);
addEventListener("DOMWindowCreated", handler);
addEventListener("DOMContentLoaded", handler);
addEventListener("unload", handler); // once is ignored here