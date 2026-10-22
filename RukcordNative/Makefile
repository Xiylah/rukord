TARGET := iphone:clang:latest:16.0
SDK = iPhoneOS16.5
ARCHS = arm64
INSTALL_TARGET_PROCESSES = Discord
THEOS_PACKAGE_SCHEME = rootless
FINALPACKAGE = 1
VERSION_CODE = 1100

include $(THEOS)/makefiles/common.mk

TWEAK_NAME = Rukcord
BUNDLE_NAME = RukcordResources

Rukcord_FILES = $(wildcard Sources/*.x Sources/*.xm Sources/*.m Sources/*.mm Sources/**/*.x Sources/**/*.xm Sources/**/*.m Sources/**/*.mm)
Rukcord_FILES := $(filter-out Sources/IPACompatibility.m,$(Rukcord_FILES))
Rukcord_LOGOSFLAGS = -c generator=internal
Rukcord_CFLAGS = -DRUKCORD_IPA=0 -fobjc-arc -DPACKAGE_VERSION='@"$(THEOS_PACKAGE_BASE_VERSION)"' -I$(THEOS_PROJECT_DIR)/Headers
Rukcord_CCFLAGS = -std=c++17 -Wno-c++11-narrowing -I$(THEOS_PROJECT_DIR)/Headers
Rukcord_FRAMEWORKS = Foundation UIKit CoreGraphics CoreText CoreFoundation UniformTypeIdentifiers MediaPlayer
Rukcord_LDFLAGS = -undefined dynamic_lookup

RukcordResources_INSTALL_PATH = "/Library/Application\ Support/"
RukcordResources_RESOURCE_DIRS = Resources

include $(THEOS_MAKE_PATH)/tweak.mk
include $(THEOS_MAKE_PATH)/bundle.mk

before-all::
	@test -s Resources/rukcord.js || (echo "Build the pinned Rukcord payload first"; exit 1)
	$(ECHO_NOTHING)mkdir -p Resources$(ECHO_END)
	$(ECHO_NOTHING)sed -e 's/@PACKAGE_VERSION@/$(THEOS_PACKAGE_BASE_VERSION)/g' \
		-e 's/@TWEAK_NAME@/$(TWEAK_NAME)/g' \
		Sources/payload-base.template.js > Resources/payload-base.js$(ECHO_END)

after-stage::
	$(ECHO_NOTHING)find $(THEOS_STAGING_DIR) -name ".DS_Store" -delete$(ECHO_END)

after-package::
	$(ECHO_NOTHING)rm -f Resources/payload-base.js$(ECHO_END)
