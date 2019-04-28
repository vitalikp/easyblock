"use strict";


var EXPORTED_SYMBOLS = ["blhost"];


const tlds = ['com', 'net', 'org'];


function indexOf(arr, name, add)
{
	let i;

	if (!name)
		return -1;

	i = arr.indexOf(name);
	if (add && i < 0)
	{
		i = arr.length;
		arr.push(name);
	}

	return i;
}

function label(value)
{
	let i, ch;

	if (value.length > 63)
		throw new Error('label length must be 63 characters or less');

	i = value.length - 1;
	if (i < 0 || value[0] == '-' || i > 0 && value[i] == '-')
		throw new Error('first and last label character must be a letter or digit');

	i = 0;
	while (i < value.length)
	{
		ch = value[i++];
		if (ch != '-' && (ch < '0' || ch > 'z' || ch > '9' && ch < 'a'))
			throw new Error('label must contain letter, digit or minus characters');
	}

	return value;
}


function blhost(name, isrule)
{
	let data, i;

	if (name.length > 255)
		throw new Error('length must be 255 characters or less');

	this.tld = -1;
	this.data = [];

	name = name.toLowerCase();

	data = name.split('.');

	i = data.length - 1;
	if (i > 0)
	{
		this.tld = indexOf(tlds, label(data[i--]), isrule);
		if (this.tld < 0 || this.tld >= tlds.length)
			throw 'tld is unknown';

		while (i >= 0)
			this.data.push(label(data[i--]));
	}
}

blhost.prototype =
{
	hasHost: function(host)
	{
		let i;

		if (!host || !host.data)
			return false;

		if (host.tld != this.tld)
			return false;

		if (host.data.length < this.data.length)
			return false;

		i = 0;
		while (i < this.data.length)
		{
			if (host.data[i] != this.data[i])
				return false;
			i++;
		}

		return true;
	},

	toString: function()
	{
		let res = '', i;

		i = this.data.length - 1;
		while (i >= 0)
		{
			res += this.data[i--];
			res += '.';
		}

		res += tlds[this.tld];

		return res;
	}
};