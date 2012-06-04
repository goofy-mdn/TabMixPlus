/***** Preference Dialog Functions *****/
const Cc = Components.classes;
const Ci = Components.interfaces;
const pBranch = Ci.nsIPrefBranch;
var gPrefs, newTabURLpref, replaceLastTabWithNewTabURLpref;
var instantApply;

function $(id) document.getElementById(id);

function before_Init() {
  if (Tabmix.isPlatform("Mac")) {
    var label = $("tabId").getAttribute("label2");
    $("tabId").setAttribute("label", label);

    $("tabpanId").setAttribute("Mac", true);
  }

  var topWindow = Tabmix.getTopWin();
  var ctrlTab = topWindow.document.getElementById("ctrlTab-panel") && "ctrlTab" in topWindow;
  if (!ctrlTab) {
     var tabPreviews = $("ctrltab.tabPreviews");
     tabPreviews.parentNode.removeChild(tabPreviews);
  }

  /* Chromifox theme force button height to 25px */
  var skin = Services.prefs.getCharPref("general.skins.selectedSkin");
  if (skin == "cfxec")
    $("pref-tabmix").setAttribute("chromifox", true);

  /* we don't need to fix tabpanels border in ubuntu */
  if (navigator.userAgent.toLowerCase().indexOf("ubuntu") > -1) {
     let panels = document.documentElement.getElementsByAttribute("class" , "groupbox-panels");
     for (let i = 0, num = panels.length; i < num; i++) {
        panels[0].removeAttribute("class");
     }
  }

  gIncompatiblePane.checkForIncompatible(false);

  instantApply = document.documentElement.instantApply ||
     Services.prefs.getBoolPref("browser.preferences.instantApply");
  TMP_setButtons(true, true, true);

  // Bug 455553 - New Tab Page feature - landed on 2012-01-26 (Firefox 12)
  newTabURLpref = topWindow.Tabmix.newTabURLpref;
  replaceLastTabWithNewTabURLpref = "extensions.tabmix.replaceLastTabWith.newTabUrl";
  if (newTabURLpref == "browser.newtab.url") {
    TM_Options.setItem("newTabUrl", "prefstring", newTabURLpref);
    replaceLastTabWithNewTabURLpref = "extensions.tabmix.replaceLastTabWith.newtab.url";
    TM_Options.setItem("newTabUrl_1", "prefstring", replaceLastTabWithNewTabURLpref);
  }

  // there are heights diffrenet in our dialog window when Firefox starts with
  // gfx.direct2d.disabled true or false
  if (TabmixSvc.direct2dDisabled) {
    document.documentElement.setAttribute("minheight", 483);
    $("sessionManager-panels").setAttribute("style", "padding-bottom: 4px;");
    $("sessionManager-separator").setAttribute("style", "height: 11px;");
  }
  if (Tabmix.isPlatform("Linux"))
    $("sessionManager-panels").setAttribute("linux", "true");
}

// load all preferences into the dialog
function TM_EMinit() {
  var browserWindow = Tabmix.getTopWin();

  getTab();

  // add EventListener when we start
  window.addEventListener("unload", setLastTab, false);
  window.addEventListener("command", userChangedValue, false);
  window.addEventListener("input", userChangedValue, false);
  window.addEventListener("change", userChangedValue, false);

  if (!Tabmix.isVersion(90))
    TM_Options.setItem("unloadedTab", "style", "visibility: hidden;");

  if (Tabmix.isVersion(130)) {
    let cmSearch = $("contextMenuSearch");
    cmSearch.hidden = false;
    cmSearch.setAttribute("prefstring", "browser.search.context.loadInBackground");
  }
  gPrefs =  document.getElementsByAttribute("prefstring", "*");

  // disable TMP session manager setting if session manager extension is install
  if (browserWindow.Tabmix.extensions.sessionManager) {
    $("sessionmanager_button").setAttribute("image", "chrome://sessionmanager/skin/icon.png");
    $("sessionmanager_ext_tab").hidden = false;
    $("sessionStore_tab").hidden = true;
    $("tabmix_tab").hidden = true;
    $("paneSession-tabbox").selectedIndex = 0;
    $("chooseFile").selectedIndex = 1;
  }
  else {
    // create saved Session popup menu
    var popup = $("onStart.popup");
    TabmixSessionManager.createMenuForDialog(popup);
  }

  // disable options for position the tabbar and scroll mode if TreeStyleTab extension
  // or other vertical tabs extensions installed
  if (browserWindow.Tabmix.extensions.verticalTabBar) {
    TM_Options.setItem("treeStyleTab.msg", "hidden", null);
    TM_Options.setItem("tabBarDisplay", "TSTinstalled", true);
    TM_Options.setItem("tabBarPosition", "disabled", true);
    TM_Options.setItem("tabScroll", "disabled", true);
    TM_Options.setItem("scrollDelay", "disabled", true);
    TM_Options.setItem("smoothScroll", "disabled", true);
  }

  // Init tabclicking options
  var menuPopup = $("ClickTab").firstChild;
  // block item in tabclicking options that are not in use
  var blocked = browserWindow.gTMPprefObserver.blockedValues;
  for (let i = 0; i < blocked.length; i++) {
    let item = menuPopup.getElementsByAttribute("value", blocked[i])[0];
    item.hidden = true;
  }
  $("ClickTabbar").appendChild(menuPopup.cloneNode(true));

  // verify that all the prefs exist .....
  browserWindow.gTMPprefObserver.addMissingPrefs();

  TM_setElements(false, true);
  toolbarButtons(browserWindow);
  // check if apply is on
  // apply changes if we set single window mode status
  TM_EMsave();

  var tabclicking = $("tabclicking_tabs");
  // change tab label on Mac. trigger onselect before broadcaster is set
  // so we add the onselect here
  tabclicking.addEventListener("select", tabSelectionChanged, false);

  // for locals with long labels
  var hbox = $("focusTab-box");
  var label = $("focusTab-label").boxObject.width;
  var menulist = $("focusTab");
  if (hbox.boxObject.width > label + menulist.boxObject.width) {
    menulist.parentNode.removeAttribute("pack");
    hbox.setAttribute("orient", "horizontal");
    hbox.setAttribute("align","center");
  }

  hbox = $("tabScroll-box");
  label = $("tabScroll.label").boxObject.width;
  var menulist = $("tabScroll");
  var ident = 23; // we have class="ident"
  if (hbox.boxObject.width > label + menulist.boxObject.width - ident) {
    menulist.parentNode.removeAttribute("pack");
    menulist.parentNode.removeAttribute("class");
    hbox.setAttribute("orient", "horizontal");
    hbox.setAttribute("align","center");
  }

  // rtl update
  var direction = window.getComputedStyle($("pref-tabmix"), null).direction;
  if (direction == "rtl") {
    let right = $("newTabButton.posiotion.right");
    let left = $("newTabButton.posiotion.left");
    let [rightLabel, leftLabel] = [right.label, left.label];
    [right.label, left.label] = [leftLabel, rightLabel];

    let focusTab = $("focusTab").firstChild.childNodes;
    [rightLabel, leftLabel] = [focusTab[2].label, focusTab[1].label];
    [focusTab[2].label, focusTab[1].label] = [leftLabel, rightLabel];
    // "opener/left"
    focusTab[5].label = focusTab[5].getAttribute("rtlLabel");

    let tabScroll = $("tabScroll").firstChild.childNodes;
    tabScroll[2].label = tabScroll[2].getAttribute("rtlLabel");

    let tabXLeft = $("tabXLeft");
    tabXLeft.label = tabXLeft.getAttribute("rtlLabel");
  }

  // align Tab opening group boxes
  var vbox1 = $("tabopening1");
  var vbox2 = $("tabopening2");
  var vbox3 = $("tabopening3");
  var max = Math.max(vbox1.boxObject.width, vbox2.boxObject.width, vbox3.boxObject.width);
  vbox1.style.setProperty("width",max + "px", "important");
  vbox2.style.setProperty("width",max + "px", "important");
  vbox3.style.setProperty("width",max + "px", "important");

  if (Tabmix.isPlatform("Linux"))
     sizeToContent();

  window.setTimeout( function () { window.focus();}, 0 );
}

// save all preferences entered into the dialog
function TM_EMsave(onApply) {
  // we only need to save if apply is enabled
  if (!onApply && document.documentElement.getButton("extra1").disabled)
    return true;

  // set flag to prevent TabmixTabbar.updateSettings from run for each change
  Tabmix.prefs.setBoolPref("setDefault", true);

  TM_Options.singleWindow( $("singleWindow").checked );
  TM_Options.setTabXUI();
  TM_verifyWidth();
  TM_Options.verify_PostDataBytes();

  document.documentElement.getButton("accept").focus();
  TMP_setButtons(true, false);

  if (!("undefined" in applyData)) {
    for (var _pref in applyData)
      setPrefByType(_pref, applyData[_pref]);
  }
  else {
    // this part is only if the applayData fail for some unknown reason
    // we don't supposed to get here
    for (var i = 0; i < gPrefs.length; ++i )
      setPrefByType(gPrefs[i].getAttribute("prefstring"), getValue(gPrefs[i]));
  }

  applyData = [];
  Tabmix.prefs.clearUserPref("setDefault"); // this trigger TabmixTabbar.updateSettings
  TM_Options.isSessionStoreEnabled(true);

  callUpdateSettings();

  Services.prefs.savePrefFile(null); // store the pref immediately
  return true;
}

function callUpdateSettings() {
  var pref = "PrefObserver.error";
  if (Tabmix.prefs.prefHasUserValue(pref) && Tabmix.prefs.getBoolPref(pref)) {
    var wnd, enumerator = Tabmix.windowEnumerator();
    while (enumerator.hasMoreElements()) {
      wnd = enumerator.getNext();
      wnd.TabmixTabbar.updateSettings();
    }
  }
}

function TM_verifyWidth() {
   var minWidth = $("minWidth");
   var maxWidth = $("maxWidth");

   var minValue = minWidth.value;
   var maxValue = maxWidth.value;

   if (maxValue - minValue < 0) {
      minWidth.value = maxValue;
      maxWidth.value = minValue;
   }

   if (minWidth.value < 16)
     minWidth.value = 16;

   if (minValue != minWidth.value)
      updateApplyData(minWidth);

   if (maxValue != maxWidth.value)
      updateApplyData(maxWidth);

}

var TM_Options = {
   checkDependant: function(start) {

      this.singleWindow( $("singleWindow").checked );

      let external = $("externalLinkTarget");
      let checked = external.value != -1;
      external.firstChild.firstChild.hidden = checked;
      $("externalLink").checked = checked;

      var broadcasters = $("disabled:Broadcaster");
      for (var i = 0; i < broadcasters.childNodes.length; ++i ) {
         var _id = broadcasters.childNodes[i].id.replace("obs_", "");
         this.disabled(_id, start);
      }

      this.setTabXUI();
      this.addTabXUI();
      this.selectTab();
      this.tabScroll();
      this.speLink();
      this.newTabUrl($("loadOnNewTab"), false, false);
      this.setShowTabList();
      this.setDisabeled_replaceLastTabWith();
      this.isSessionStoreEnabled(false);

      this.setDisabled("obs_ss_postdata", $("ss_postdata").value == 2);
   },

   disabled: function(itemOrId, start) {
      var item = typeof(itemOrId) == "string" ? $(itemOrId) : itemOrId;
      var val;
      if (item.hasAttribute("disableObserver"))
        val = true;
      else
        val = item.getAttribute("inverseDependency") ? item.checked : !item.checked;
      if (start && !val)
         return;
      this.setDisabled("obs_" + item.id, val);
   },

   setDisabled: function(id, val) {
      if (val == true)
         this.setItem(id, "disabled" , val);
      else {
         // remove disabled from all observers,
         // we can't edit textbox-input with disabled=null or disabled=false
         // textbox-input inherits the dislabled attribute from the textbox

         // all broadcaster has no disabled attribute at startup
         var aBroadcaster = $(id);
         if (aBroadcaster.hasAttribute("disabled")) {
            aBroadcaster.removeAttribute("disabled");
         }
      }
   },

   externalLinkValue: function(checked) {
     let external = $("externalLinkTarget");
     let node = $("generalWindowOpen");
     if (checked) {
       let prefValue = Services.prefs.getIntPref("browser.link.open_newwindow.override.external");
       external.value = prefValue > -1 ? prefValue : node.value;
     }
     else
       external.value = -1;
     external.firstChild.firstChild.hidden = checked;
     updateApplyData(external, external.value);
   },

   newTabUrl: function(item, disable, setFocus) {
      var showTabUrlBox = item.selectedItem.value == 4;
      var idnum = item.getAttribute("idnum") || "" ;
      this.setDisabled("newTabUrlLabel" + idnum, !showTabUrlBox || disable);
      this.setDisabled("newTabUrl" + idnum, !showTabUrlBox || disable);
      if (setFocus && showTabUrlBox)
         $("newTabUrl" + idnum).focus();
   },

   setDisabeled_replaceLastTabWith: function() {
      // we disable replaceLastTabWith if one of this test is true
      // browser.tabs.closeWindowWithLastTab == true OR
      // extensions.tabmix.keepLastTab = true
      var closeWindow = !$("keepWindow").checked // inverted pref;
      var keepLastTab = $("keepLastTab");
      var disable = closeWindow || keepLastTab.checked;
      this.setDisabled("obs_replaceLastTabWith", disable);
      this.newTabUrl($("replaceLastTabWith"), disable, !disable);
   },

   addTabXUI: function() {
      var tabXValue = $("addTabXUI").selectedItem.value;
      this.setItem("tabXdelaycheck", "hidden", tabXValue != 2 && tabXValue != 4);
      this.setItem("tabXwidthBox", "hidden", tabXValue != 5);
   },

   setTabXUI: function() {
      if ($("flexTabs").checked) {
         $("alltabsItem").hidden = true;
         var tabXUI = $("addTabXUI");
         if ( tabXUI.selectedItem.value == 5) {
            updateApplyData(tabXUI, 1);
            this.setItem("tabXwidthBox", "hidden", true);
         }
      }
      else
        $("alltabsItem").hidden = false;
   },

   setAllTabsItemVisibility: function(aShow) {
      if ($("flexTabs").checked)
         $("alltabsItem").hidden = !aShow;
      else
        $("alltabsItem").hidden = false;
   },

   selectTab: function() {
      var focusType = $("selectTab").checked ? "bg":"fg";
      var val = $("showInverseLink").getAttribute(focusType+"label");
      this.setItem("showInverseLink", "label", val);
   },

   tabScroll: function() {
      var multiRow = $("tabScroll").value == 2;
      $("maxbar").hidden = !multiRow;
      $("offsetAmountToScroll").hidden = multiRow;
   },

   speLink: function() {
      var spelink = $("speLink").selectedItem.value;
      $("inverselinks").disabled =  spelink != 2 && $("midcurrent").checked;
   },

   singleWindow: function(enableSingleWindow) {
      function updateStatus(itemId, testVal, test, newVal) {
         var item = $(itemId);
         test = test ? item.value == testVal : item.value != testVal
         if ( test ) {
            updateApplyData(item, newVal);
         }
      }
      if ( enableSingleWindow ) {
         updateStatus("generalWindowOpen", 2, true, 3);
         updateStatus("externalLinkTarget", 2, true, 3);
         updateStatus("divertedWindowOpen", 0, false, 0);
      }
   },

   verify_PostDataBytes: function() {
      var ss_postdatabytes = $("ss_postdatabytes");
      var val = ss_postdatabytes.value;
      if (val == "-" || val == "") {
         updateApplyData(ss_postdatabytes, val == "" ? "0" : "-1");
      }
   },

   isSessionStoreEnabled: function (checkService) {
      var browserWindow = Tabmix.getTopWin();
      if (checkService)
        browserWindow.TMP_SessionStore.setService(2, false, window);

      if (browserWindow.Tabmix.extensions.sessionManager)
        return;

      var sessionStoreEnabled = browserWindow.TMP_SessionStore.isSessionStoreEnabled();
      var currentState = $("sessionstore_0").checked;
      if (currentState != sessionStoreEnabled || (!checkService && !sessionStoreEnabled)) {
        $("sessionstore_0").checked = sessionStoreEnabled;
        $("sessionstore_1").checked = sessionStoreEnabled;
        $("paneSession-tabbox").selectedIndex = sessionStoreEnabled ? 1 : 2;
      }
   },

   setSessionsOptions: function (item, id) {
      var useSessionManager = !item.checked;
      $("paneSession-tabbox").selectedIndex = item.checked ? 1 : 2;
      $(id).checked = item.checked;
      $(id).focus();

      function updatePrefs(aItemId, aValue) {
         var item = $(aItemId);
         updateApplyData(item, aValue);
      }

      // TMP session pref
      function sessionPrefs() {
         updatePrefs("sessionManager", useSessionManager);
         updatePrefs("sessionCrashRecovery", useSessionManager);
      }

      // sessionstore pref
      function sessionstorePrefs() {
         updatePrefs("browser.warnOnRestart", !useSessionManager);
         updatePrefs("browser.warnOnQuit", !useSessionManager);
         updatePrefs("resume_from_crash", !useSessionManager);
         // "browser.startup.page"
         updatePrefs("browserStartupPage", useSessionManager ? 1 : 3);
         updatePrefs("browserStartupPage1", useSessionManager ? 1 : 3);
      }

      if (useSessionManager) {
        sessionstorePrefs();
        sessionPrefs();
      }
      else {
        sessionPrefs();
        sessionstorePrefs()
      }
   },

   setSessionpath: function (popup) {
      var val = popup.parentNode.selectedItem.value;
      var sessionpath = $("sessionpath");
      sessionpath.value = popup.getElementsByAttribute("value", val)[0].getAttribute("session");
      updateApplyData(sessionpath);
   },

   setUndoCloseCache: function (item) {
      var undoCloseCache = $("undoCloseCache");
      var currentValue = undoCloseCache.value;
      var newValue = item.checked ? 10 : 0;
      if (newValue != currentValue) {
        updateApplyData(undoCloseCache, newValue);
      }
   },

   setUndoClose: function (item) {
      if (item.value == "")
        item.value = 0;

      if (item.value == 0) {
        var undoClose = $("undoClose");
        undoClose.checked = false;
        this.disabled(undoClose);
        this.setUndoCloseCache(undoClose);
      }
   },

   setShowTabList: function () {
      var disableShowTabList = $("ctrltab").checked &&
                                $("ctrltab.tabPreviews").checked;
      this.setDisabled("showTabList", disableShowTabList);
      if (!$("obs_showTabList").hasAttribute("disabled"))
        this.setDisabled("respondToMouse", disableShowTabList);
   },

   // Set given attribute of specified item.
   // If the value is null, then it removes the attribute
   // (which works nicely for the disabled attribute).
   setItem: function (id, attrib, val) {
      var item = $(id);
      if (val == null) {
        item.removeAttribute(attrib);
        return;
      }

      if (typeof(val) == "boolean")
        val = val ? "true" : "false";

      if (item.getAttribute(attrib) != val)
        item.setAttribute(attrib, val);
   }

}

// other settings not in the main option dialog
var otherPref = ["unreadTabreload","reload_time","custom_reload_time",
                  "filetype","sessions.menu.showext","disableIncompatible","hideIcons","disableF9Key",
                  "styles.currentTab","styles.unreadTab","styles.otherTab","styles.progressMeter"];

function TM_defaultSetting () {
  // set flag to prevent TabmixTabbar.updateSettings from run for each change
  Tabmix.prefs.setBoolPref("setDefault", true);

  TM_setElements(true);
  TMP_setButtons(true, true);

  // reset other settings to default
  for (var i = 0; i < otherPref.length; ++i )
    if (Tabmix.prefs.prefHasUserValue(otherPref[i])) Tabmix.prefs.clearUserPref(otherPref[i]);

  Tabmix.prefs.clearUserPref("setDefault");
  TM_Options.isSessionStoreEnabled(true);
  callUpdateSettings();

  Services.prefs.savePrefFile(null); // store the pref immediately
}

function getPrefByType(prefName) {
   try {
      switch (Services.prefs.getPrefType(prefName)) {
         case pBranch.PREF_BOOL:
            return Services.prefs.getBoolPref(prefName);
         case pBranch.PREF_INT:
            return Services.prefs.getIntPref(prefName);
         case pBranch.PREF_STRING:
            return Services.prefs.getCharPref(prefName);
      }
   } catch (ex) {Tabmix.assert(ex, "error in getPrefByType " + "\n" + "caller " + Tabmix.callerName() + "\n"+ prefName);}
   return null;
}

function setPrefByType(prefName, newValue, atImport) {
   try {
      let prefType = Services.prefs.getPrefType(prefName);
      // when we import from old saved file, we need to replace old pref that are not in use.
      // we also check for locked pref for the case user locked pref that we replaced
      if (atImport && (prefType == Services.prefs.PREF_INVALID || Services.prefs.prefIsLocked(prefName))) {
         switch (prefName) {
            // in 0.3.0.605 we changed tab color from old pref to new pref
            // old pref "extensions.tabmix.currentColor" type integer
            // new pref "extensions.tabmix.currentColorCode" type string
            case "extensions.tabmix.currentColor":
            case "extensions.tabmix.unreadColor":
            case "extensions.tabmix.progressColor":
               var colorCodes = ["#CF1919", "#0E36EF", "#DDDF0D", "#3F8F3E", "#E066FF", "#86E7EF",
                                "#FFFFFF", "#7F7F7F", "#000000", "#EF952C", "#FF82AB", "#7F4C0F", "#AAAAFF"]
               newValue = colorCodes[newValue];
               prefName = prefName + "Code";
            // in 0.3.7.4 2008-12-24 we combined all style pref into one per type
            // extensions.tabmix.styles.[TYPE NAME]
            case "extensions.tabmix.boldUnread":
            case "extensions.tabmix.italicUnread":
            case "extensions.tabmix.underlineUnread":
            case "extensions.tabmix.boldCurrent":
            case "extensions.tabmix.italicCurrent":
            case "extensions.tabmix.underlineCurrent":
            case "extensions.tabmix.unreadColorCode":
            case "extensions.tabmix.currentColorCode":
            case "extensions.tabmix.progressColorCode":
            case "extensions.tabmix.useCurrentColor":
            case "extensions.tabmix.useUnreadColor":
            case "extensions.tabmix.useProgressColor":
               var pref = prefName.toLowerCase().replace(/extensions.tabmix.|color/g,"")
                                       .replace(/italic|bold|underline/g, ",$&,")
                                       .replace("use", ",text,")
                                       .replace("code", ",textColor,")
                                       .split(",");
               var styleName, attrib;
               [styleName, attrib] = prefName.indexOf("Code") > -1 ? [pref[0], pref[1]] : [pref[2], pref[1]];
               if (styleName == "progress") {
                 attrib = attrib.replace("text", "bg");
                 styleName += "Meter"
               }
               else
                 styleName += "Tab";
               oldStylePrefs[styleName][attrib] = newValue;
               oldStylePrefs.found = true;
               return;
            // changed at 2008-02-26
            case "extensions.tabmix.undoCloseCache":
               Services.prefs.setIntPref("browser.sessionstore.max_tabs_undo", newValue);
               return;
            // changed at 2008-08-17
            case "extensions.tabmix.opentabfor.search":
               Services.prefs.setBoolPref("browser.search.openintab", /true/i.test(newValue));
               return;
            // changed at 2008-09-23
            case "extensions.tabmix.keepWindow":
               Services.prefs.setBoolPref("browser.tabs.closeWindowWithLastTab", !(/true/i.test(newValue)));
               return;
            // changed at 2008-09-28
            case "browser.ctrlTab.mostRecentlyUsed":
            case "extensions.tabmix.lasttab.handleCtrlTab":
               Services.prefs.setBoolPref("browser.ctrlTab.previews", /true/i.test(newValue));
               return;
            // 2008-11-29
            case "extensions.tabmix.maxWidth":
            case "browser.tabs.tabMaxWidth":
               Tabmix.prefs.setIntPref("tabMaxWidth", newValue);
               return;
            // 2008-11-29
            case "extensions.tabmix.minWidth":
            case "browser.tabs.tabMinWidth":
               Tabmix.prefs.setIntPref("tabMinWidth", newValue);
               return;
            // 2009-01-31
            case "extensions.tabmix.newTabButton.leftside":
               Tabmix.prefs.setIntPref("newTabButton.position", /true/i.test(newValue) ? 0 : 2);
               return;
            // 2009-10-10
            case "extensions.tabmix.windows.warnOnClose":
               Tabmix.prefs.setBoolPref("tabs.warnOnClose", Services.prefs.getBoolPref("browser.tabs.warnOnClose"));
               Services.prefs.setBoolPref("browser.tabs.warnOnClose", /true/i.test(newValue));
               return;
            // 2010-03-07
            case "extensions.tabmix.extraIcons":
               Services.prefs.setBoolPref(prefName + ".locked", /true/i.test(newValue));
               Services.prefs.setBoolPref(prefName + ".protected", /true/i.test(newValue));
               return;
            // 2010-06-05
            case "extensions.tabmix.tabXMode":
               // in old version we use tabXMode = 0 to disable the button
               if (newValue < 1 || newValue > 5)
                  newValue = 1;
               Tabmix.prefs.setIntPref("tabs.closeButtons", newValue);
               return;
            case "extensions.tabmix.tabXMode.enable":
               Tabmix.prefs.setBoolPref("tabs.closeButtons.enable", /true/i.test(newValue));
               return;
            case "extensions.tabmix.tabXLeft":
               Tabmix.prefs.setBoolPref("tabs.closeButtons.onLeft", /true/i.test(newValue));
               return;
            case "extensions.tabmix.tabXDelay":
               Tabmix.prefs.setIntPref("tabs.closeButtons.delay", newValue);
               return;
            // 2010-09-16
            case "extensions.tabmix.speLink":
               Tabmix.prefs.setIntPref("opentabforLinks", newValue);
               return;
            // 2011-01-26
            case "extensions.tabmix.mouseDownSelect":
               Tabmix.prefs.setBoolPref("selectTabOnMouseDown", /true/i.test(newValue));
               return;
            // 2011-10-11
            case "browser.link.open_external":
               if (newValue == $("generalWindowOpen").value)
                 newValue = -1;
               Services.prefs.setIntPref("browser.link.open_newwindow.override.external", newValue);
               return;
            // 2011-11-26
            case "extensions.tabmix.clickToScroll.scrollDelay":
               Services.prefs.setIntPref("toolkit.scrollbox.clickToScroll.scrollDelay", newValue);
               return;
            // 2012-01-26
            case "extensions.tabmix.newTabUrl":
               setNewTabUrl(newTabURLpref, newValue);
               return;
            case "extensions.tabmix.newTabUrl_afterLastTab":
               setNewTabUrl(replaceLastTabWithNewTabURLpref, newValue);
               return;
            // 2012-03-21
            case "extensions.tabmix.loadOnNewTab":
               Tabmix.prefs.setIntPref("loadOnNewTab.type", newValue);
               return;
            case "extensions.tabmix.replaceLastTabWith":
               Tabmix.prefs.setIntPref("replaceLastTabWith.type", newValue);
               return;
            // 2012-04-12
            case "browser.tabs.loadFolderAndReplace":
               Tabmix.prefs.setBoolPref("loadFolderAndReplace", /true/i.test(newValue));
               return;
         }
      }
      switch (prefType) {
         case pBranch.PREF_BOOL:
            if (atImport) {
               newValue = /true/i.test(newValue);
               // from tabmix 0.3.6.0.080223 we use extensions.tabmix.hideTabbar
               if (prefName == "browser.tabs.autoHide") {
                  newValue = newValue ? 1 : 0;
                  Tabmix.prefs.setIntPref("hideTabbar", newValue);
                  return;
               }
            }
            Services.prefs.setBoolPref(prefName, newValue);
            break;
         case pBranch.PREF_INT:
            if (prefName == "browser.tabs.closeButtons") {
               // we use browser.tabs.closeButtons only in 0.3.8.3
               if (newValue < 0 || newValue > 6)
                  newValue = 6;
               newValue = [3,5,1,1,2,4,1][newValue];
               Tabmix.prefs.setIntPref("tabs.closeButtons", newValue);
               return;
            }
            Services.prefs.setIntPref(prefName, newValue);
            break;
         case pBranch.PREF_STRING:
            // in prev version we use " " for to export string to file
            if (atImport && newValue.indexOf('"') == 0)
               newValue = newValue.substring(1,newValue.length-1);

            if (newTabURLpref == "browser.newtab.url") {
              if (prefName == "extensions.tabmix.newtab.url") {
                setNewTabUrl("browser.newtab.url", newValue);
                break;
              }
              if (prefName == "extensions.tabmix.replaceLastTabWith.newTabUrl") {
                setNewTabUrl("extensions.tabmix.replaceLastTabWith.newtab.url", newValue);
                break;
              }
            }

            Services.prefs.setCharPref(prefName, newValue);
            break;
      }
   } catch (ex) {Tabmix.assert(ex, "error in setPrefByType " + "\n" + "caller " + Tabmix.callerName() + "\n"+ prefName + "\n" + newValue);}
}

function setNewTabUrl(newPref, newValue) {
  if (newValue != "") {
    let nsISupportsString = Ci.nsISupportsString;
    let str = Cc["@mozilla.org/supports-string;1"].createInstance(nsISupportsString);
    str.data = newValue;
    Services.prefs.setComplexValue(newPref, nsISupportsString, str);
  }
}

function TM_setElements (restore, start) {
   for (var i = 0; i < gPrefs.length; ++i ) {
      var item = gPrefs[i];
      var pref = item.getAttribute("prefstring");

      if (restore) {
        switch (pref) {
           case "browser.link.open_newwindow.override.external": // exist from firefox 10.0
             Services.prefs.setIntPref(pref, -1);
              break;
           default:
             if (Services.prefs.prefHasUserValue(pref))
               Services.prefs.clearUserPref(pref);
        }
      }

      var prefValue = getPrefByType(pref);
      switch (item.localName) {
         case "checkbox":
            if (item.hasAttribute("inverted"))
               prefValue = !prefValue;
            item.checked = prefValue;
            break;
         case "radiogroup":
            if (item.hasAttribute("boolean"))
               prefValue = prefValue ? 0 : 1;
            item.selectedIndex = prefValue;
            break;
         default:
            item.value = prefValue;
      }
   }

   setSelectedIndex($("tabclicking_tabs").selectedIndex);
   TM_Options.checkDependant(start);
}

function exportData() {

  TM_EMsave();

  var patterns = new Array;
  patterns[0] = "tabmixplus";
  var z = 1, pref;

  for (var i = 0; i < gPrefs.length; ++i ) {
     pref = gPrefs[i].getAttribute("prefstring");
     patterns[z++] = pref + "=" + getPrefByType(pref);
  }

  // more pref to save
  for (i = 0; i < otherPref.length; ++i ){
    pref = "extensions.tabmix." + otherPref[i];
    patterns[z++] = pref + "=" + getPrefByType(pref);
  }

  saveToFile(patterns);
  return true;
}

function saveToFile (patterns) {
  // thanks to adblock
  const nsIFilePicker = Ci.nsIFilePicker;
  var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  var stream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);

  fp.init(window, null, nsIFilePicker.modeSave);
  fp.defaultExtension = "txt";
  fp.defaultString = "TMPpref";
  fp.appendFilters(nsIFilePicker.filterText);

  if (fp.show() != nsIFilePicker.returnCancel) {
    let file = fp.file;
    if (!/\.txt$/.test(file.leafName.toLowerCase()))
      file.leafName += ".txt";
    if (file.exists())
      file.remove(true);
    file.create(file.NORMAL_FILE_TYPE, parseInt("0666", 8));
    stream.init(file, 0x02, 0x200, null);

    for (var i = 0; i < patterns.length ; i++) {
      patterns[i]=patterns[i]+"\n";
      stream.write(patterns[i], patterns[i].length);
    }

    stream.close();
  }
}

var oldStylePrefs = {currentTab: {}, unreadTab: {}, progressMeter: {}, found: false};
function importData () {
   var pattern = loadFromFile();

   if (!pattern) return false;
   var i;
   if(pattern[0]!="tabmixplus") {
      //  Can not import because it is not a valid file.
      alert(TabmixSvc.getString("tmp.importPref.error1"));
      return false;
   }

   // set flag to prevent TabmixTabbar.updateSettings from run for each change
   Tabmix.prefs.setBoolPref("setDefault", true);

   // disable both Firefox & Tabmix session manager to prevent our prefs observer to block the change
   Tabmix.prefs.setBoolPref("sessions.manager", false);
   Tabmix.prefs.setBoolPref("sessions.crashRecovery", false);
   Services.prefs.setBoolPref("browser.sessionstore.resume_from_crash", false);
   Services.prefs.setIntPref("browser.startup.page", false);
   Services.prefs.savePrefFile(null);

   var prefName, prefValue;
   for (i=1; i<pattern.length; i++){
      var index = pattern[i].indexOf("=");
      if (index > 0){
         prefName  = pattern[i].substring(0,index);
         prefValue = pattern[i].substring(index+1,pattern[i].length);
         setPrefByType(prefName, prefValue, true);
      }
   }
   var browserWindow = Tabmix.getTopWin();
   browserWindow.gTMPprefObserver.updateTabClickingOptions();
   if (oldStylePrefs.found) {
      browserWindow.gTMPprefObserver.converOldStylePrefs("currentTab", oldStylePrefs.currentTab);
      browserWindow.gTMPprefObserver.converOldStylePrefs("unreadTab", oldStylePrefs.unreadTab);
      browserWindow.gTMPprefObserver.converOldStylePrefs("progressMeter", oldStylePrefs.progressMeter);
      oldStylePrefs = {currentTab: {}, unreadTab: {}, progressMeter: {}, found: false};
   }
   Tabmix.prefs.clearUserPref("setDefault");

   TM_setElements(false);
   TMP_setButtons(true, true);

   TM_Options.isSessionStoreEnabled(true);
   callUpdateSettings();

   Services.prefs.savePrefFile(null); // store the pref immediately

   return true;
}

function loadFromFile() {
   // thanks to adblock
   const nsIFilePicker = Ci.nsIFilePicker;
   var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
   var stream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
   var streamIO = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);

   fp.init(window, null, nsIFilePicker.modeOpen);
   fp.appendFilters(nsIFilePicker.filterText);

   if (fp.show() != nsIFilePicker.returnCancel) {
      stream.init(fp.file, 0x01, parseInt("0444", 8), null);
      streamIO.init(stream);
      var input = streamIO.read(stream.available());
      streamIO.close();
      stream.close();

      var linebreak = input.match(/(((\n+)|(\r+))+)/m)[1]; // first: whole match -- second: backref-1 -- etc..
      return input.split(linebreak);
   }
   return null;
}

function sessionManagerOptions() {
   var browserWindow = Tabmix.getTopWin();
   browserWindow.TabmixConvertSession.sessionManagerOptions();
}

function convertSession() {
   var browserWindow = Tabmix.getTopWin();
   if ($("chooseFile").selectedItem.value == 0)
      browserWindow.TabmixConvertSession.selectFile(window);
   else
      browserWindow.TabmixConvertSession.convertFile();

   this.focus();
}

var applyData = [];
function userChangedValue(aEvent) {
   var item = aEvent.target;

   // only allow event from this item to go on....
   var n = item.localName;
   if (n == "radio" && item.hasAttribute("pane"))
      return;

   if (n != "radio" && n != "menuitem" &&
              n != "checkbox" && n != "textbox")
      return;

   if (n == "checkbox" && $("obs_" + item.id))
     TM_Options.disabled(item);

   // if we fail once no need to continue and we keep the apply button enable
   if ("undefined" in applyData)
      return;

   // set item for menuitem
   if (n == "menuitem")
     item = item.parentNode.parentNode;
   // set item for radio
   if (n == "radio")
     item = item.parentNode;

   if (item.hasAttribute("prefstring_item")) {
     var itemId = item.getAttribute("prefstring_item");
     if (itemId == "no_prefstring")
       return;
     else {
       item = $(itemId);
       item.value = aEvent.target.value; // we don't use this for checkbox
     }
   }

   if (item.hasAttribute("prefstring"))
      updateApplyData(item);
   else {
      Tabmix.log("erorr in tabmix options, item.id " + aEvent.target.id + "\n has no prefstring");
      applyData["undefined"] = true;
      TMP_setButtons(false);
   }
}

// return value from item
function getValue(item) {
   if (item.localName == "checkbox")
      return item.hasAttribute("inverted") ? !item.checked : item.checked;
   if (item.hasAttribute("boolean"))
      return item.selectedIndex == 0;

   return item.value;
}

// set value to item
function setValue(item, newValue) {
   if (item.localName == "checkbox")
      item.checked = item.hasAttribute("inverted") ? !newValue : newValue;
   else
      item.value = newValue;
}

function updateApplyData(item, newValue) {
   if (typeof(newValue) == "undefined")
     newValue = getValue(item);
   else
     setValue(item, newValue);

   var pref = item.getAttribute("prefstring");
   var savedValue = getPrefByType(pref);

   if (savedValue != newValue) {
     // instant apply except when user change min/max width value
     if (instantApply && item.id != "minWidth" && item.id != "maxWidth") {
       setPrefByType(pref, newValue);
       Services.prefs.savePrefFile(null);
       return;
     }
     else
      applyData[pref] = newValue;
   }
   else if (pref in applyData)
      delete applyData[pref];

   var applyDataIsEmpty = true;
   for (let n in applyData) {
      applyDataIsEmpty = false;
      break;
   }
   var applyButton = document.documentElement.getButton("extra1");
   if (applyButton.disabled != applyDataIsEmpty)
     TMP_setButtons(applyDataIsEmpty);
}

function TMP_setButtons(disable, clearData, start) {
   var docElt = document.documentElement;
   var applyButton = docElt.getButton("extra1");
   var acceptButton = docElt.getButton("accept");
   var cancelButton = docElt.getButton("cancel");
   if (start) {
      let settingsButton = docElt.getButton("extra2");
      settingsButton.id = "myExtra2";
      settingsButton.className += " tabmix-button";
      settingsButton.label = docElt.getAttribute("setingsbuttonlabel");
      settingsButton.setAttribute("popup", "tm-settings");

      let helpButton = docElt.getButton("help");
      helpButton.className += " tabmix-button";
      helpButton.id = "helpButton";

      acceptButton.id = "myAccept";
      acceptButton.className += " tabmix-button";

      applyButton.id = "myApply";
      applyButton.className += " tabmix-button";
      applyButton.setAttribute("icon", "apply");

      cancelButton.id = "myCancel";
      cancelButton.className += " tabmix-button";
      docElt.setAttribute("cancelbuttonlabel", cancelButton.label);

      var spacer = document.getAnonymousElementByAttribute(docElt, "anonid", "spacer");
      spacer.hidden = false;
   }

   // when in instantApply mode apply and accept buttons are hidden except when user
   // change min/max width value
   applyButton.disabled = disable;
   applyButton.hidden = instantApply && disable;
   acceptButton.hidden = disable;

   // no buttons on Mac except Help in instantApply mode
   cancelButton.hidden = Tabmix.isPlatform("Mac") && instantApply && disable;

   var action = disable ? "close" : "cancel"
   cancelButton.label = docElt.getAttribute(action + "buttonlabel");
   cancelButton.setAttribute("icon", action);

   if (clearData)
      applyData = [];
}

function setLastTab(event) {
try {
   // remove EventListener when we exit
   window.removeEventListener("unload", setLastTab, false);
   window.removeEventListener("command", userChangedValue, false);
   window.removeEventListener("input", userChangedValue, false);
   window.removeEventListener("change", userChangedValue, false);
   $("tabclicking_tabs").removeEventListener("select", tabSelectionChanged, false);

   Tabmix.prefs.setIntPref("selected_tab", $("tabMixTabBox").selectedIndex);
   var subtabs = document.getElementsByAttribute("subtub", "true");
   var subTab = "selected_sub_tab";
   for (var i = 0; i < subtabs.length; i++)
      Tabmix.prefs.setIntPref(subTab + subtabs[i].getAttribute("value"), subtabs[i].selectedIndex);

  Services.prefs.savePrefFile(null); // store the pref immediately

} catch(ex) {}
}

function getTab() {
try {
   var selTabindex = Tabmix.getIntPref("selected_tab" , 0, true);
   TM_selectTab(selTabindex);

   var subtabs = document.getElementsByAttribute("subtub", true);
   var subTab = "extensions.tabmix.selected_sub_tab";
   for (var i = 0; i < subtabs.length; i++) {
      var val = Tabmix.getIntPref(subTab + subtabs[i].getAttribute("value"), 0);
      subtabs[i].selectedIndex = val;
   }
} catch(ex) {Tabmix.log(ex);}
}

// this function is called from here and from Tabmix.openOptionsDialog if the dialog already opened
function TM_selectTab(aSelTab) {
  var tabbox = $("tabMixTabBox");
  tabbox.lastselectedIndex = tabbox.selectedIndex;
  tabbox.selectedIndex = (aSelTab) ? aSelTab : 0;
  $("TM_ButtonBox").selectedIndex = tabbox.selectedIndex;
}

var gIncompatiblePane = {
  checkForIncompatible: function (aShowList) {
     let tmp = { };
     Components.utils.import("resource://tabmixplus/extensions/CompatibilityCheck.jsm", tmp);
     new tmp.CompatibilityCheck(window, aShowList, true);
  },

  // call back function from CompatibilityCheck.jsm
  hide_IncompatibleNotice: function (aHide, aFocus) {
    var button = $("buttonIncompatible");
    if (button.collapsed != aHide) {
      button.collapsed = aHide;
      $("incompatible_panel").collapsed = aHide;
    }

    var tabbox = $("tabMixTabBox")
    if (aHide && tabbox.selectedIndex == 6)
      TM_selectTab(tabbox.lastselectedIndex);

    if (aFocus)
      window.focus();
  }
}

function tabSelectionChanged(event) {
   if (!event || event.target.localName != "tabs")
      return;

   var index = event.target.selectedIndex;
   setSelectedIndex(index);
}

function setSelectedIndex(index) {
   var c = ["dbl", "middle", "ctrl", "shift", "alt"];
   var clickTab = $("ClickTab");
   var prefId = c[index] + "ClickTab";
   clickTab.value = $(prefId).value;
   clickTab.setAttribute("prefstring_item", prefId);

   var clickTabbar = $("ClickTabbar");
   prefId = c[index] + "ClickTabbar";
   clickTabbar.value = $(prefId).value;
   clickTabbar.setAttribute("prefstring_item", prefId);
}

function _ensureElementIsVisible(aPopup) {
  var scrollBox = document.getAnonymousElementByAttribute(aPopup, "class", "popup-internal-box");
  scrollBox.ensureElementIsVisible(aPopup.parentNode.selectedItem);
}

function tabmixCustomizeToolbar() {
  window._tabmixCustomizeToolbar = true;
  Tabmix.getTopWin().BrowserCustomizeToolbar();
}

function toolbarButtons(aWindow) {
  // Display > Toolbar
  var buttons = ["btn_sessionmanager", "btn_undoclose", "btn_closedwindows", "btn_tabslist"];
  var onToolbar = $("onToolbar");
  var onPlate = $("onPlate");
  for (var i = 0; i < buttons.length; ++i ) {
    var button = aWindow.document.getElementById(buttons[i]);
    var optionButton = $("_" + buttons[i]).parentNode;
    if (button)
      onToolbar.appendChild(optionButton);
    else
      onPlate.appendChild(optionButton);
  }
  onToolbar.childNodes[1].hidden = onToolbar.childNodes.length > 2;
  onPlate.childNodes[1].hidden = onPlate.childNodes.length > 2;

  // Display > Tab bar
  function updateDisabledState(buttonID, itemID) {
    let button = aWindow.document.getElementById(buttonID);
    let enablePosition =  button && button.parentNode == aWindow.gBrowser.tabContainer._container;

    TM_Options.setItem(itemID, "disableObserver", !enablePosition || null);
    TM_Options.setItem(itemID, "disabled", !enablePosition || null);
    TM_Options.disabled(itemID, !enablePosition);
  }
  updateDisabledState("new-tab-button", "newTabButton");
  updateDisabledState("alltabs-button", "hideAllTabsButton");
}

function openHelp(aPageaddress) {
  if (!aPageaddress) {
    let helpPages = [{id:"Links",   tabs:[""]},
                     {id:"Events",  tabs:["New_Tabs", "tab_opening", "Tab_Closing", "Tab_Merging", "Tab_Features"]},  // 1
                     {id:"Display", tabs:["Tab_bar", "Tab" , "ToolBar"]},                                             // 2
                     {id:"Mouse",   tabs:["Mouse_Gestures", "Mouse_Clicking"]},                                       // 3 //sub sub tab 6
                     {id:"Menu",    tabs:["Tab_Context_Menu", "Main_Context_Menu", "Tools_Menu"]},                    // 4
                     {id:"Session", tabs:["StartExit", "Restore" , "Preserve"]},                                      // 5
                    ];
    // get curent tab index and sub tab if there is one
    let topLevel, subLevel;
    topLevel = subLevel = $("tabMixTabBox").selectedIndex;
    if (topLevel > 0) {
      if (topLevel < 4)
        subLevel--;
      let subtabs = document.getElementsByAttribute("subtub", "true");
      subLevel = subtabs[subLevel].selectedIndex
    }
    let subPage = helpPages[topLevel].tabs[subLevel];
    aPageaddress = helpPages[topLevel].id + (subPage ? "_-_" + subPage : "");
  }
  var helpPage = "http://tmp.garyr.net/help"
  var helpUrl = helpPage + "/#" + aPageaddress;
  var tabToSelect;
  // Check if the help page already open
  var recentWindow = Tabmix.getTopWin();
  var tabBrowser = recentWindow.gBrowser;
  for (var i = 0; i < tabBrowser.browsers.length; i++) {
    if (tabBrowser.browsers[i].currentURI.spec.indexOf(helpPage) == 0) {
      tabToSelect = tabBrowser.tabs[i];
      break;
    }
  }
  if (!tabToSelect) {
    if (tabBrowser.isBlankNotBusyTab(tabBrowser.mCurrentTab))
      tabToSelect = tabBrowser.mCurrentTab;
    else
      tabToSelect = tabBrowser.addTab("about:blank");
  }
  tabToSelect.linkedBrowser.stop();
  tabBrowser.selectedTab = tabToSelect;
  tabBrowser.selectedBrowser.userTypedValue = helpUrl;
  // allow to load in current tab
  tabBrowser.selectedBrowser.tabmix_allowLoad = true;
  recentWindow.loadURI(helpUrl, null, null, false);
  tabBrowser.selectedBrowser.focus();
}
