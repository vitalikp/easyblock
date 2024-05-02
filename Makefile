#!/usr/bin/make -f

PACKAGE := easyblock
VERSION := 0.7.9
EXT = $(PACKAGE)-$(VERSION)


EXT_FILES = \
	install.rdf \
	chrome.manifest

FILES = \
	content \
	bootstrap.js

# tools
ZIP = /usr/bin/zip -r -q

.PHONY: all
ifneq (${V},1)
.SILENT:
endif

all: $(EXT)

$(EXT):
	@echo "building '$(EXT)' extension"
	@cd ext; $(ZIP) ../$(EXT).xpi $(EXT_FILES)
	$(ZIP) $(EXT).xpi $(FILES)

clean:
	@echo -e '\e[1m$@ $(PACKAGE)\e[0m'
	@if [ -e $(EXT).xpi ] ; then \
		echo -e "  \e[1;31mRM\e[0m\t"$(EXT).xpi ; \
		$(RM) $(EXT).xpi ; \
	fi
