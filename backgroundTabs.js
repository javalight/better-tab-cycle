chrome.tabs.onActivated.addListener((info) => onTabChanged(info.tabId, info.windowId));
chrome.tabs.onRemoved.addListener((tabId, info) => onTabRemoved(tabId, info.windowId));
chrome.tabs.onMoved.addListener((tabId, info) => onTabMoved(tabId, info.windowId));
chrome.windows.onFocusChanged.addListener((windowId) => onWindowChanged(windowId));
chrome.runtime.onSuspend.addListener(saveStorage);

var map = new Map()
var position = 0
var time = 0
var resetIntervalSeconds = 1.0

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
  if (position == 0 || !mapHas(tabId, windowId))
    mapAdd(tabId, windowId)
  saveStorage()
}

async function onTabMoved(tabId, windowId) {
  pruneAll(map, tabId)
  onTabChanged(tabId, windowId)
}

async function onTabRemoved(tabId, windowId) {
  prune(map.get(windowId), tabId)
}

async function onWindowChanged(lastWindowId) {
  var { id, windowId } = await getCurrent()
  mapAdd(id, windowId)
  if (lastWindowId != windowId)
    position = 0
}

function mapHas(tabId, windowId) {
  return map.has(windowId) && map.get(windowId).includes(tabId)
}

function mapAdd(tabId, windowId) {
  init(windowId)
  prune(map.get(windowId), tabId)
  map.get(windowId).unshift(tabId)
}

async function _goToTab(tabId, windowId, direction) {
  if (tabId && tabId > 0) {
    try {
      await chrome.tabs.update(tabId, { active: true })
    } catch (error) { //if tab does not exist prune and to to the next one
      prune(map.get(windowId), tabId)
      goToTabDirection(direction)
    }
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
    if(arr.length <= 0)
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
    position = getTabIndexDirection(map.get(windowId), position, direction)
    tabId = map.get(windowId)[position]
    _goToTab(tabId, windowId, direction)
    resetIfIdel()
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

async function resetIfIdel() {
  time = resetIntervalSeconds * 10.0
}

setInterval(async () => {
  if (position != 0 && time <= 0) {
    position = 0
    var { id, windowId } = await getCurrent()
    mapAdd(id, windowId)
  }
  else if (time > 0)
    time -= 1
}, 100)

chrome.commands.onCommand.addListener((command) => {
  switch (command) {
    case "cycle-back":
      goToTabDirection(1)
      break;
    case "cycle-forward":
      goToTabDirection(-1)
      break;
    default:
    // ---
  }
});