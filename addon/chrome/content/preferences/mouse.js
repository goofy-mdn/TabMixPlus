/* exported gMousePane */
"use strict";

var gMousePane = {
  _inited: false,
  clickTab: null,
  clickTabbar: null,
  init() {
    MozXULElement.insertFTLIfNeeded("browser/tabContextMenu.ftl");
    Tabmix.setFTLDataId("paneMouse");

    if (TabmixSvc.isMac) {
      let label = $("tabId").getAttribute("label2");
      $("tabId").setAttribute("label", label);
    }

    $("ClickTabPinTab").label = gPrefWindow.pinTabLabel;

    // Init tabclicking options
    this.clickTab = $("ClickTab");
    var menuPopup = this.clickTab.firstChild;
    // block item in tabclicking options that are not in use
    var blocked = TabmixSvc.blockedClickingOptions;
    for (let i = 0; i < blocked.length; i++) {
      let item = menuPopup.getElementsByAttribute("value", blocked[i])[0];
      item.hidden = true;
    }
    this.clickTabbar = $("ClickTabbar");
    this.clickTabbar.appendChild(this.clickTab.firstChild.cloneNode(true));
    this.updatePanelPrefs($("tabclick").selectedIndex);
    this.updateDblClickTabbar($("pref_click_dragwindow"));

    gPrefWindow.initPane("paneMouse");

    this._inited = true;
  },

  tabSelectionChanged(aEvent) {
    if (aEvent.target.localName != "tabpanels")
      return;
    gPrefWindow.tabSelectionChanged(aEvent);

    if (this._inited)
      this.updatePanelPrefs(aEvent.target._tabbox.tabs.selectedIndex);
  },

  _options: ["dbl", "middle", "ctrl", "shift", "alt"],
  updatePanelPrefs(aIndex) {
    let panel = this._options[aIndex];
    let prefID = "pref_" + panel + "ClickTab";
    // update "ClickTab" menulist
    this.updatePref(this.clickTab, prefID);
    // update "ClickTabbar" menulist
    this.updatePref(this.clickTabbar, prefID + "bar");
    // Linux uses alt key down to trigger the top menu on Ubuntu or
    // start drag window on OpenSuSe
    let disabled = TabmixSvc.isLinux && panel == "alt";
    if (disabled) {
      Tabmix.setItem(this.clickTabbar, "disabled", disabled);
      Tabmix.setItem(this.clickTabbar.previousSibling, "disabled", disabled);
    }
  },

  updatePref(element, prefID) {
    let preference = $(prefID);
    element.setAttribute("preference", prefID);
    preference.setElementValue(element);
  },

  ensureElementIsVisible(aPopup) {
    var scrollBox = aPopup._scrollBox;
    scrollBox.ensureElementIsVisible(aPopup.parentNode.selectedItem);
  },

  resetPreference(checkbox) {
    let menulist = $(checkbox.getAttribute("control"));
    let prefID = menulist.getAttribute("preference");
    $(prefID).value = checkbox.checked ? (menulist[prefID] || 0) : -1;
  },

  setCheckedState(menulist) {
    let prefID = menulist.getAttribute("preference");
    let val = $(prefID).value;
    if (val != -1)
      menulist[prefID] = val;
    menulist.disabled = val == -1;
    menulist.previousSibling.checked = !menulist.disabled;
  },

  updateDblClickTabbar(pref) {
    let dblClickTabbar = $("pref_dblclick_changesize");
    if (pref.value && !dblClickTabbar.value)
      dblClickTabbar.value = pref.value;
    let checkbox = $("dblclick_changesize")._checkbox;
    let image = checkbox.getElementsByClassName("checkbox-check")[0];
    Tabmix.setItem(image, "disabled", pref.value || null);
  }

};
