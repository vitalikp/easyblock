#!/usr/bin/make -f

export PACKAGE := easyblock
export VERSION := $(shell cat version)
EXT = $(PACKAGE)-$(VERSION)


EXT_FILES = \
	chrome.manifest

FILES = \
	install.rdf \
	content \
	bootstrap.js

# tools
CAT = /usr/bin/cat
ZIP = /usr/bin/zip -r -q

.PHONY: all
ifneq (${V},1)
.SILENT:
endif

all: $(EXT)

install.rdf: install.rdf.in
	@echo -e "  GEN\t$@"
	$(CAT) install.rdf.in|envsubst>install.rdf

$(EXT): install.rdf
	@echo "building '$(EXT)' extension"
	@cd ext; $(ZIP) ../$(EXT).xpi $(EXT_FILES)
	$(ZIP) $(EXT).xpi $(FILES)

clean:
	@echo -e '\e[1m$@ $(PACKAGE)\e[0m'
	@if [ -e install.rdf ] ; then \
		echo -e "  \e[1;31mRM\e[0m\t"install.rdf ; \
		$(RM) install.rdf ; \
	fi
	@if [ -e $(EXT).xpi ] ; then \
		echo -e "  \e[1;31mRM\e[0m\t"$(EXT).xpi ; \
		$(RM) $(EXT).xpi ; \
	fi