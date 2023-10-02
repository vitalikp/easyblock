EasyBlock
======
Firefox Add-on.<br/>
Automatically block site from blacklist.

rule separator — &lt;tab&gt; or two &lt;space&gt; characters<br/>
group separator — empty &lt;new line&gt; character<br/>
files location — &lt;profile dir&gt;/easyblock/

### Blacklist example (blacklist.txt)
```
# comment text
# block host “example.com” (also “www.example.com”)
example.com

# block “example.net” host by query path
example.net
# by pattern at the end path
# example.net/css/main.css
  main.css
# by pattern at the begin path
# example.net/img/logo.png
  /img/
# by absolute path
  /img/logo.png
# by MIME type in response
# example.net/img/test.jpg
  mtype:image/jpeg

# block “a.example.org” host
# by level domain
# a.example.org, x.a.example.org, y.a.example.org, z.a.example.org
a.example.org

# temporary disable “example.net” host
!example.net

# temporary disable “example.net” host with rules
!example.net
  main.css
  /img/
  type:image/jpeg

# filter document content with DOM rules
# remove element with id “test1”
example.com
  dom:#test1

# add “example.css“ stylesheet with “style” tag to document content
# change hyperlink color to red (see below “Stylesheet example”)
# css rule can be specified multiple times
example.com
  css:example

# add “example.js“ javascript with “script” tag to document content
# write message to console (see below “Javascript example”)
# js rule can be specified multiple times
example.net
  js:example

# add sites to “Group1” group
# group: Group1
example.com
example.net
mysite1.com
```

### Stylesheet example (example.css)
```
# change hyperlink color to red
a { color: red; }

```

### Javascript example (example.js)
```
# write message to console
console.log("example js message");

```

# License
The MIT License. See [LICENSE](LICENSE) file.
