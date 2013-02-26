
var EXPORTED_SYMBOLS = ["Shortcuts"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://tabmixplus/Services.jsm");
Cu.import("resource://tabmixplus/log.jsm");

let Shortcuts = {
  keys: {
    newTab: {id: "key_newNavigatorTab", default: "T accel"},
    dupTab: {default: "T accel,alt"},
    dupTabToWin: {command: 14},
    detachTab: {default: "N accel,alt"},
    togglePinTab: {command: 31},
    protecttab: {command: 5},
    locktab: {command: 6},
    freezetab: {command: 15},
    renametab: {command: 11},
    copyTabUrl: {command: 28},
    pasteTabUrl: {command: 29},
    selectMerge: {command: 22},
    mergeWin: {default: "M accel,shift"},
    addBookmark: {id: "addBookmarkAsKb", default: "D accel"},
    bookmarkAllTabs: {id: "bookmarkAllTabsKb", default: "D accel,shift"},
    reload: {id: "key_reload", default: "R accel"},
    browserReload: {default: "VK_F5"},
    reloadtabs: {command: 7},
    reloadothertabs: {command: 16},
    reloadlefttabs: {command: 19},
    reloadrighttabs: {command: 20},
    autoReloadTab: {command: 30},
    close: {id: "key_close", default: "W accel"},
    removeall: {command: 9},
    removesimilar: {command: 24},
    removeother: {command: 8},
    removeleft: {command: 17},
    removeright: {command: 18},
    undoClose: {default: "VK_F12 accel"},
    undoCloseTab: {id: "key_undoCloseTab", default: "T accel,shift"},
    ucatab: {command: 13},
    saveWindow: {id: "key_tm-sm-saveone", default: "VK_F1 accel", sessionKey: true},
    saveSession: {id: "key_tm-sm-saveall", default: "VK_F9 accel", sessionKey: true},
    slideShow: {default: "d&VK_F8"},
    toggleFLST: {default: "d&VK_F9"}
  },

  get prefs() {
    delete this.prefs;
    this.prefs = Services.prefs.getBranch("extensions.tabmix.");
    if (!TabmixSvc.version(130))
      this.prefs.QueryInterface(Ci.nsIPrefBranch2);
    return this.prefs;
  },

  prefsChangedByTabmix: false,
  updatingShortcuts: false,
  prefBackup: null,
  initialized: false,
  permanentPrivateBrowsing: false,
  keyConfigInstalled: false,

  initService: function(aWindow) {
    if (this.initialized)
      return;
    this.initialized = true;

    if (TabmixSvc.version(200)) {
      let tmp = {}
      Cu.import("resource://gre/modules/PrivateBrowsingUtils.jsm", tmp);
      this.permanentPrivateBrowsing = tmp.PrivateBrowsingUtils.permanentPrivateBrowsing;
    }
    else
      this.permanentPrivateBrowsing = Cc["@mozilla.org/privatebrowsing;1"].
          getService(Ci.nsIPrivateBrowsingService).autoStarted;

    // update keys initial value and label
    let labels = aWindow.Tabmix.shortcutsLabels;
    labels.togglePinTab =
        aWindow.document.getElementById("context_pinTab").getAttribute("label") + "/" +
        aWindow.document.getElementById("context_unpinTab").getAttribute("label");
    for (let [key, keyData] in Iterator(this.keys)) {
      keyData.value = keyData.default || "";
      if (key in labels)
        keyData.label = labels[key];
    }
    delete aWindow.Tabmix.shortcutsLabels;

    if (aWindow.keyconfig) {
      this.keyConfigInstalled = true;
      KeyConfig.init(aWindow);
    }

    this.prefs.addObserver("shortcuts", this, false);
    this.prefs.addObserver("sessions.manager", this, false);
    Services.obs.addObserver(this, "quit-application", false);
  },

  observe: function(aSubject, aTopic, aData) {
    switch (aTopic) {
      case "nsPref:changed":
        this.onPrefChange(aData);
        break;
      case "quit-application":
        this.prefs.removeObserver("shortcuts", this);
        this.prefs.removeObserver("sessions.manager", this);
        Services.obs.removeObserver(this, "quit-application");
        if (this.keyConfigInstalled)
          Keyconfig.deinit();
        break;
    }
  },

  onPrefChange: function TMP_SC_onPrefChange(aData) {
try {
    if (this.updatingShortcuts ||
        aData != "shortcuts" && aData != "sessions.manager")
      return;
    this.updatingShortcuts = true;
    // instead of locking the preference just revert any changes user made
    if (aData == "shortcuts" && !this.prefsChangedByTabmix) {
      this.setShortcutsPref();
      return;
    }

    let [changedKeys, needUpdate] = this._getChangedKeys({onChange: aData == "shortcuts"});
    if (needUpdate) {
      let windowsEnum = Services.wm.getEnumerator("navigator:browser");
      while (windowsEnum.hasMoreElements()) {
        let win = windowsEnum.getNext();
        if (!win.closed)
          this.updateWindowKeys(win, changedKeys);
      }
      if (this.keyConfigInstalled)
        KeyConfig.syncToKeyConfig(changedKeys, true);
    }

    this.updatingShortcuts = false;
} catch (ex) {_log.assert(ex);}
  },

  /* ........ Window Event Handlers .............. */

  handleEvent: function(aEvent) {
    switch (aEvent.type) {
      case "command":
        this.onCommand(aEvent.currentTarget);
        break;
      case "unload":
        this.onUnload(aEvent.currentTarget);
        break;
    }
  },

  onCommand: function TMP_SC_onCommand(aKey) {
try {
    let win = aKey.ownerDocument.defaultView;
    let command = this.keys[aKey._id].command;
    win.TabmixTabClickOptions.doCommand(command, win.gBrowser.selectedTab);
} catch (ex) {_log.assert(ex);}
  },

  onUnload: function TMP_SC_onUnload(aWindow) {
    aWindow.removeEventListener("unload", this, false);
    let document = aWindow.document;
    for (let [key, keyData] in Iterator(this.keys)) {
      if (keyData.command && keyData.value) {
        let keyItem = document.getElementById(keyData.id || "key_tm_" + key);
        if (keyItem)
          keyItem.removeEventListener("command", this, true);
      }
    }
  },

  onWindowOpen: function TMP_SC_onWindowOpen(aWindow) {
    this._setReloadKeyId(aWindow);
    this.initService(aWindow);

    aWindow.addEventListener("unload", this, false);

    let [changedKeys, needUpdate] = this._getChangedKeys({onOpen: true});
    if (needUpdate)
      this.updateWindowKeys(aWindow, changedKeys);
  },

  /* ........ Window Key Handlers .............. */

  updateWindowKeys: function TMP_SC_updateWindowKeys(aWindow, aKeys) {
    for (let [key, keyData] in Iterator(aKeys))
      this._updateKey(aWindow, key, keyData);

    let keyset = aWindow.document.getElementById("mainKeyset");
    keyset.parentNode.insertBefore(keyset, keyset.nextSibling);
  },

  _updateKey: function TMP_SC__updateKey(aWindow, aKey, aKeyData) {
    let document = aWindow.document;
    let keyAtt = this.keyParse(aKeyData.value || "d&");
    if (aKeyData.sessionKey && aKeyData.blocked)
      keyAtt.disabled = true;
    let id = aKeyData.id || "key_tm_" + aKey;
    let keyItem = document.getElementById(id);
    if (keyItem) {
      if (!keyItem.parentNode)
        return;
      for (let att in Iterator(keyAtt, true))
        keyItem.removeAttribute(att);
    }
    else {
      let parentNode = document.getElementById("mainKeyset");
      // don't add disabled key
      if (!parentNode || keyAtt.disabled)
        return;
      keyItem = document.createElementNS(NS_XUL, "key");
      keyItem.setAttribute("id", id);
      keyItem._id = aKey;
      parentNode.appendChild(keyItem);
      keyItem.setAttribute("label", aKeyData.label);
      keyItem.setAttribute("oncommand", "void(0);");
      keyItem.addEventListener("command", this, true);
    }

    for (let [att, val] in Iterator(keyAtt)) {
      if (val)
        keyItem.setAttribute(att, val);
    }
    let disabled = keyAtt.disabled;
    // remove existing acceltext from menus
    let items = document.getElementsByAttribute("key", keyItem.id);
    for (let i = 0, l = items.length; i < l; i++)
      items[i].setAttribute("acceltext", disabled ? " " : "");

    // turn off slideShow if need to
    if (aKey == "slideShow" && keyAtt.disabled &&
        aWindow.Tabmix.SlideshowInitialized && aWindow.Tabmix.flst.slideShowTimer) {
        aWindow.Tabmix.flst.cancel();
    }
  },

  /* ........ Auxiliary Functions .............. */

  _getChangedKeys: function TMP_SC__getChangedKeys(aOptions) {
    let shortcuts = !aOptions.onChange && this.prefBackup || this._getShortcutsPref();
    let disableSessionKeys = this.permanentPrivateBrowsing ||
        !this.prefs.getBoolPref("sessions.manager");
    let changedKeys = {}, onOpen = aOptions.onOpen;
    for (let [key, keyData] in Iterator(this.keys)) {
      let currentValue = onOpen ? keyData.default || "" : keyData.value;
      let newValue = shortcuts[key] || keyData.default || "";
      let updatBlockState = keyData.sessionKey && !/^d&/.test(newValue) &&
          (onOpen ? disableSessionKeys :
          disableSessionKeys != keyData.blocked);
      if (keyData.sessionKey)
        keyData.blocked = disableSessionKeys;
      if (currentValue != newValue || updatBlockState) {
        keyData.value = newValue;
        changedKeys[key] = keyData;
      }
    }

    return [changedKeys, Object.keys(changedKeys).length];
  },

  _getShortcutsPref: function TMP_SC__getShortcutsPref() {
    let shortcuts = null, updatePreference = false;
    try {
      shortcuts = JSON.parse(this.prefs.getCharPref("shortcuts"));
    } catch (ex) {}
    if (shortcuts == null) {
      _log.log("failed to read shortcuts preference.\nAll shortcuts was resets to default");
      shortcuts = {};
      updatePreference = true;
    }
    for (let [key, val] in Iterator(shortcuts)) {
      // if key in preference is not valid key or its value is not valid
      // or its value equal to default, remove it from the preference
      let keyData = this.keys[key] || null;
      if (!keyData || typeof val != "string" || val == keyData.default || val == "" ||
          (val == "d&" && (!keyData.default || /^d&/.test(keyData.default)))) {
        delete shortcuts[key];
        updatePreference = true;
      }
      else if (keyData.default && (val == "d&" + keyData.default)) {
        shortcuts[key] = "d&";
        updatePreference = true;
      }
      else if (!this.prefBackup) {
        // make sure user didn't changed the preference in prefs.js
        let newValue = this._userChangedKeyPref(val) || keyData.value;
        if (newValue != val) {
          if (newValue == keyData.default)
            delete shortcuts[key];
          else
            shortcuts[key] = newValue;
          updatePreference = true;
        }
      }
    }
    this.prefBackup = shortcuts;
    if (updatePreference)
      this.setShortcutsPref();
    return shortcuts;
  },

  _userChangedKeyPref: function(value) {
    let key = value && this.keyParse(value);
    if (!key)
      return "";
    let modifiers = key.modifiers.replace(/^[\s,]+|[\s,]+$/g,"")
          .replace("ctrl", "control").split(",");
    key.modifiers = ["control","meta","accel","alt","shift"].filter(
      function(mod) new RegExp(mod).test(modifiers)).join(",");

    // make sure that key and keycod are valid
    key.key = key.key.toUpperCase();
    if (key.key == " ")
      [key.key , key.keycode] = ["", "VK_SPACE"];
    else {
      key.keycode = "VK_" + key.keycode.toUpperCase().replace(/^VK_/, "");
      if (key.keycode != "VK_BACK" && !(("DOM_" + key.keycode) in Ci.nsIDOMKeyEvent))
        // not all items in Ci.nsIDOMKeyEvent are valid as keyboard shortcuts
        key.keycode = "";
    }
    return this.validateKey(key);
  },

  setShortcutsPref: function() {
    this.updatingShortcuts = true;
    this.prefs.setCharPref("shortcuts", JSON.stringify(this.prefBackup));
    this.updatingShortcuts = false;
  },

  keyParse: function keyParse(value) {
    let disabled = /^d&/.test(value);
    let [keyVal, modifiers] = value.replace(/^d&/, "").split(" ");
    let isKey = keyVal.length == 1;
    return {modifiers: modifiers || "" ,key: isKey ? keyVal : "" ,keycode: isKey ? "" : keyVal, disabled: disabled};
  },

  // convert key object {modifiers, key, keycode} into a string with " " separator
  keyStringify: function keyStringify(value) {
    if (!value)
      return "";
    return [(value.disabled ? "d&" : "") + (value.key || value.keycode),
             value.modifiers].join(" ").replace(/[\s|;]$/, "");
  },

  validateKey: function validateKey(key) {
    if ((key.keycode && key.keycode == "VK_SCROLL_LOCK" || key.keycode == "VK_CONTEXT_MENU") ||
       (!key.key && !key.keycode)) {
      key = null;
    }
    // block ALT + TAB
    else if (key.modifiers && /alt/.test(key.modifiers) && key.keycode &&
        (key.keycode == "VK_BACK_QUOTE" || key.keycode == "VK_TAB")) {
      key = null;
    }

    return key ? this.keyStringify(key) : "";
  },

  getPlatformAccel: function() {
    switch (Services.prefs.getIntPref("ui.key.accelKey")) {
      case 17:  return "control"; break;
      case 18:  return "alt"; break;
      case 224: return "meta"; break;
    }
    return Services.appinfo.OS == "Darwin" ? "meta" : "control"
  },

  // add id for key Browser:Reload
  _setReloadKeyId: function(aWindow) {
    let reload = aWindow.document.getElementsByAttribute("command", "Browser:Reload");
    if (!reload)
      return;
    Array.some(reload, function(key) {
      if (key.getAttribute("keycode") != "VK_F5")
        return false;
      if (!this.keys.browserReload.id) {
        let index = 1, id;
        do {
         id = "xxx_key#_Browser:Reload".replace("#", index++);
        } while (aWindow.document.getElementById(id));
        this.keys.browserReload.id = key.id = id;
      }
      else
        key.id = this.keys.browserReload.id;
      return true;
    }, this);
  }

}

let KeyConfig = {
  prefsChangedByTabmix: false,
  // when keyConfig extension installed sync the preference
  // user may change shortcuts in both extensions
  init: function(aWindow) {
    this.keyIdsMap = {};
    // keyConfig use index number for its ids
    let oldReloadId = "xxx_key29_Browser:Reload";
    this.keyIdsMap[oldReloadId] = "browserReload";
    for (let [key, keyData] in Iterator(Shortcuts.keys))
      this.keyIdsMap[keyData.id || "key_tm_" + key] = key;

    this.prefs = Services.prefs.getBranch("keyconfig.main.");
    let shortcuts = Shortcuts._getShortcutsPref();
    // sync non defualt shortcuts
    if (Object.keys(shortcuts).length > 0)
      this.syncToKeyConfig(shortcuts);
    else {
      let prefs = this.prefs.getChildList("").filter(function(pref) {
        let key = this.keyIdsMap[pref];
        return key && this.syncFromKeyConfig(key, pref, shortcuts);
      }, this);
      if (prefs.length > 0) {
        // we are here before onWindowOpen call updateWindowKeys
        // so we don't need to do anything else here
        Shortcuts.prefBackup = shortcuts;
        Shortcuts.setShortcutsPref();
      }
    }
    this.resetPref(oldReloadId);
    if (!TabmixSvc.version(130))
      this.prefs.QueryInterface(Ci.nsIPrefBranch2);
    this.prefs.addObserver("", this, false);
  },

  deinit: function() {
    this.prefs.removeObserver("", this);
  },

  observe: function(aSubject, aTopic, aData) {
    if (this.prefsChangedByTabmix)
      return;
    let key = this.keyIdsMap[aData];
    if (aTopic == "nsPref:changed" && key) {
      let shortcuts = Shortcuts.prefBackup || Shortcuts._getShortcutsPref();
      if (this.syncFromKeyConfig(key, aData, shortcuts)) {
        // keyConfig extension code updates the DOM key, we don't need to do it
        Shortcuts.prefBackup = shortcuts;
        Shortcuts.setShortcutsPref();
        Shortcuts.keys[key].value = shortcuts[key] || Shortcuts.keys[key].default;
      }
    }
  },

  syncFromKeyConfig: function(aKey, aPrefName, aShortcuts) {
    let prefValue, newValue, keyData = Shortcuts.keys[aKey];
    try {
      prefValue = this.prefs.getCharPref(aPrefName).split("][");
    } catch (ex) { }
    if (!prefValue)
      newValue = keyData.default;
    else if (prefValue[0] == "!")
      newValue = "d&";
    else {
      let newKey = {modifiers: prefValue[0].replace(" ", ","),
          key: prefValue[1], keycode: prefValue[2]};
      if (keyData.value.indexOf("accel") > -1)
        newKey.modifiers = newKey.modifiers.replace(Shortcuts.getPlatformAccel(), "accel");
      newValue = Shortcuts.keyStringify(newKey);
    }
    if (newValue != keyData.value) {
      if (newValue == keyData.default)
        delete aShortcuts[aKey];
      else
        aShortcuts[aKey] = newValue;
      return true;
    }
    return false;
  },

  syncToKeyConfig: function(aChangedKeys, onChange) {
    for (let [key, prefVal] in Iterator(aChangedKeys)) {
      this.prefsChangedByTabmix = true;
      if (onChange)
        prefVal = prefVal.value;
      let id = Shortcuts.keys[key].id || "key_tm_" + key;
      if (!prefVal || prefVal == Shortcuts.keys[key].default)
        this.resetPref(id);
      else {
        let obj = Shortcuts.keyParse(prefVal);
        let newValue = obj.disabled ? ["!", "", ""] :
          [obj.modifiers.replace(",", " "), obj.key, obj.keycode].join("][");
        this.prefs.setCharPref(id, newValue);
      }
      this.prefsChangedByTabmix = false;
    }
  },

  resetPref: function (prefName) {
    // we need this check for Firefox 4.0-5.0
    if (this.prefs.prefHasUserValue(prefName))
      this.prefs.clearUserPref(prefName);
  }

}