/*////////////////////////////////////////////////////////////////////
// The Original Code is the "LastTab" extension for Mozilla Firefox.//
// version 1.5 - October 26, 2005                                   //
// The Initial Developer of the Original Code is Timothy Humphrey.  //
/*////////////////////////////////////////////////////////////////////
var TMP_LastTab = {
   CtrlKey : false,
   favorLeftToRightOrdering : true,
   handleCtrlTab : true,
   KeyboardNavigating : true,
   KeyLock : false,
   respondToMouseInTabList : true,
   showTabList : true,
   SuppressTabListReset : false,
   TabHistory : [],
   TabIndex : 0,
   TabList : null,
   TabListLock : false,
   _inited: false,

   DisplayTabList : function() {
      var element = document.documentElement;
      var tablist = this.TabList;
      var menuitem, tab, imageUrl, x, y, i, activeIndex;

      TabmixAllTabs.createCommonList(tablist, this.handleCtrlTab ? 3 : 2);
      var item = this.tabs[this.TabIndex].mCorrespondingMenuitem;
      item.setAttribute("_moz-menuactive", "true");
      TabmixAllTabs.updateMenuItemActive(null, item);

      //moveTo() method introduces anomalies, e.g. hovering over location bar moves the popup; hiding	and showing the popup works better
      x = -element.boxObject.screenX;
      y = 10000;
      tablist.showPopup(element, x, y, "popup", null, null); //show offscreen to get popup measurements
      x = Math.round((window.outerWidth - tablist.boxObject.width) / 2) - (element.boxObject.screenX - window.screenX);
      y = Math.round((window.outerHeight - tablist.boxObject.height) / 2) - (element.boxObject.screenY - window.screenY);
      if(x + element.boxObject.screenX < 0)
         x = -element.boxObject.screenX;
      else if(x + element.boxObject.screenX + tablist.boxObject.width > window.screen.availWidth)
         x = window.screen.availWidth - tablist.boxObject.width - element.boxObject.screenX;
      if(y + element.boxObject.screenY < 0)
         y = -element.boxObject.screenY;
      else if(y + element.boxObject.screenY + tablist.boxObject.height > window.screen.availHeight)
         y = window.screen.availHeight - tablist.boxObject.height - element.boxObject.screenY;
      if(x == -1 && y == -1) //workaround special status of -1, -1 position in showPopup() method
         x = y = 0;
      this.SuppressTabListReset = true;
      tablist.hidePopup();
      this.SuppressTabListReset = false;
      tablist.showPopup(element, x, y, "popup", null, null);

      var ietab = "chrome://ietab/content/reloaded.html?url="
      if (gBrowser.currentURI.spec.indexOf(ietab) == 0)
         tablist.focus();

      this.TabListLock = true;
   },

   init : function() {
      this._inited = true;
      var browser = document.documentElement;

      this.TabList = document.getElementById("lasttabTabList");

      gBrowser.mTabBox._eventNode.removeEventListener("keypress", gBrowser.mTabBox, false);
      browser.addEventListener("keydown", this, true);
      browser.addEventListener("keypress", this, true);
      browser.addEventListener("keyup", this, true);
      this.TabList.addEventListener("DOMMenuItemActive", this, true);
      this.TabList.addEventListener("DOMMenuItemInactive", this, true);

      // if session manager select other tab then the first one we need to build TabHistory in two steps
      // to maintain natural Ctrl-Tab order.
      this.TabHistory = [];
      var currentIndex = gBrowser.mCurrentTab._tPos;
      for (let i = currentIndex; i < gBrowser.tabs.length; i++)
        this.TabHistory.unshift(gBrowser.tabs[i]);
      for (let i = 0; i < currentIndex; i++)
        this.TabHistory.unshift(gBrowser.tabs[i]);

      this.ReadPreferences();
   },

   deinit : function() {
      var browser = document.documentElement;
      browser.removeEventListener("keydown", this, true);
      browser.removeEventListener("keypress", this, true);
      browser.removeEventListener("keyup", this, true);
      this.TabList.removeEventListener("DOMMenuItemActive", this, true);
      this.TabList.removeEventListener("DOMMenuItemInactive", this, true);
   },

   handleEvent : function(event) {
      switch (event.type) {
         case "keydown":
            this.OnKeyDown(event);
            break;
         case "keypress":
            this.OnKeyPress(event);
            break;
         case "keyup":
            this.OnKeyUp(event);
            break;
         case "DOMMenuItemActive":
            this.ItemActive(event);
            break;
         case "DOMMenuItemInactive":
            this.ItemInactive(event);
            break;
      }
   },

   ItemActive : function(event) {
      TabmixAllTabs.updateMenuItemActive(event);
      if(this.respondToMouseInTabList) {
         if(this.KeyboardNavigating) {
            if(event.target.value != this.inverseIndex(this.TabIndex))
               this.tabs[this.TabIndex].mCorrespondingMenuitem.setAttribute("_moz-menuactive", "false");
            this.KeyboardNavigating = false;
         }
         this.TabIndex = this.inverseIndex(event.target.value);
      }
      else {
         if(event.target.value != this.inverseIndex(this.TabIndex))
            event.target.setAttribute("_moz-menuactive", "false");
      }
   },

   ItemInactive : function(event) {
      TabmixAllTabs.updateMenuItemInactive(event);
      if(!this.respondToMouseInTabList && event.target.value == this.inverseIndex(this.TabIndex))
         event.target.setAttribute("_moz-menuactive", "true");
   },

   attachTab: function TMP_LastTab_attachTab(aTab, aPos) {
     if (!this._inited)
       return;

     this.detachTab(aTab);
     if (this.favorLeftToRightOrdering) {
      let index = this.TabHistory.indexOf(gBrowser._lastRelatedTab);
      if (index < 0)
        index = 1;
      this.TabHistory.splice(index, 0, aTab);
     }
     else
       this.TabHistory.splice(this.TabHistory.length-1, 0, aTab);
   },

   detachTab: function TMP_LastTab_detachTab(aTab) {
     var i = this.TabHistory.indexOf(aTab);
     if (i >= 0)
       this.TabHistory.splice(i, 1);
   },

   MaintainTabHistory: function TMP_LastTab_MaintainTabHistory(lastIndex) {
      var newTabs = [], tab, i;

      // Gather tab synchronization info
      if (typeof(lastIndex)=="undefined")
        lastIndex = gBrowser.tabs.length;
      for(i = 0; i < lastIndex; i++) {
         tab = gBrowser.tabs[i];
         if(this.TabHistory.indexOf(tab) == -1)
            newTabs[newTabs.length] = tab;
      }

      // Purge old tab info from history
      i = 0;
try{
      while(i < this.TabHistory.length) {
         let tab = this.TabHistory[i];
         if (!tab || gBrowser._removingTabs.indexOf(tab) > -1 || tab.parentNode != gBrowser.tabContainer)
            this.TabHistory.splice(i, 1);
         else
            i++;
      }
} catch (e) {Tabmix.log("error from Ctrl+Tab in MaintainTabHistory " + typeof(this.TabHistory[i]) + "\n" + e
+ "\n" + "this.TabHistory.length " + this.TabHistory.length + "\n" + "i " + i);}

      // Add new tabs to history
      if(newTabs.length > 0) {
         tab = this.TabHistory.pop();
         if(this.favorLeftToRightOrdering) {
            for(i = newTabs.length - 1; i >= 0; i--) {
               this.TabHistory.push(newTabs[i]);
            }
         }
         else {
            for(i = 0; i < newTabs.length; i++) {
               this.TabHistory.push(newTabs[i]);
            }
         }
         this.TabHistory.push(tab);
      }
   },

   OnKeyDown : function(event) {
      this.CtrlKey = event.ctrlKey && !event.altKey && !event.metaKey;
   },

   set tabs (val) {
     if (val != null)
       return;

     if (this.handleCtrlTab && this.TabHistory.length != gBrowser.tabs.lenght)
       this.MaintainTabHistory();

     this._tabs = null;
   },

   get tabs () {
     if (this._tabs)
       return this._tabs;
     let list;
     if (this.handleCtrlTab) {
       if (this.TabHistory.length != gBrowser.tabs.lenght)
         this.MaintainTabHistory();
       list = this.TabHistory;
     }
     else
      list = gBrowser.tabs;
     this._tabs = Array.filter(list, function(tab) {
       return !tab.hidden && gBrowser._removingTabs.indexOf(tab) == -1;
     });
     return this._tabs;
   },

   OnKeyPress : function _LastTab_OnKeyPress(event) {
      if((this.handleCtrlTab || this.showTabList) && event.keyCode == Ci.nsIDOMKeyEvent.DOM_VK_TAB && event.ctrlKey && !event.altKey && !event.metaKey) {
         var tabCount = this.tabs.length;
         if(!this.KeyLock) {
            if (this.handleCtrlTab) {
               this.TabIndex = tabCount - 1;
            } else {
               this.TabIndex = this.tabs.indexOf(gBrowser.mCurrentTab);
            }
            this.KeyLock = true;
         }

         if(this.TabListLock) {
            let tab = this.tabs[this.TabIndex];
            if (tab)
              tab.mCorrespondingMenuitem.setAttribute("_moz-menuactive", "false");
         }

         if((this.handleCtrlTab && event.shiftKey) || (!this.handleCtrlTab && !event.shiftKey)) {
            this.TabIndex++;
            if(this.TabIndex >= tabCount)
               this.TabIndex = 0;
         }
         else {
            this.TabIndex--;
            if(this.TabIndex < 0)
               this.TabIndex = tabCount - 1;
         }

         if(this.showTabList) {
            this.KeyboardNavigating = true;
            if(!this.TabListLock) {
               if(tabCount > 1) {
                 if (!this._timer) {
                   this._timer = setTimeout(function (self) {
                     self._timer = null;
                     self.DisplayTabList();
                   }, 200, this);
                 }
                 else
                   this.DisplayTabList();
               }
            }
            else {
               let item = this.tabs[this.TabIndex].mCorrespondingMenuitem;
               item.setAttribute("_moz-menuactive", "true");
               TabmixAllTabs.updateMenuItemActive(null, item);
            }
         }
         else
            TabmixAllTabs._tabSelectedFromList(this.tabs[this.TabIndex]);
         event.stopPropagation();
         event.preventDefault();
      }
      else {
         if(this.TabListLock)
            this.TabList.hidePopup();

         gBrowser.mTabBox.handleEvent(event);
      }
   },

   OnKeyUp : function _LastTab_OnKeyUp(event) {
      var keyReleased = event.keyCode == Ci.nsIDOMKeyEvent.DOM_VK_CONTROL;
      this.CtrlKey = event.ctrlKey && !event.altKey && !event.metaKey;
      if(!keyReleased)
        return;
      var tabToSelect;
      if(this._timer) {
        clearTimeout(this._timer);
        this._timer = null;
        tabToSelect = this.tabs[this.TabIndex];
        TabmixAllTabs._tabSelectedFromList(tabToSelect);
        this.PushSelectedTab();
      }
      if(this.TabListLock) {
         let tab = this.tabs[this.TabIndex];
         if(tab && tab.mCorrespondingMenuitem.getAttribute("_moz-menuactive") == "true") {
            tabToSelect = tab;
         }

         TabmixAllTabs.updateMenuItemInactive(null);
         TabmixAllTabs.backupLabel=="";

         this.TabList.hidePopup();
         if (tabToSelect)
           TabmixAllTabs._tabSelectedFromList(tabToSelect);
         this.PushSelectedTab();
      }
      if(this.KeyLock) {
         this.PushSelectedTab();
         this.TabIndex = 0;
         this.KeyLock = false;
      }
      this._tabs = null;
   },

   OnMenuCommand : function _LastTab_OnMenuCommand(event) {
      if(this.respondToMouseInTabList) {
         TabmixAllTabs._tabSelectedFromList(event.target.tab);
         this.PushSelectedTab();
      }
   },

   OnPopupHidden : function() {
      if(!this.SuppressTabListReset) {
         var tablist = this.TabList;

         while(tablist.childNodes.length > 0)
            tablist.removeChild(tablist.childNodes[0]);

         this.TabListLock = false;
         this.TabIndex = 0;
         this.KeyLock = false;

         TabmixAllTabs.hideCommonList(tablist);
      }
   },

   OnSelect: function() {
      // session manager can select new tab before TMP_LastTab is init
      if (!this._inited)
         return;

      var tabCount = this.TabHistory.length;
      if(tabCount != gBrowser.tabs.length) {
         if(tabCount > gBrowser.tabs.length) {
            if(gBrowser.tabs.length == 1) {
               this.KeyLock = false;
               this.TabIndex = 0;
            }
         }
         this.PushSelectedTab();
      }
      else if(!this.KeyLock) {
         if(this.CtrlKey)
            this.KeyLock = true; //allow other tab navigation methods to work
         else
            this.PushSelectedTab();
      }
   },

   PushSelectedTab: function TMP_LastTab_PushSelectedTab() {
      var selectedTab = gBrowser.tabContainer.selectedItem;
      this.detachTab(selectedTab);
      this.TabHistory.push(selectedTab);
   },

   ReadPreferences : function() {
      // when Build-in tabPreviews is on we disable our own function
      var mostRecentlyUsed = TabmixSvc.prefs.getBoolPref("browser.ctrlTab.previews");
      var tabPreviews = document.getElementById("ctrlTab-panel") && "ctrlTab" in window;
      if (tabPreviews) {
         var tabPreviewsCurentStatus = ctrlTab._recentlyUsedTabs ? true : false;
         tabPreviews = mostRecentlyUsed && TabmixSvc.TMPprefs.getBoolPref("lasttab.tabPreviews");
         if (tabPreviewsCurentStatus != tabPreviews) {
            if (tabPreviews) {
               ctrlTab.init();
               ctrlTab._recentlyUsedTabs = [];
               for (var i = 0; i < this.TabHistory.length; i++) {
                  ctrlTab._recentlyUsedTabs.unshift(this.TabHistory[i]);
               }
            }
            else
               ctrlTab.uninit();
         }
      }

      this.handleCtrlTab = !tabPreviews && mostRecentlyUsed;
      this.showTabList = !tabPreviews && TabmixSvc.TMPprefs.getBoolPref("lasttab.showTabList");
      ///XXX 2011-11-09 - we drop support for this.favorLeftToRightOrdering = false
      this.favorLeftToRightOrdering = true;
      this.respondToMouseInTabList = TabmixSvc.TMPprefs.getBoolPref("lasttab.respondToMouseInTabList");
   },

   inverseIndex : function(index) {
      return this.handleCtrlTab ? index : this.tabs.length - 1 - index;
   }

}
