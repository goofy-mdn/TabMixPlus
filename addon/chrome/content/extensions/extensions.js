/**
 * original code by onemen
 */


/**
 *
 * Fix compatibility with other extensions
 *
 */
var TMP_extensionsCompatibility = {
  onContentLoaded: function TMP_EC_onContentLoaded() {
    try {
      if ("TabGroupsManagerApiVer1" in window) {
        window.TMP_TabGroupsManager = {};
        window.TMP_TabGroupsManager.tabmixSessionsManager = function () {};
        let tmp = {};
        Components.utils.import("resource://tabmixplus/extensions/TabGroupsManager.jsm", tmp);
        tmp.TMP_TabGroupsManager.newCode = Tabmix.newCode;
        tmp.TMP_TabGroupsManager.init(window, gBrowser.tabContainer);
      }
    } catch (ex) {Tabmix.assert(ex, "error in TabGroupsManager.jsm");}

    // fix for Cluster Tabs - Cluster Tab look for TM_init
    // https://addons.mozilla.org/en-US/firefox/addon/cluster-tabs-for-firefox/
    if ("GlaxChrome" in window && typeof(window.GlaxChrome) == "object") {
      document.getElementById("main-window").setAttribute("gscltTMPinstalled", true);
      let func = ["_setupForOtherExtensions","enableCustomDragDropMode"];
      let GlaxChrome = window.GlaxChrome.CLT.DragDropManager;
      func.forEach(function(aFn) {
        if (aFn in GlaxChrome) {
          Tabmix.newCode("GlaxChrome.CLT.DragDropManager." + aFn , GlaxChrome[aFn])._replace(
            '{', '{var TabDNDObserver = TMP_tabDNDObserver;', {check: GlaxChrome[aFn].toString().indexOf("TabDNDObserver") != -1}
          )._replace(
            'TM_init', 'Tabmix.startup', {check: GlaxChrome[aFn].toString().indexOf("TM_init") != -1, flags: "g"}
          ).toCode();
        }
      });
    }

    Tabmix.extensions = {sessionManager: false, treeStyleTab: false};
    if ("com" in window && com.morac &&
        com.morac.gSessionManagerSessionBrowser ||
        "gSessionManager" in window) {
      Tabmix.extensions.sessionManager = true;
      // temp fix
      Tabmix.gSessionPath = TabmixSessionManager.gSessionPath;
      Tabmix.SessionManager = TabmixSessionManager;
      Tabmix.SessionData = TabmixSessionData;
      Tabmix.convertSession = TabmixConvertSession
    }

    try {
      if ("TreeStyleTabService" in window) {
        this.treeStyleTab.onContentLoaded();
        Tabmix.extensions.treeStyleTab = true;
      }
    } catch (ex) {Tabmix.assert(ex, this.treeStyleTab.errorMsg);}

    // https://addons.mozilla.org/en-US/firefox/addon/second-search/
    if ("SecondSearchBrowser" in window && SecondSearchBrowser.prototype) {
      let func = ["canOpenNewTab","loadForSearch","checkToDoSearch"];
      let SSB = SecondSearchBrowser.prototype;
      func.forEach(function(aFn) {
        if (aFn in SSB && SSB[aFn].toString().indexOf("TM_init") != -1) {
          Tabmix.newCode("SecondSearchBrowser.prototype." + aFn , SSB[aFn])._replace(
            'TM_init', 'Tabmix.startup'
          ).toCode();
        }
      });
    }

    // https://addons.mozilla.org/en-US/firefox/addon/fox-splitter-formerly-split-br/
    if ("SplitBrowser" in window) {
      let _getter = SplitBrowser.__lookupGetter__("tabbedBrowsingEnabled");
      if (_getter.toString().indexOf("TM_init") != -1) {
        Tabmix.newCode(null,  _getter)._replace(
          'TM_init', 'Tabmix.startup'
        ).toGetter(SplitBrowser, "tabbedBrowsingEnabled");
      }
    }

    // fix bug in backgroundsaver extension
    // that extension use function with the name getBoolPref
    // we replace it back here
    if ("bgSaverInit" in window && "getBoolPref" in window &&
            getBoolPref.toString().indexOf("return bgSaverPref.prefHasUserValue(sName)") != -1) {
      window.getBoolPref = function getBoolPref ( prefname, def ) {
        try {
          return TabmixSvc.prefs.getBoolPref(prefname);
        }
        catch(er) { return def; }
      }
    }

    /*  we don't use this code - leave it here as a reminder.

    // workaround for extensions that look for updateIcon
    // Favicon Picker 2
    if (typeof(gBrowser.updateIcon) == "undefined") {
      gBrowser.updateIcon = function updateIcon (aTab) {
        var browser = gBrowser.getBrowserForTab(aTab);
        if ((browser.mIconURL || "") != aTab.getAttribute("image")) {
          if (browser.mIconURL)
            aTab.setAttribute("image", browser.mIconURL);
          else
            aTab.removeAttribute("image");
          gBrowser._tabAttrModified(aTab);
        }
      }
    }
    */

    /*
    // https://addons.mozilla.org/en-US/firefox/addon/tab-flick/
    if ("TabFlick" in window && typeof(TabFlick.openPanel) == "function") {
      Tabmix.newCode("TMP_tabDNDObserver.onDragEnd", TMP_tabDNDObserver.onDragEnd)._replace(
        'gBrowser.replaceTabWithWindow(draggedTab);',
        'gBrowser.selectedTab = draggedTab; TabFlick.openPanel(aEvent);'
      ).toCode();
    }
    */


    // https://addons.mozilla.org/en-US/firefox/addon/bug489729-disable-detach-and-t//
    // we don't need to do any changes to bug489729 extension version 1.6+

  },

  onWindowOpen: function TMP_EC_onWindowOpen() {
    // Look for RSS/Atom News Reader
    if ("gotoLink" in window)
      this.wizzrss.init();

    if ("openNewsfox" in window)
      this.newsfox.init();

    if ("RSSTICKER" in window)
      this.RSSTICKER.init();

    if ("PersonaController" in window && typeof(window.PersonaController) == "object") {
      Tabmix.newCode('PersonaController._applyPersona', PersonaController._applyPersona)._replace(
        /(\})(\)?)$/,
        'if (TabmixTabbar.position == 1) {\
           gBrowser.tabContainer.style.backgroundImage = this._footer.style.backgroundImage; \
           gBrowser.tabContainer.setAttribute("persona", persona.id); \
         } \
         $1$2'
      ).toCode();

      Tabmix.newCode('PersonaController._applyDefault', PersonaController._applyDefault)._replace(
        /(\})(\)?)$/,
        'if (TabmixTabbar.position == 1) {\
           gBrowser.tabContainer.style.backgroundImage = ""; \
           gBrowser.tabContainer.removeAttribute("persona"); \
         } \
         $1$2'
      ).toCode();
    }

    // Firefox sync
    // fix bug in firefox sync that add new menu itep from each popupshowing
    if ("gFxWeaveGlue" in window) {
      Tabmix.newCode('gFxWeaveGlue.handleEvent', gFxWeaveGlue.handleEvent)._replace(
        'else if (this.getPageIndex() == -1)',
        'else if ((event.target.id == "alltabs-popup" || event.target.getAttribute("anonid") == "alltabs-popup") && this.getPageIndex() == -1)',
        {check: gFxWeaveGlue.handleEvent.toString().indexOf("else if (this.getPageIndex() == -1)") != -1}
      ).toCode();
    }

    // linkification extension
    if ("objLinkify" in window && "ClickLink" in objLinkify) {
      Tabmix.newCode("objLinkify.ClickLink", objLinkify.ClickLink)._replace(
        'if (bOpenWindow)',
        'if (bOpenWindow && !Tabmix.singleWindowMode)'
      )._replace(
        'if (bOpenTab)',
        'if (bOpenTab || Tabmix.whereToOpen(null).lock)'
      ).toCode();
    }

    // trigger tabmix function when user change tab width with faviconize extension
    if ("faviconize" in window && "toggle" in faviconize) {
      Tabmix.newCode("faviconize.toggle", faviconize.toggle)._replace(
        /(\})(\)?)$/,
        'TabmixTabbar.updateScrollStatus(); TabmixTabbar.updateBeforeAndAfter(); $1$2'
      ).toCode();
    }

    // make ChromaTabs extension compatible with Tabmix Plus
    // we can drop this soon version 2.3 from 2010-01 not use this code anymore
    if ("CHROMATABS" in window) {
      Tabmix.newCode("CHROMATABS.colorizeTab", CHROMATABS.colorizeTab)._replace(
        'node = doc.getAnonymousElementByAttribute(tab, "class", "tab-image-left");',
        'node = doc.getAnonymousElementByAttribute(tab, "class", "tab-image-left tab-startcap tab-left tab-left-border");', {silent: true}
      )._replace(
        'node = doc.getAnonymousElementByAttribute(tab, "class", "tab-image-middle");',
        'node = doc.getAnonymousElementByAttribute(tab, "class", "tab-middle box-inherit tab-image-middle tab-body");', {silent: true}
      )._replace(
        'node = doc.getAnonymousElementByAttribute(tab, "class", "tab-close-button");',
        'node = doc.getAnonymousElementByAttribute(tab, "anonid", "tmp-close-button");', {silent: true}
      )._replace(
        'node = doc.getAnonymousElementByAttribute(tab, "class", "tab-image-right");',
        'node = doc.getAnonymousElementByAttribute(tab, "class", "tab-image-right tab-endcap tab-right tab-right-border");', {silent: true}
      ).toCode();
    }

    // fix bug in superDargandGo
    try {
      if ("superDrag" in window && "contentAreaDNDObserver" in window) {
        Tabmix.newCode("contentAreaDNDObserver.onDrop", contentAreaDNDObserver.onDrop)._replace(
          'document.firstChild.getAttribute("windowtype")',
          'window.document.documentElement.getAttribute("windowtype")'
        )._replace(
          'preventBubble()',
          'stopPropagation()'
        ).toCode();
      }
    } catch (ex) {}

    // make URL Suffix extension compatible with tabmix
    if ("objURLsuffix" in window) {
      if ("handleURLBarCommand" in objURLsuffix) {
        Tabmix.newCode("objURLsuffix.handleURLBarCommand", objURLsuffix.handleURLBarCommand)._replace(
          'objURLsuffix.BrowserLoadURL(aTriggeringEvent, postData.value, altDisabled);',
          'Tabmix.browserLoadURL(aTriggeringEvent, postData.value, altDisabled);'
        )._replace(
          'objURLsuffix.BrowserLoadURL(aTriggeringEvent, postData.value);',
          'Tabmix.browserLoadURL(aTriggeringEvent, postData.value, true);'
        ).toCode();
      }

      if ("canonizeUrl" in objURLsuffix) {
        Tabmix.newCode("objURLsuffix.canonizeUrl", objURLsuffix.canonizeUrl)._replace(
          'return [gURLBar.value, aPostDataRef];',
          'return [gURLBar.value, aPostDataRef, true];'
        ).toCode();
      }

      window.handleURLBarCommand = objURLsuffix.handleURLBarCommand;
    }

    try {
      if ("TreeStyleTabService" in window)
        this.treeStyleTab.onWindowLoaded();
    } catch (ex) {Tabmix.assert(ex, this.treeStyleTab.errorMsg);}

    /* fast dial FdUtils*/
    if ("FdUtils" in window && FdUtils.whereToOpenLink) {
      Tabmix.newCode("FdUtils.whereToOpenLink", FdUtils.whereToOpenLink)._replace(
        'if (e.ctrlKey)',
        'if (e.ctrlKey || Tabmix.whereToOpen(null).lock)'
      ).toCode();
    }

    // for MR Tech's local install extention
    if (typeof(Local_Install) == "object") {
      // don't open trober in current tab when tab is locked
      // or trober is to diffrent site then the current
      Tabmix.newCode("Local_Install.openThrobber", Local_Install.openThrobber)._replace(
        'local_common.openURL(local_common.getThrobberURL(), inNewTab);',
        'var url = local_common.getThrobberURL(); \
         local_common.openURL(url, inNewTab ? inNewTab : Tabmix.checkCurrent(url) == "tab");'
      ).toCode();
      // add name to closeallOverlay.onUnload we use it in goQuitApplication
      if ("closeallOverlay" in window && "onUnload" in closeallOverlay) {
        Tabmix.newCode(null, closeallOverlay.onUnload)._replace(
          /function(\s+)\(/,
          "function toolkitCloseallOnUnload("
        ).toCode(false, closeallOverlay, "onUnload");
      }
    }

    if ("FireGestures" in window) {
      // unable to close surce tab after duplicate with FireGestures esextension
      // problem fix in FireGestures 1.5.7 keep this here for users with older versions
      let performAction = FireGestures._performAction.toString();
      let codeToReplace = "gBrowser.moveTabTo(newTab, ++orgTab._tPos);"
      if (performAction.indexOf(codeToReplace) != -1) {
        Tabmix.newCode("FireGestures._performAction", performAction)._replace(
          codeToReplace, 'gBrowser.moveTabTo(newTab, orgTab._tPos + 1);'
        ).toCode();
      }

      FireGestures.closeMultipleTabs = function(aLeftRight) {
        if (aLeftRight == "left")
          gBrowser._closeLeftTabs(gBrowser.mCurrentTab);
        else
          gBrowser._closeRightTabs(gBrowser.mCurrentTab);
      }
    }

    // fix bug in new tab button on right extension when we use multi row
    if ("newTabButtons" in window) {
      let newbuttonRight = document.getAnonymousElementByAttribute(tabBar, "id", "tabs-newbutton-right");
      let newbuttonEnd = document.getAnonymousElementByAttribute(tabBar, "id", "tabs-newbutton-end");
      if (newbuttonRight && newbuttonEnd)
        newbuttonEnd.parentNode.insertBefore(newbuttonRight, newbuttonEnd);
    }

    // https://addons.mozilla.org/en-us/firefox/addon/mouse-gestures-redox/
    if ("mgBuiltInFunctions" in window) {
      Tabmix.newCode("mgBuiltInFunctions.mgNewBrowserWindow", mgBuiltInFunctions.mgNewBrowserWindow)._replace(
        'window.open();',
        'if (!Tabmix.singleWindowMode) window.open();'
      ).toCode();
    }

    // Redirect Remover 2.6.4
    if ("rdrb" in window && rdrb.delayedInit) {
      Tabmix.newCode("TabmixContext.openMultipleLinks", TabmixContext.openMultipleLinks)._replace(
        'if (links_urlSecurityCheck(url))',
        'url = rdrb.cleanLink(url);\
         $&'
      ).toCode();
    }

  },

  onDelayedStartup: function TMP_EC_onDelayedStartup() {
    //XXX some themes uses old tabmix_3.xml version and call _createTabsList
    // for now we don't do changes for other themes regarding scroll buttons oncontextmenu
    // with the new code in scrollbox.xml
    // this need more testing with other themes

    // check if Greasemonkey installed
    Tabmix.contentAreaClick.isGreasemonkeyInstalled();
  }

}

TMP_extensionsCompatibility.RSSTICKER = {
   init : function ()  {
     Tabmix.newCode("RSSTICKER.writeFeed", RSSTICKER.writeFeed)._replace(
       'tbb.setAttribute("onclick"',
       'tbb.setAttribute("onclick", "this.onClick(event);");\
        tbb.setAttribute("_onclick"'
     )._replace(
       'tbb.onContextOpen =',
       'tbb.onContextOpen = TMP_extensionsCompatibility.RSSTICKER.onContextOpen; \
        tbb.onClick = TMP_extensionsCompatibility.RSSTICKER.onClick; \
        tbb._onContextOpen ='
     ).toCode();
   },

   onClick : function (event) {
     if (event.ctrlKey) {
       this.markAsRead(true);
     }
     else if ((this.parent.alwaysOpenInNewTab && (event.which == 1)) || (event.which == 2)) {
       this.onContextOpen("tab");
     }
     else if (event.which == 1) {
       this.onContextOpen();
     }
   },

   onContextOpen : function (target) {
     if (!target) {
       if (Tabmix.whereToOpen(null).lock)
         this.parent.browser.openInNewTab(this.href);
       else
         window._content.document.location.href = this.href;
     }
     else if (target == "window") {
       if (Tabmix.singleWindowMode)
         this.parent.browser.openInNewTab(this.href);
       else
         window.open(this.href);
     }
     else if (target == "tab") {
       this.parent.browser.openInNewTab(this.href);
     }

     this.markAsRead();
   }
}

// prevent Wizz RSS from load pages in locked tabs
TMP_extensionsCompatibility.wizzrss = {
  started: null,
  init : function ()  {
    if (this.started)
      return;
    this.started = true;
    var codeToReplace = /getContentBrowser\(\).loadURI|contentBrowser.loadURI/g;
    const newCode = "TMP_extensionsCompatibility.wizzrss.openURI";
    var _functions = ["addFeedbase","validate","gohome","tryagain","promptStuff",
                      "doSearch","viewLog","renderItem","playEnc","renderAllEnc","playAllEnc",
                      "gotoLink","itemLinkClick","itemListClick"];

    _functions.forEach(function(_function) {
      if (_function in window)
        Tabmix.newCode("window." + _function, window[_function])._replace(codeToReplace,newCode).toCode();
    });
  },

  openURI : function (uri)  {
    var w = Tabmix.getTopWin();
    var tabBrowser = w.gBrowser;

    var openNewTab = w.Tabmix.whereToOpen(true).lock;
    if (openNewTab) {
      var theBGPref = !readPref("WizzRSSFocusTab", false, 2);
      tabBrowser.loadOneTab(uri, {inBackground: theBGPref});
    }
    else
      tabBrowser.loadURI(uri);
  }
}

// prevent Newsfox from load pages in locked tabs
TMP_extensionsCompatibility.newsfox = {
   init : function ()  {
      Tabmix.newCode("openNewsfox", openNewsfox)._replace(
         /if \(newTab\) {/,
         'newTab = newTab || Tabmix.whereToOpen(null).lock; \
         $&'
      ).toCode();
   }
}

/**
 * fix incompatibilities with treeStyleTab
 * we get here only if "TreeStyleTabService" exist in window
 *
 *  https://addons.mozilla.org/en-US/firefox/addon/tree-style-tab/
 */
TMP_extensionsCompatibility.treeStyleTab = {
  errorMsg: "Error in Tabmix when trying to load compatible functions with TreeStyleTab extension",
  // flag for version after 2011.01.13.01
  isNewVersion: function () {
    try {
      return TreeStyleTabService.overrideExtensionsOnInitAfter.toString().indexOf("TabmixTabbar") != -1;
    } catch (ex) {}
    return false;
  },

  onContentLoaded: function () {
    if (!this.isNewVersion) {
      if ("overrideExtensionsOnInitAfter" in TreeStyleTabService) {
        // TMupdateSettings replaced with TabmixTabbar.updateSettings
        // TabDNDObserver replaced with TMP_tabDNDObserver
        // tabBarScrollStatus replaced with TabmixTabbar.updateScrollStatus

        Tabmix.newCode("TreeStyleTabService.overrideExtensionsOnInitAfter", TreeStyleTabService.overrideExtensionsOnInitAfter)._replace(
          '{', '{var TabDNDObserver = TMP_tabDNDObserver;'
        )._replace(
          'this.updateTabDNDObserver(TabDNDObserver);',
          'this.updateTabDNDObserver(gBrowser);'
        )._replace( /* we don't need it, tabmix Tabmix.browserHome calls gBrowser.loadTabs */
          'eval("window.TM_BrowserHome = "',
          'if (false) $&'
        )._replace(
          '"TMupdateSettings" in window', 'true'
        )._replace(
          'TMupdateSettings',
          'TabmixTabbar.updateSettings', {flags: "g"}
        )._replace(
          'tabBarScrollStatus()',
          'TabmixTabbar.updateScrollStatus()'
        )._replace(
          'window.tabscroll == 2;',
          'window.TabmixTabbar.isMultiRow;'
        )._replace(
          'getRowHeight',
          'TabmixTabbar.getRowHeight', {flags: "g"}
        ).toCode();

        /* for treeStyleTab extension look in treeStyleTab hacks.js
           we remove tabxTabAdded function and use TMP_eventListener.onTabOpen from 0.3.7pre.080815
        */
        window.tabxTabAdded = function _tabxTabAdded() {
          // remove eventListener added by treeStyleTab on first call to tabxTabAdded
          gBrowser.tabContainer.removeEventListener('DOMNodeInserted', tabxTabAdded, true);
          return;
        }
      }

      if ('piro.sakura.ne.jp' in window && "tabsDragUtils" in window['piro.sakura.ne.jp']) {
        let tabsDragUtils = window['piro.sakura.ne.jp'].tabsDragUtils;
        Tabmix.newCode("tabsDragUtils._delayedInit", tabsDragUtils._delayedInit)._replace(
          'if ("TabDNDObserver" in window)',
          'this.initTabDNDObserver(TMP_tabDNDObserver);\
           $&'
        ).toCode(false, tabsDragUtils, "_delayedInit");
      }
    }

    // we don't need this in the new version since we change the tabs-frame place
    // keep it here for non default theme that uses old Tabmix binding
    if ("TreeStyleTabBrowser" in window) {
      let fn = TreeStyleTabBrowser.prototype.initTabbar;
      if (fn.toString().indexOf("d = this.document") == -1) {
        Tabmix.newCode("TreeStyleTabBrowser.prototype.initTabbar", TreeStyleTabBrowser.prototype.initTabbar)._replace(
          'newTabBox = document.getAnonymousElementByAttribute(b.mTabContainer, "id", "tabs-newbutton-box");',
          'let newTabButton = document.getElementById("new-tab-button"); \
           if (newTabButton && newTabButton.parentNode == gBrowser.tabContainer._container) \
             newTabBox = newTabButton;'
        )._replace(
          'newTabBox.orient',
          'if (newTabBox) $&', {flags: "g"}
        ).toCode();
      }
    }

    // we removed TMP_howToOpen function 2011-11-15
    if ("TreeStyleTabWindowHelper" in window && TreeStyleTabWindowHelper.overrideExtensionsAfterBrowserInit) {
      Tabmix.newCode("TreeStyleTabWindowHelper.overrideExtensionsAfterBrowserInit",
          TreeStyleTabWindowHelper.overrideExtensionsAfterBrowserInit)._replace(
        'eval("window.TMP_howToOpen',
        'if (false) $&'
      ).toCode();
    }
  },

  onWindowLoaded: function () {
    /**
     *  TST have eval to TMP_Bookmark.openGroup
     *  we replace TMP_Bookmark.openGroup with TMP_Places.openGroup at Tabmix 0.3.8.2pre.090830
     *  we also replace call to TreeStyleTabService.openGroupBookmarkBehavior();
     *  with aOpenGroupBookmarkBehavior that we pass from PlacesUIUtils._openTabset
     *  we only call this functiom from browserWindow so we don't need to call it for
     *  other places windows
     */
    Tabmix.newCode("TMP_Places.openGroup", TMP_Places.openGroup)._replace(
      /(function[^\(]*\([^\)]+)(\))/,
      '$1, TSTOpenGroupBookmarkBehavior$2'
    )._replace(
      '{',
      '{if (TSTOpenGroupBookmarkBehavior == null) TSTOpenGroupBookmarkBehavior = TreeStyleTabService.openGroupBookmarkBehavior();'
    )._replace(
      'index = prevTab._tPos + 1;',
      <![CDATA[
        index = gBrowser.treeStyleTab.getNextSiblingTab(gBrowser.treeStyleTab.getRootTab(prevTab));
        if (tabToSelect == aTab) index = gBrowser.treeStyleTab.getNextSiblingTab(index);
          index = index ? index._tPos : (prevTab._tPos + 1);
      ]]>
    )._replace(
      'prevTab = aTab;',
      <![CDATA[
        $&
        if (tabToSelect == aTab && TSTOpenGroupBookmarkBehavior & TreeStyleTabService.kGROUP_BOOKMARK_SUBTREE) {
          TreeStyleTabService.readyToOpenChildTab(tabToSelect, true, gBrowser.treeStyleTab.getNextSiblingTab(tabToSelect));
        }
      ]]>
    )._replace(
      'tabBar.nextTab',
      <![CDATA[
        if (TSTOpenGroupBookmarkBehavior & TreeStyleTabService.kGROUP_BOOKMARK_SUBTREE)
          TreeStyleTabService.stopToOpenChildTab(tabToSelect);
      $&]]>
    ).toCode();

    if (TreeStyleTabService.getTreePref('compatibility.TMP')) {
      // Added 2010-04-10
      // TST look for aTab.removeAttribute("tabxleft")
      Tabmix.newCode("window.TabmixTabbar.updateSettings", TabmixTabbar.updateSettings)._replace(
        'TabmixSessionManager.updateTabProp(aTab);',
        '$& \
         gBrowser.treeStyleTab.initTabAttributes(aTab);\
         gBrowser.treeStyleTab.initTabContentsOrder(aTab);'
      ).toCode();
      // Added 2010-04-10
      Tabmix.newCode("TMP_eventListener.onTabOpen", TMP_eventListener.onTabOpen)._replace(
        /(\})(\)?)$/,
        'gBrowser.treeStyleTab.initTabAttributes(aTab); \
         gBrowser.treeStyleTab.initTabContentsOrder(aTab); \
         $1$2'
      ).toCode();
      // Added 2011-11-09, i'm not sure we relay need it, Tabmix.loadTabs call gBrowser.loadTabs
      Tabmix.newCode("TabmixContext.openMultipleLinks", TabmixContext.openMultipleLinks)._replace(
        /(Tabmix.loadTabs\([^\)]+\);)/g,
        'TreeStyleTabService.readyToOpenChildTab(gBrowser, true); $1 TreeStyleTabService.stopToOpenChildTab(gBrowser);'
      ).toCode();
    }
  }
}
