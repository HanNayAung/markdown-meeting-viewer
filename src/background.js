// Clicking the toolbar button opens the viewer page in a new tab.
browser.browserAction.onClicked.addListener(() => {
  browser.tabs.create({ url: browser.runtime.getURL("viewer.html") });
});
