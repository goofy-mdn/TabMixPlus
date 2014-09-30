"use strict";

var EXPORTED_SYMBOLS = ["TabmixContentClick"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "PrivateBrowsingUtils",
  "resource://gre/modules/PrivateBrowsingUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "Services",
  "resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "ContentClick",
  "resource:///modules/ContentClick.jsm");

XPCOMUtils.defineLazyModuleGetter(this,
  "TabmixSvc", "resource://tabmixplus/Services.jsm");

this.TabmixContentClick = {
  init: function() {
    ContentClickInternal.init();
  },

  onQuitApplication: function() {
    ContentClickInternal.onQuitApplication();
  },

  getParamsForLink: function(event, linkNode, href, browser, focusedWindow) {
    return ContentClickInternal.getParamsForLink(event, linkNode, href, browser, focusedWindow);
  },

  contentLinkClick: function(event, browser, focusedWindow) {
    ContentClickInternal.contentLinkClick(event, browser, focusedWindow);
    if (event.__hrefFromOnClick)
      event.stopImmediatePropagation();
    ContentClickInternal.resetData();
  },

  isGreasemonkeyInstalled: function(window) {
    ContentClickInternal.isGreasemonkeyInstalled(window);
  },

  isLinkToExternalDomain: function(curpage, url) {
    return ContentClickInternal.isLinkToExternalDomain(curpage, url);
  },

  isUrlForDownload: function(url) {
    if (TabmixSvc.prefBranch.getBoolPref("enablefiletype"))
      return ContentClickInternal.isUrlForDownload(url);
    return false;
  },

  selectExistingTab: function(href, targetAttr) {
    ContentClickInternal.selectExistingTab(href, targetAttr);
  }
}
Object.freeze(TabmixContentClick);

let Tabmix = { }

let ContentClickInternal = {
  _timer: null,
  _initialized: false,

  init: function() {
    if (!TabmixSvc.version(320) || this._initialized)
      return;
    this._initialized = true;

    Tabmix._debugMode = TabmixSvc.debugMode();
    Services.scriptloader.loadSubScript("chrome://tabmixplus/content/changecode.js");

    let mm = Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIMessageListenerManager);
    mm.addMessageListener("TabmixContent:Click", this);

    this.initContentAreaClick();
  },

  onQuitApplication: function () {
    if (this._timer)
      this._timer.clear();

    if (!this._initialized)
      return;

    this.functions.forEach(function(aFn) {
      ContentClick[aFn] = ContentClick["tabmix_" + aFn];
      delete ContentClick["tabmix_" + aFn];
    });
  },

  functions: ["contentAreaClick"],
  initContentAreaClick: function TMP_initContentAreaClick() {
    try {
      let test = ContentClick.contentAreaClick.toString();
    } catch (ex) { return; }

    this.functions.forEach(function(aFn) {
      ContentClick["tabmix_" + aFn] = ContentClick[aFn];
    });

    Tabmix.changeCode(ContentClick, "ContentClick.contentAreaClick")._replace(
      'var where = window.whereToOpenLink(json);',
      'var data = json.tabmix || {where: window.whereToOpenLink(json)};\n' +
      '    var {where, targetAttr, suppressTabsOnFileDownload} = data;\n' +
      '    if (where == "default" && targetAttr) {\n' +
      '      window.setTimeout(function(){\n' +
      '        window.Tabmix.ContentClick.selectExistingTab(json.href, targetAttr);\n' +
      '      },300);\n' +
      '    }\n'
    )._replace(
      'where == "current"',
      '!json.tabmix && where == "current" || where == "default"'
    )._replace(
      'referrerURI: browser.documentURI,',
      '$&\n' +
      '                                          suppressTabsOnFileDownload: suppressTabsOnFileDownload || false,'
    ).toCode();
  },

  receiveMessage: function (message) {
    if (message.name != "TabmixContent:Click")
      return null;

    let {json, href} = message.data;
    let {node, onClickNode, focusedWindow} = message.objects;
    let browser = message.target;

    // return value to the message caller
    if (onClickNode) {
      let result = this.getHrefFromNodeOnClick(json, browser, focusedWindow, onClickNode);
      return {where: result ? "handled" : "default"};
    }
    return this.getParamsForLink(json, node, href, browser, focusedWindow, true);
  },

  // for non-link element with onclick that change location.href
  getHrefFromNodeOnClick: function(event, browser, focusedWindow, onClickNode) {
    let node = onClickNode || this._getNodeWithOnClick(event);
    if (!node || !this.getHrefFromOnClick(event, null, node,
                      node.getAttribute("onclick")))
      return false;

    let href = event.__hrefFromOnClick;
    let result = this.getParamsForLink(event, null, href, browser, focusedWindow, true, node);
    if (result.where == "default") {
      event.__hrefFromOnClick = null;
      return false;
    }

    let win = browser.ownerDocument.defaultView;
    win.openLinkIn(href, result.where, {
      referrerURI: browser.documentURI,
      charset: browser.characterSet,
      suppressTabsOnFileDownload: result.suppressTabsOnFileDownload
    });

    return true;
  },

  getParamsForLink: function(event, node, href, browser, focusedWindow, clean, onClickNode) {
    this._browser = browser;
    this._window = browser.ownerDocument.defaultView;
    this._focusedWindow = focusedWindow;

    let targetAttr = this.getTargetAttr(node);
    let [where, suppressTabsOnFileDownload] =
        this.whereToOpen(event, node, href, targetAttr, onClickNode);

    // for debug
    where = where.split("@")[0];
    // we only use the format where.xxxx in window.contentAreaClick
    // see contentLinks.js
    if (clean)
      where = where.split(".")[0];
    if (where == "current")
      browser.tabmix_allowLoad = true;

    // don't call this._data.hrefFromOnClick
    // if __hrefFromOnClick did not set by now we won't use it
    if (where != "default" && event.__hrefFromOnClick)
      href = event.__hrefFromOnClick;

    this.resetData();

    return {
      where: where,
      _href: href,
      suppressTabsOnFileDownload: suppressTabsOnFileDownload || false,
      targetAttr: targetAttr
    };
  },

  _data: null,
  resetData: function() {
    this._data = null;
    this._browser = null;
    this._window = null;
    this._focusedWindow = null;
  },

  getPref: function() {
    XPCOMUtils.defineLazyGetter(this, "targetPref", function() {
      return TabmixSvc.prefBranch.getIntPref("opentabforLinks");
    });

    let tabBrowser = this._window.gBrowser;
    XPCOMUtils.defineLazyGetter(this, "currentTabLocked", function() {
      return tabBrowser.selectedTab.hasAttribute("locked");
    });
  },

  /*
   * @param event            A valid event union.
   * @param href             href string.
   * @param linkNode         The DOM node containing the URL to be opened.
   * @param targetAttr       The target attribute of the link node.
   * @param onClickNode      DOM node containing onclick, may exist only
   *                         when linkNode is null.
   */
  getData: function(event, href, linkNode, targetAttr, onClickNode) {
    let self = this;
    function LinkData() {
      this.event = event;
      this.href = href;
      this.linkNode = linkNode;
      this.onClickNode = onClickNode || null;
      this.targetAttr = targetAttr;
      XPCOMUtils.defineLazyGetter(this, "currentURL", function() {
        return self._browser.currentURI ? self._browser.currentURI.spec : "";
      });
      XPCOMUtils.defineLazyGetter(this, "onclick", function() {
        if (linkNode && linkNode.hasAttribute("onclick"))
          return linkNode.getAttribute("onclick");
        return null;
      });
      XPCOMUtils.defineLazyGetter(this, "hrefFromOnClick", function() {
        return self.getHrefFromOnClick(event, href, linkNode, self._data.onclick);
      });
      XPCOMUtils.defineLazyGetter(this, "isLinkToExternalDomain", function() {
       /*
        * Check if link refers to external domain.
        * Get current page url
        * if user click a link while the page is reloading linkNode.ownerDocument.location can be null
        */
        let node = linkNode || onClickNode;
        ///XXX [object CPOW [object HTMLDocument]] linkNode.ownerDocument
        let location = node.ownerDocument.location;
        let curpage = location ? location.href || location.baseURI : self._data.currentURL;
        let href = self._data.hrefFromOnClick || self._window.XULBrowserWindow.overLink || node;
        return self.isLinkToExternalDomain(curpage, href);
      });
    }

    this._data = new LinkData();
  },

  whereToOpen: function TMP_whereToOpen(event, linkNode, href, targetAttr, onClickNode) {
    let eventWhere;
    let TMP_tabshifted = function TMP_tabshifted(event) {
      var where = eventWhere || this._window.whereToOpenLink(event);
      return where == "tabshifted" ? "tabshifted" : "tab";
    }.bind(this);

  ///XXX check again how SubmitToTab work
    if (typeof(this._window.SubmitToTab) != 'undefined') {
      let target = event.target;
      if (target instanceof HTMLButtonElement ||
          target instanceof HTMLInputElement) {
        if (SubmitToTab.contentAreaClick(event) == false) {
          return ["default@1"];
        }
      }
    }

    if (!linkNode && !onClickNode)
      return ["default@2"];

    this.getPref();
    this.getData(event, href, linkNode, targetAttr, onClickNode);

    // whereToOpenLink return save or window
    eventWhere = this._window.whereToOpenLink(event);
    if (/^save|window/.test(eventWhere)) {
      // make sure to trigger hrefFromOnClick getter
      this._data.hrefFromOnClick;
      return [eventWhere + "@2.1"];
    }

    /*
     * prevents tab form opening when clicking Greasemonkey script
     */
    if (this.isGreasemonkeyScript(href))
      return ["default@3"];

    // Check if new tab already opened from onclick event // 2006-09-26
    if (linkNode && this._data.onclick && linkNode.ownerDocument.location.href != this._focusedWindow.top.location.href)
      return ["default@4"];

    if (linkNode && linkNode.getAttribute("rel") == "sidebar" || targetAttr == "_search" ||
        href.indexOf("mailto:") > -1) {
      return ["default@5"];
    }

    /*
     * prevent tabs from opening if left-clicked link ends with given filetype or matches regexp;
     * portions were taken from disable target for downloads by cusser
     */
    if (this.suppressTabsOnFileDownload()) {
        // don't do anything if we are on gmail and let gmail take care of the download
        let url = this._data.currentURL;
        let isGmail = /^(http|https):\/\/mail.google.com/.test(url);
        let isHttps = /^https/.test(href);
        if (isGmail || isHttps)
           return ["default@6", true];
        return ["current@7", true];
    }

    // check this after we check for suppressTabsOnFileDownload
    // for the case the link have a matche in our list
    if (typeof event.tabmix_openLinkWithHistory == "boolean")
      return ["current@9"];

    // don't mess with links that have onclick inside iFrame
    ///XXX [object CPOW [object HTMLDocument]] linkNode.ownerDocument
    let onClickInFrame = onClickNode && onClickNode.ownerDocument.defaultView.frameElement ||
        this._data.onclick && linkNode.ownerDocument.defaultView.frameElement;

    /*
     * force a middle-clicked link to open in the current tab if certain conditions
     * are true. See the function comment for more details.
     */
    if (this.divertMiddleClick()) {
      // make sure to trigger hrefFromOnClick getter
      this._data.hrefFromOnClick;
      return [onClickInFrame ? "current.frame@10" : "current@10"];
    }

    if (onClickInFrame)
      return ["default@11"];

    // catch other middle & right click
    if (event.button != 0) {
      return event.button == 1 && this._data.hrefFromOnClick ?
              [TMP_tabshifted(event) + "@12"] : ["default@12"]
    }

    // the rest of the code if for left-click only

    /*
     * don't change default behavior for links that point to exiting frame
     * in the current page
     */
    if (this.targetIsFrame())
      return ["default@13"];

    /*
     * open targeted links in the current tab only if certain conditions are met.
     * See the function comment for more details.
     */
    if (this.divertTargetedLink())
      return ["current@14"];

    /*
     * open links to other sites in a tab only if certain conditions are met. See the
     * function comment for more details.
     */
    if (this.openExSiteLink())
      return [TMP_tabshifted(event) + "@15"];

    if (this.currentTabLocked || this.targetPref == 1) { // tab is locked
      let openNewTab = this.openTabfromLink();
      if (openNewTab != null)
        return [(openNewTab ? TMP_tabshifted(event) : "default") + "@16"];
    }
    return ["default@17"];
  },

  /**
   * @brief For non-remote browser:
   *        handle left-clicks on links when preference is to open new tabs from links
   *        links that are not handled here go on to the page code and then to contentAreaClick
   */
  contentLinkClick: function(aEvent, aBrowser, aFocusedWindow) {
    aEvent.tabmix_isRemote = aBrowser.getAttribute("remote") == "true";
    if (aEvent.tabmix_isRemote)
      return "1";

    if (typeof aEvent.tabmix_openLinkWithHistory == "boolean")
      return "2";

    let win = aBrowser.ownerDocument.defaultView;
    let [href, linkNode] = win.hrefAndLinkNodeForClickEvent(aEvent);
    if (!href) {
      if (this.getHrefFromNodeOnClick(aEvent, aBrowser, aFocusedWindow))
        aEvent.preventDefault();
      return "2.1";
    }

    if (aEvent.button != 0 || aEvent.shiftKey || aEvent.ctrlKey || aEvent.altKey || aEvent.metaKey) {
      if (/^save|window|tab/.test(win.whereToOpenLink(aEvent)))
        this.getHrefFromOnClick(aEvent, href, linkNode, linkNode.getAttribute("onclick"));
      return "3";
    }

    this._browser = aBrowser;
    this._window = win;
    this._focusedWindow = aFocusedWindow;

    this.getPref();
    if (!this.currentTabLocked && this.targetPref == 0)
      return "4";

    if (!linkNode)
      return "5";

    let targetAttr = this.getTargetAttr(linkNode);
    this.getData(aEvent, href, linkNode, targetAttr);

    var currentHref = this._data.currentURL;
    // don't do anything on mail.google or google.com/reader
    var isGmail = /^(http|https):\/\/mail.google.com/.test(currentHref) || /^(http|https):\/\/\w*.google.com\/reader/.test(currentHref);
    if (isGmail)
      return "6";

    if ("className" in linkNode) {
      // don't interrupt with noscript
      if (linkNode.className.indexOf("__noscriptPlaceholder__") > -1)
        return "7";

      // need to find a way to work here only on links
      if (/button/.test(linkNode.className.toLowerCase()))
        return "8";
    }

    // don't interrupt with fastdial links
    ///XXX [object CPOW [object HTMLDocument]] linkNode.ownerDocument
    if ("ownerDocument" in linkNode && this._window.Tabmix.isNewTabUrls(linkNode.ownerDocument.documentURI))
      return "9";

    if (linkNode.getAttribute("rel") == "sidebar" || targetAttr == "_search" ||
          href.indexOf("mailto:") > -1)
      return "10";

    /*
     * prevents tab form opening when clicking Greasemonkey script
     */
    if (this.isGreasemonkeyScript(href))
      return "11";

    /*
     * prevent tabs from opening if left-clicked link ends with given filetype or matches regexp;
     * portions were taken from disable target for downloads by cusser
     */
    if (this.suppressTabsOnFileDownload())
      return "12";

    // don't mess with links that have onclick inside iFrame
    ///XXX [object CPOW [object HTMLDocument]] linkNode.ownerDocument
    if (this._data.onclick && linkNode.ownerDocument.defaultView.frameElement)
      return "13";

    /*
     * don't change default behavior for links that point to exiting frame
     * in the current page
     */
    if (this.targetIsFrame())
      return "14";

    /*
     * open targeted links in the current tab only if certain conditions are met.
     * See the function comment for more details.
     */
    if (this.divertTargetedLink())
      return "15";

    var openNewTab = null;

    // when a tab is locked or preference is to open in new tab
    // we check that link is not a Javascript or have a onclick function
    if (this.currentTabLocked || this.targetPref == 1)
      openNewTab = this.openTabfromLink();
    // open links to other sites in a tab only if certain conditions are met. See the
    // function comment for more details.
    else if (this.openExSiteLink())
      openNewTab = true;

    if (openNewTab) {
      try {
        // for the moment just do it for Google and Yahoo....
        // and tvguide.com - added 2013-07-20
        var blocked = /tvguide.com|google|yahoo.com\/search|my.yahoo.com/.test(currentHref);
        // youtube.com - added 2013-11-15
        if (!blocked && /youtube.com/.test(currentHref) &&
           (!this.isGMEnabled() || decodeURI(href).indexOf("return false;") == -1))
          blocked = true;
        else if (!blocked) {
          // make sure external links in developer.mozilla.org open new tab
          let host = this._browser.currentURI.host;
          blocked = host == "developer.mozilla.org" && linkNode.host != host &&
                   linkNode.classList.contains("external");
        }
      } catch (ex) {blocked = false;}
      if (!blocked)
        return "16";

      let where = this._window.whereToOpenLink(aEvent);
      aEvent.__where = where == "tabshifted" ? "tabshifted" : "tab";
      // in Firefox 17.0-20.0 we can't pass aEvent.__where to handleLinkClick
      // add 4th argumens with where value
      this._window.handleLinkClick(aEvent, aEvent.__hrefFromOnClick || href, linkNode, {where: aEvent.__where});
      aEvent.stopPropagation();
      aEvent.preventDefault();
      return "17";
    }

    return "18";
  },

  /**
   * @brief hock the proper Greasemonkey function into Tabmix.isGMEnabled
   */
  isGreasemonkeyInstalled: function TMP_isGreasemonkeyInstalled(window) {
    var GM_function;
    try {
      // Greasemonkey >= 0.9.10
      Cu.import("resource://greasemonkey/util.js");
      if ('function' == typeof window.GM_util.getEnabled) {
        GM_function = window.GM_util.getEnabled;
      }
    } catch (e) {
      // Greasemonkey < 0.9.10
      if ('function' == typeof window.GM_getEnabled) {
        GM_function = window.GM_getEnabled;
      }
    }

    if (typeof GM_function !=  "function")
      return;

    this._GM_function.set(window, GM_function);
  },

  /**
   * @brief Suppress tabs that may be created by installing Greasemonkey script
   *
   * @returns             true if the link is a script.
   *
   */
  isGreasemonkeyScript: function TMP_isGreasemonkeyScript(href) {
    if (this.isGMEnabled()) {
      if (href && href.match(/\.user\.js(\?|$)/i))
        return true;
    }
    return false;
  },

  _GM_function: new WeakMap(),

  isGMEnabled: function() {
    if (this._GM_function.has(this._window))
      return this._GM_function.get(this._window)();
    return false;
  },

  /**
   * @brief Suppress tabs that may be created by downloading a file.
   *
   * This code borrows from Cusser's Disable Targets for Downloads extension.
   *
   * @returns             true if the link was handled by this function.
   *
   */
  suppressTabsOnFileDownload: function TMP_suppressTabsOnFileDownload() {
    // if we are in google search don't prevent new tab
    if (/\w+\.google\.\D+\/search?/.test(this._data.currentURL))
      return false;

    let {event, href, hrefFromOnClick} = this._data;
    href = hrefFromOnClick || href;

    // prevent link with "custombutton" protocol to open new tab when custombutton extension exist
    if (event.button != 2 && typeof(custombuttons) !='undefined'){
      if (this.checkAttr(href, "custombutton://"))
        return true;
    }

    if (!TabmixSvc.prefBranch.getBoolPref("enablefiletype"))
      return false;

    if (event.button != 0 || event.ctrlKey || event.metaKey)
      return false;

    // prevent links in tinderbox.mozilla.org with linkHref to *.gz from open in this function
    if (this.checkAttr(href, "http://tinderbox.mozilla.org/showlog") ||
        this.checkAttr(href, "http://tinderbox.mozilla.org/addnote"))
      return false;

    let onclick = this._data.onclick;
    if (onclick) {
      if (this.checkAttr(onclick, "return install") ||
          this.checkAttr(onclick, "return installTheme") ||
          this.checkAttr(onclick, "return note") || this.checkAttr(onclick, "return log")) // click on link in http://tinderbox.mozilla.org/showbuilds.cgi
        return true;
    }

    // lets try not to look into links that start with javascript (from 2006-09-02)
    if (this.checkAttr(href, "javascript:"))
      return false;

    return this.isUrlForDownload(href);
  },

  isUrlForDownload: function TMP_isUrlForDownload(linkHref) {
    //we need this check when calling from onDragOver and onDrop
    if (linkHref.indexOf("mailto:") == 0)
      return true;

    var filetype = TabmixSvc.prefBranch.getCharPref("filetype");
    filetype = filetype.toLowerCase();
    filetype = filetype.split(" ");
    var linkHrefExt = "";
    if (linkHref) {
      linkHref = linkHref.toLowerCase();
      linkHrefExt = linkHref.substring(linkHref.lastIndexOf("/"),linkHref.length);
      linkHrefExt = linkHrefExt.substring(linkHrefExt.indexOf("."),linkHrefExt.length);
    }

    var testString, hrefExt, testExt;
    for (var l = 0; l < filetype.length; l++) {
      if (filetype[l].indexOf("/") != -1){
      // add \ before first ?
        testString = filetype[l].substring(1,filetype[l].length-1).replace(/^\?/,"\\?");
        hrefExt = linkHref;
      }
      else {
        testString = "\\." + filetype[l];
        hrefExt = linkHrefExt;
        try {
          // prevent filetype catch if it is in the middle of a word
          testExt = new RegExp(testString + "[a-z0-9?\.]+", 'i');
          if (testExt.test(hrefExt))
            continue;
        } catch (ex) {}
      }
      try {
        testExt = new RegExp(testString, 'i');
        if (testExt.test(hrefExt))
          return true;
      } catch (ex) {}
    }
    return false;
  },

  /**
   * @brief Divert middle-clicked links into the current tab.
   *
   * This function forces a middle-clicked link to open in the current tab if
   * the following conditions are true:
   *
   * - links to other sites are not configured to open in new tabs AND the current
   *   page domain and the target page domain do not match OR the current
   *   tab is locked
   * - middle-clicks are configured to open in the current tab AND the middle
   *   mouse button was pressed OR the left mouse button and one of the Ctrl/Meta keys
   *   was pressed
   *
   * @returns              true if the function handled the click, false if it didn't.
   *
   */
  divertMiddleClick: function TMP_divertMiddleClick() {
    // middlecurrent - A Boolean value that controls how middle clicks are handled.
    if (!TabmixSvc.prefBranch.getBoolPref("middlecurrent"))
      return false;

    var isTabLocked = this.targetPref == 1 || this.currentTabLocked;
    var isDifDomain = this.targetPref == 2 && this._data.isLinkToExternalDomain;
    if (!isTabLocked && !isDifDomain)
      return false;

    let {event} = this._data;
    if (event.button == 1 || event.button == 0 && (event.ctrlKey || event.metaKey))
      return true;

    return false;
  },

 /**
  * @brief check if traget attribute exist and point to frame in the document
  *        frame pool
  */
  targetIsFrame: function() {
    let {targetAttr} = this._data;
    if (targetAttr) {
      let content = this._focusedWindow.top;
      if (this.existsFrameName(content, targetAttr))
        return true;
    }
    return false;
  },

  /**
   * @brief Divert links that contain targets to the current tab.
   *
   * This function forces a link with a target attribute to open in the
   * current tab if the following conditions are true:
   *
   * - extensions.tabmix.linkTarget is true
   * - neither of the Ctrl/Meta keys were used AND the linkNode has a target attribute
   *   AND the content of the target attribute is not one of the special frame targets
   * - all links are not forced to open in new tabs.
   * - links to other sites are not configured to open in new tabs OR the domain name
   *   of the current page and the domain name of the target page match
   * - the current tab is not locked
   * - the target of the event has an onclick attribute that does not contain the
   *   function call 'window.open' or the function call 'return top.js.OpenExtLink'
   *
   * @returns                true if the function handled the click, false if it didn't.
   *
   */
  divertTargetedLink: function TMP_divertTargetedLink() {
    let href = this._data.hrefFromOnClick || this._data.href;
    if (this.checkAttr(href, "javascript:") || // 2005-11-28 some link in Bloglines start with javascript
        this.checkAttr(href, "data:"))
      return false;

    let {event, targetAttr} = this._data;
    if (!targetAttr || event.ctrlKey || event.metaKey) return false;
    if (!TabmixSvc.prefBranch.getBoolPref("linkTarget")) return false;

    var targetString = /^(_self|_parent|_top|_content|_main)$/;
    if (targetString.test(targetAttr.toLowerCase())) return false;

    if (this.currentTabLocked) return false;
    if (this.targetPref == 1 ||
        this.targetPref == 2 && this._data.isLinkToExternalDomain)
      return false;

    if (this.checkOnClick())
      return false;

    return true;
  },

  /**
   * @brief Open links to other sites in tabs as directed.
   *
   * This function opens links to external sites in tabs as long as the following
   * conditions are met:
   *
   * - links protocol is http[s] or about
   * - links to other sites are configured to open in tabs
   * - the link node does not have an 'onclick' attribute that contains either the function call
   *   'window.open' or the function call 'return top.js.OpenExtLink'.
   * - the domain name of the current page and the domain name of the target page do not match
   *   OR the link node has an 'onmousedown' attribute that contains the text 'return rwt'
   *
   * @returns                true to load link in new tab
   *                         false to load link in current tab
   *
   */
  openExSiteLink: function TMP_openExSiteLink() {
    if (this.targetPref != 2 || this._window.Tabmix.isNewTabUrls(this._data.currentURL))
      return false;

    if (this.checkOnClick())
      return false;

    let {href, hrefFromOnClick, isLinkToExternalDomain, linkNode} = this._data;
    if (/^(http|about)/.test(hrefFromOnClick || href) &&
        (isLinkToExternalDomain || linkNode &&
        this.checkAttr(linkNode.getAttribute("onmousedown"), "return rwt")))
      return true;

    return false;
  },

  /**
   * @brief Open links in new tabs when tab is lock or preference is to always opne tab from links.
   *
   * @returns null if the caller need to handled the click,
              true to load link in new tab
              false to load link in current tab
   */
  openTabfromLink: function TMP_openTabfromLink() {
    if (this._window.Tabmix.isNewTabUrls(this._data.currentURL))
      return false;

    if (this.GoogleComLink())
      return null;

    let {href, hrefFromOnClick, linkNode} = this._data;
    if (!/^(http|about)/.test(hrefFromOnClick || href))
      return null;

    if (hrefFromOnClick)
      return this._data.currentURL.split("#")[0] != hrefFromOnClick.split("#")[0];

    if (href)
      href = href.toLowerCase();

    if (this.checkAttr(href, "javascript:") ||
        this.checkAttr(href, "data:") ||
        this.checkOnClick(true))
      // javascript links, do nothing!
      return null;
    else
      // when the links target is in the same page don't open new tab
      return this._data.currentURL.split("#")[0] != linkNode.toString().split("#")[0];

    return null;
  },

  /**
   * @brief Test if target link is special Google.com link preferences , advanced_search ...
   *
   * @returns true it is Google special link false for all other links
   */
  GoogleComLink: function TMP_GoogleComLink() {
    var location = this._data.currentURL;
    var currentIsnGoogle = /\/\w+\.google\.\D+\//.test(location);
    if (!currentIsnGoogle)
      return false;

    if (/calendar\/render/.test(location))
      return true;

    var node = this._data.linkNode || this._data.onClickNode;
    if (/\/intl\/\D{2,}\/options\/|search/.test(node.pathname))
      return true;

    let _list = ["/preferences", "/advanced_search", "/language_tools", "/profiles",
                 "/accounts/Logout", "/accounts/ServiceLogin"];

    let testPathname = _list.indexOf(node.pathname) > -1;
    if (testPathname)
      return true;

    let _host = ["profiles.google.com", "accounts.google.com", "groups.google.com"];
    let testHost = _host.indexOf(node.host) > -1;
    if (testHost)
      return true;

    return false;
  },

  /**
   * @brief Check a document's frame pool and determine if
   * |targetFrame| is located inside of it.
   *
   * @param content           is a frame reference
   * @param targetFrame       The name of the frame that we are seeking.
   * @returns                 true if the frame exists within the given frame pool,
   *                          false if it does not.
   */
  existsFrameName: function TMP_existsFrameName(content, targetFrame) {
    for (let i = 0; i < content.frames.length; i++) {
      let frame = content.frames[i];
      if (frame.name == targetFrame || this.existsFrameName(frame, targetFrame))
        return true;
    }
    return false;
  },

  /**
   * @brief Checks to see if handleLinkClick reload an existing tab without
   *        focusing it for link with target. Search in the browser content
   *        and its frames for content with matching name and href
   */
  selectExistingTab: function TMP_selectExistingTab(href, targetFrame) {
    if (TabmixSvc.prefBranch.getIntPref("opentabforLinks") != 0 ||
        Services.prefs.getBoolPref("browser.tabs.loadInBackground"))
      return;

    let isCurrent = function isCurrent(content) {
      if (content.location.href == href && content.name == targetFrame)
        return true;
      for (let i = 0; i < content.frames.length; i++) {
        let frame = content.frames[i];
        if (frame.location.href == href && frame.name == targetFrame)
          return true;
      }
      return false;
    }

    let window = this._window;
    let switchIfURIInWindow = function switchIfURIInWindow(aWindow) {
      // Only switch to the tab if both source and desination are
      // private or non-private.
      if (TabmixSvc.version(200) &&
          PrivateBrowsingUtils.isWindowPrivate(window) !=
          PrivateBrowsingUtils.isWindowPrivate(aWindow)) {
        return false;
      }
      if (!("gBrowser" in aWindow))
        return false;
      let browsers = aWindow.gBrowser.browsers;
      for (let i = 0; i < browsers.length; i++) {
        let browser = browsers[i];
        if (isCurrent(browser[TabmixSvc.contentWindowAsCPOW])) {
          gURLBar.handleRevert();
          // Focus the matching window & tab
          aWindow.focus();
          aWindow.gBrowser.tabContainer.selectedIndex = i;
          return true;
        }
      }
      return false;
    }

    if (switchIfURIInWindow(window))
      return;

    let winEnum = Services.wm.getEnumerator("navigator:browser");
    while (winEnum.hasMoreElements()) {
      let browserWin = winEnum.getNext();
      if (browserWin.closed || browserWin == window)
        continue;
      if (switchIfURIInWindow(browserWin))
        return;
    }
  },

 /**
  * @brief Check for certain JavaScript strings inside an attribute.
  *
  * @param attr     The attribute to check.
  * @param string   The string to check for.
  * @returns        true if the strings are present, false if they aren't.
  *
  */
  checkAttr: function TMP_checkAttr(attr, string) {
    if (typeof(attr) == "string")
      return attr.indexOf(string) == 0;
    return false;
  },

  get uriFixup() {
    delete this.uriFixup;
    return this.uriFixup = Cc["@mozilla.org/docshell/urifixup;1"].getService(Ci.nsIURIFixup);
  },

 /**
  * @brief Check if link refers to external domain.
  *
  * @param target    The target link.
  * @param curpage   The current page url
  * @returns         true when curpage and target are in diffrent domains
  *
  */
  isLinkToExternalDomain: function TMP_isLinkToExternalDomain(curpage, target) {
    var self = this;
    let getDomain = function getDomain(url) {
      if (typeof(url) != "string")
        url = url.toString();

      if (url.match(/auth\?/))
        return null;

      if (url.match(/^file:/))
        return "local_file";

      try {
        var fixedURI = self.uriFixup.createFixupURI(url, Ci.nsIURIFixup.FIXUP_FLAG_NONE);
        url = fixedURI.spec;
      } catch (ex) { }

      if (url.match(/^http/)) {
        url = fixedURI || makeURI(url);

        // catch redirect
        if (url.path.match(/^\/r\/\?http/))
          url = makeURI(url.path.substr("/r/?".length));
    /* DONT DELETE
      var host = url.hostPort.split(".");
      //XXX      while (host.length > 3) <---- this make problem to site like yahoo mail.yahoo.com ard.yahoo.com need
      while (host.length > 2)
        host.shift();
      return host.join(".");
    */
        try {
          var publicSuffix = Services.eTLD.getPublicSuffixFromHost(url.hostPort);
          var level = (publicSuffix.indexOf(".") == -1) ? 2 : 3;
        } catch(e) {
          level = 2;
        }
        var host = url.hostPort.split(".");
        while (host.length > level)
          host.shift();
        return host.join(".");
      }
      return null;
    }

    let targetDomain = getDomain(target);
    return targetDomain && targetDomain != getDomain(curpage);
  },

  /**
   * @brief check if the link contain special onclick function.
   */
  checkOnClick: function TMP_checkOnClick(more) {
    let {onclick} = this._data;
    if (onclick) {
      if (this.checkAttr(onclick, "window.open") ||
          this.checkAttr(onclick, "NewWindow") ||
          this.checkAttr(onclick, "PopUpWin") ||
          this.checkAttr(onclick, "return "))
        return true;

      if (more && (this.checkAttr(onclick, "openit") ||
          onclick.indexOf('this.target="_Blank"') != -1 ||
          onclick.indexOf("return false") != -1))
        return true;
    }
    return false;
  },

  getTargetAttr: function TMP_getTargetAttr(linkNode) {
    var targetAttr = linkNode && linkNode.target;
    // If link has no target attribute, check if there is a <base> with a target attribute
    if (!targetAttr) {
      let b = this._focusedWindow.document.getElementsByTagName("base");
      if (b.length > 0)
        targetAttr = b[0].getAttribute("target");
    }
    return targetAttr;
  },

  /**
   * @brief prevent onclick function with the form javascript:top.location.href = url
   *        or the form window.location = url when we force new tab from link
   */
  getHrefFromOnClick: function(event, href, linkNode, onclick) {
    if (typeof event.__hrefFromOnClick != "undefined")
      return event.__hrefFromOnClick;

    let result = {__hrefFromOnClick: null};
    if (onclick)
      this._hrefFromOnClick(href, linkNode, onclick, result);
    else {
      ///XXX [object CPOW [object HTMLTableCellElement]] linkNode.parentNode
      let parent = linkNode.parentNode;
      if (parent && parent.hasAttribute("onclick"))
        this._hrefFromOnClick(href, parent, parent.getAttribute("onclick"), result);
    }

    return event.__hrefFromOnClick = result.__hrefFromOnClick;
  },

  _hrefFromOnClick: function(href, node, onclick, result) {
    let re = /^(javascript:)?(window\.|top\.)?location(\.href)?=/;
    if (!re.test(onclick))
      return;

    let clickHref = onclick.replace(re, "").trim().replace(/;|'|"/g, "");
    // special case for forum/ucp.php
    if (clickHref == "this.firstChild.href")
      clickHref = href;
    let newHref;
    // get absolute href
    try {
      newHref = makeURI(clickHref, null, makeURI(node.baseURI)).spec;
    } catch (ex) {
      // unexpected error
      TabmixSvc.console.log(ex +
        "\nunexpected error from makeURLAbsolute\nurl " + clickHref);
      return;
    }

    // Don't open new tab when the link protocol is not http or https
    if (!/^(http|about)/.test(newHref))
      return;

    // don't change the onclick if the href point to a different address
    // from the href we extract from the onclick
    if (href && href.indexOf(clickHref) == -1 &&
        !this.checkAttr(href, "javascript"))
      return;

    result.__hrefFromOnClick = newHref;
  },

  _getNodeWithOnClick: function(event) {
    // for safety reason look only 3 level up
    let i = 0, node = event.target;
    while (i < 3 && node && node.hasAttribute && !node.hasAttribute("onclick")) {
      node = node.parentNode;
      i++;
    }

    if (node && node.hasAttribute && node.hasAttribute("onclick"))
      return node;

    return null;
  }
}

function makeURI(aURL, aOriginCharset, aBaseURI) {
  return Services.io.newURI(aURL, aOriginCharset, aBaseURI);
}

TabmixContentClick.init();