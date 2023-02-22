chrome.tabs.onActivated.addListener((info) => onTabChanged(info.tabId, info.windowId));
chrome.tabs.onRemoved.addListener((tabId, info) => onTabRemoved(tabId, info.windowId));
chrome.tabs.onMoved.addListener((tabId, info) => onTabMoved(tabId, info.windowId));
chrome.windows.onFocusChanged.addListener((windowId) => onWindowChanged(windowId));
chrome.runtime.onSuspend.addListener(saveStorage);

var map = new Map()
var positions = new Map()
var changedWithHotKey = false
var lastWindowId = -1

loadStorage()

function loadStorage() {
  chrome.storage.local.get(['map'], function (result) {
    if (result.map)
      map = new Map(JSON.parse(result.map))
  });
}

function saveStorage() {
  chrome.storage.local.set({ map: JSON.stringify(Array.from(map.entries())) });
}

async function getCurrent() {
  let queryOptions = { active: true, currentWindow: true };
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab ? tab : { id: -1, windowId: -1 };
}

async function onTabChanged(tabId, windowId) {
  if (changedWithHotKey) { // when back or forward hotkeys are pressed

  }
  else { // When new tab is clicked on
    if (lastWindowId == windowId)
      mapAddPositionTopOfStack(windowId, getPosition(windowId)) // add last tab to top of stack

    mapAdd(tabId, windowId) // add new tab to top of stack
    setPosition(windowId, 0)
  }

  saveStorage()
  changedWithHotKey = false
  lastWindowId = windowId
}

function getPosition(windowId) {
  return positions.has(windowId) ? positions.get(windowId) : 0
}

function setPosition(windowId, value) {
  return positions.set(windowId, value)
}

async function onTabMoved(tabId, windowId) {
  pruneAll(map, tabId)
  onTabChanged(tabId, windowId)
}

async function onTabRemoved(tabId, windowId) {
  prune(map.get(windowId), tabId)
}

async function onWindowChanged(wId) {
  var { id, windowId } = await getCurrent()
  lastWindowId = windowId
}

function mapHas(tabId, windowId) {
  return map.has(windowId) && map.get(windowId).includes(tabId)
}

function mapAdd(tabId, windowId) {
  init(windowId)
  prune(map.get(windowId), tabId)
  if (tabId)
    map.get(windowId).unshift(tabId)
}

function mapAddPositionTopOfStack(windowId, position) {
  if (map.has(windowId) && map.get(windowId).length >= position) {
    mapAdd(map.get(windowId)[position], windowId)
  }
}

function prune(arr, tabId) {
  if (arr) {
    const index = arr.indexOf(tabId)
    if (index > -1) {
      arr.splice(index, 1);
    }
  }
  return arr
}

function pruneAll(_map, tabId) {
  for (let [key, arr] of _map) {
    prune(arr, tabId)
    if (arr.length <= 0)
      _map.delete(key)
  }
}

function init(windowId) {
  if (!map.has(windowId))
    map.set(windowId, [])
}

async function goToTabDirection(direction) {
  var { windowId } = await getCurrent()
  if (map.has(windowId)) {
    setPosition(windowId, getTabIndexDirection(map.get(windowId), getPosition(windowId), direction))
    tabId = map.get(windowId)[getPosition(windowId)]
    _goToTab(tabId, windowId, direction)
    // resetIfIdel()
  }
}

function getTabIndexDirection(arr, lastIndex, distance) {
  var index = lastIndex + distance
  if (index >= arr.length)
    index = 0
  else if (index < 0)
    index = arr.length - 1
  return index
}

async function _goToTab(tabId, windowId, direction) {
  if (!tabId) {//check for null if so continue
    prune(map.get(windowId), tabId)
    goToTabDirection(direction)
  }
  try {
    await chrome.tabs.update(tabId, { active: true })
  } catch (error) { //if tab does not exist prune and go to the next one
    prune(map.get(windowId), tabId)
    goToTabDirection(direction)
  }
}

chrome.commands.onCommand.addListener((command) => {
  switch (command) {
    case "cycle-back":
      changedWithHotKey = true
      goToTabDirection(1)
      break;
    case "cycle-forward":
      changedWithHotKey = true
      goToTabDirection(-1)
      break;
    default:
    // ---
  }
});