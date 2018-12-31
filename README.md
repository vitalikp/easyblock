EasyBlock
======
Firefox Add-on.
Automatically block site from blacklist (&lt;profile dir&gt;/easyblock/blacklist.txt).

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
  /img
# by MIME type in response
# example.net/img/test.jpg
  type:image/jpeg

# add sites to “Group1” group
# title: Group1
example.com
example.net
mysite1.com
```

# License
The MIT License. See [LICENSE](LICENSE) file.
