"use strict";

this.EXPORTED_SYMBOLS = ["TabmixPlacesUtils"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);

XPCOMUtils.defineLazyModuleGetter(this, "Services",
  "resource://gre/modules/Services.jsm");

// these imports are used by PlacesUIUtils and PlacesUtils that we eval here
XPCOMUtils.defineLazyModuleGetter(this, "PluralForm",
  "resource://gre/modules/PluralForm.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "PrivateBrowsingUtils",
  "resource://gre/modules/PrivateBrowsingUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "OpenInTabsUtils",
  "resource:///modules/OpenInTabsUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "PlacesUIUtils",
  "resource:///modules/PlacesUIUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "PlacesUtils",
  "resource://gre/modules/PlacesUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "BrowserWindowTracker",
  "resource:///modules/BrowserWindowTracker.jsm");

XPCOMUtils.defineLazyModuleGetter(this,
  "TabmixSvc", "chrome://tabmix-resource/content/TabmixSvc.jsm");

// this function is use by PlacesUIUtils functions that we evaluate here
// eslint-disable-next-line no-unused-vars
function getBrowserWindow(aWindow) {
  return aWindow &&
      aWindow.document.documentElement.getAttribute("windowtype") ==
        "navigator:browser" ?
    aWindow :
    // eslint-disable-next-line no-undef
    BrowserWindowTracker.getTopWindow();
}

var PlacesUtilsInternal;
this.TabmixPlacesUtils = Object.freeze({
  init(aWindow) {
    PlacesUtilsInternal.init(aWindow);
  },

  onQuitApplication() {
    PlacesUtilsInternal.onQuitApplication();
  },

  applyCallBackOnUrl(aUrl, aCallBack) {
    return PlacesUtilsInternal.applyCallBackOnUrl(aUrl, aCallBack);
  },

  getTitleFromBookmark(aUrl, aTitle) {
    return PlacesUtilsInternal.asyncGetTitleFromBookmark(aUrl, aTitle);
  },

  asyncGetTitleFromBookmark(aUrl, aTitle) {
    return PlacesUtilsInternal.asyncGetTitleFromBookmark(aUrl, aTitle);
  },
});

var Tabmix = {};

function makeCode({value: code}) {
  if (!code.startsWith("function")) {
    code = "function " + code;
  }
  return eval("(" + code + ")");
}

PlacesUtilsInternal = {
  _timer: null,
  _initialized: false,

  init(aWindow) {
    if (this._initialized)
      return;
    this._initialized = true;

    Tabmix._debugMode = aWindow.Tabmix._debugMode;
    Tabmix.gIeTab = aWindow.Tabmix.extensions.gIeTab;
    Services.scriptloader.loadSubScript("chrome://tabmixplus/content/changecode.js");

    try {
      this.initPlacesUIUtils(aWindow);
    } catch (ex) {
      TabmixSvc.console.reportError(ex);
    }
  },

  onQuitApplication() {
    if (this._timer)
      this._timer.clear();

    this.functions.forEach(aFn => {
      PlacesUIUtils[aFn] = PlacesUIUtils["tabmix_" + aFn];
      delete PlacesUIUtils["tabmix_" + aFn];
    });
  },

  functions: ["openTabset", "openNodeWithEvent", "_openNodeIn"],
  initPlacesUIUtils: function TMP_PC_initPlacesUIUtils(aWindow) {
    try {
      PlacesUIUtils.openTabset.toString();
    } catch (ex) {
      if (aWindow.document.documentElement.getAttribute("windowtype") == "navigator:browser") {
        TabmixSvc.console.log("Starting with Firefox 21 Imacros 8.3.0 break toString on PlacesUIUtils functions." +
          "\nTabmix can't update PlacesUIUtils to work according to Tabmix preferences, use Imacros 8.3.1 and up.");
      }
      return;
    }

    this.functions.forEach(aFn => {
      PlacesUIUtils["tabmix_" + aFn] = PlacesUIUtils[aFn];
    });

    let code;

    function updateOpenTabset(name, treeStyleTab) {
      let openGroup = "    browserWindow.TMP_Places.openGroup(urls, where$1);";
      code = Tabmix.changeCode(PlacesUIUtils, "PlacesUIUtils." + name)._replace(
        'urls = []',
        'behavior, $&', {check: treeStyleTab}
      )._replace(
        /let openGroupBookmarkBehavior =|TSTOpenGroupBookmarkBehavior =/,
        '$& behavior =', {check: treeStyleTab, silent: true}
      )._replace(
        /browserWindow\.gBrowser\.loadTabs\([^;]+;/,
        'var changeWhere = where == "tabshifted" && aEvent.target.localName != "menuitem";\n' +
        '    if (changeWhere)\n' +
        '      where = "current";\n' +
        openGroup.replace("$1", treeStyleTab ? ", behavior" : "")
      );
      PlacesUIUtils[name] = makeCode(code);
    }
    var treeStyleTabInstalled = "TreeStyleTabBookmarksService" in aWindow;
    if (treeStyleTabInstalled &&
        typeof PlacesUIUtils.__treestyletab__openTabset == "function") {
      updateOpenTabset("__treestyletab__openTabset");
    } else if (treeStyleTabInstalled) {
      // wait until TreeStyleTab changed PlacesUIUtils.openTabset
      let timer = this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      this.__index = 0;
      timer.initWithCallback(() => {
        let str = PlacesUIUtils.openTabset.toString();
        if (++this.__index > 10 || str.indexOf("TreeStyleTabBookmarksService") > -1 ||
            str.indexOf("GroupBookmarkBehavior") > -1) {
          timer.cancel();
          this._timer = null;
          this.__index = null;
          updateOpenTabset("openTabset", true);
        }
      }, 50, Ci.nsITimer.TYPE_REPEATING_SLACK);
    } else { // TreeStyleTab not installed
      updateOpenTabset("openTabset");
    }

    let fnName = treeStyleTabInstalled && PlacesUIUtils.__treestyletab__openNodeWithEvent ?
      "__treestyletab__openNodeWithEvent" : "openNodeWithEvent";
    code = Tabmix.changeCode(PlacesUIUtils, "PlacesUIUtils." + fnName)._replace(
      /window.whereToOpenLink\(aEvent[,\s\w]*\)/, '{where: $&, event: aEvent}'
    );
    PlacesUIUtils[fnName] = makeCode(code);

    // Don't change "current" when user click context menu open (callee is PC_doCommand and aWhere is current)
    // we disable the open menu when the tab is lock
    // the 2nd check for aWhere == "current" is for non Firefox code that may call this function
    code = Tabmix.changeCode(PlacesUIUtils, "PlacesUIUtils._openNodeIn")._replace(
      '{', '$&\n' +
      '    var TMP_Event;\n' +
      '    if (arguments.length > 1 && typeof aWhere == "object") {\n' +
      '      TMP_Event = aWhere.event;\n' +
      '      aWhere = aWhere.where;\n' +
      '    }\n'
    )._replace(
      'aWindow.openTrustedLinkIn',
      'let browserWindow = getBrowserWindow(aWindow);\n' +
      '      if (browserWindow && typeof aWindow.TMP_Places == "object") {\n' +
      '        let TMP_Places = aWindow.TMP_Places;\n' +
      '        if (TMP_Event) aWhere = TMP_Places.isBookmarklet(aNode.uri) ? "current" :\n' +
      '                       TMP_Places.fixWhereToOpen(TMP_Event, aWhere);\n' +
      '        else if (aWhere == "current" && !TMP_Places.isBookmarklet(aNode.uri)) {\n' +
      '          if (!browserWindow.Tabmix.callerTrace("PC_doCommand")) {\n' +
      '            aWhere = TMP_Places.fixWhereToOpen(null, aWhere);\n' +
      '          }\n' +
      '        }\n' +
      '      }\n' +
      '      if (browserWindow && aWhere == "current")\n' +
      '        browserWindow.gBrowser.selectedBrowser.tabmix_allowLoad = true;\n' +
      '      $&'
    );
    PlacesUIUtils._openNodeIn = makeCode(code);
  },

  // Lazy getter for titlefrombookmark preference
  get titlefrombookmark() {
    const PREF = "extensions.tabmix.titlefrombookmark";
    let updateValue = () => {
      let value = Services.prefs.getBoolPref(PREF);
      let definition = {value, configurable: true};
      Object.defineProperty(this, "titlefrombookmark", definition);
      return value;
    };

    Services.prefs.addObserver(PREF, updateValue, false);
    return updateValue();
  },

  /* :::::::::::::::   AsyncPlacesUtils   ::::::::::::::: */

  fetch(guidOrInfo, onResult = null, options = {}) {
    return PlacesUtils.bookmarks.fetch(guidOrInfo, onResult, options);
  },

  async getBookmarkTitle(url) {
    try {
      const {guid, title} = await this.fetch({url});
      if (guid) {
        return title;
      }
    } catch (ex) {
      TabmixSvc.console.reportError(ex, 'Error function name changed', 'not a function');
    }
    return null;
  },

  async applyCallBackOnUrl(aUrl, aCallBack) {
    let hasHref = aUrl.indexOf("#") > -1;
    let result = await aCallBack.apply(this, [aUrl]) ||
        hasHref && await aCallBack.apply(this, aUrl.split("#"));
    // when IE Tab is installed try to find url with or without the prefix
    const ietab = Tabmix.gIeTab;
    if (!result && ietab) {
      let prefix = "chrome://" + ietab.folder + "/content/reloaded.html?url=";
      if (aUrl != prefix) {
        let url = aUrl.startsWith(prefix) ?
          aUrl.replace(prefix, "") : prefix + aUrl;
        result = await aCallBack.apply(this, [url]) ||
          hasHref && await aCallBack.apply(this, url.split("#"));
      }
    }
    return result;
  },

  async asyncGetTitleFromBookmark(aUrl, aTitle) {
    if (!this.titlefrombookmark || !aUrl) {
      return aTitle;
    }

    try {
      const getTitle = url => this.getBookmarkTitle(url);
      const title = await this.applyCallBackOnUrl(aUrl, getTitle);
      return title || aTitle;
    } catch (err) {
      TabmixSvc.console.reportError(err, 'Error form asyncGetTitleFromBookmark');
      return '';
    }
  },
};
