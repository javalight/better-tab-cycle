
//--------Listeners----------------------------------------


chrome.tabs.onActivated.addListener((info) => onTabChanged(info.tabId, info.windowId));
chrome.tabs.onRemoved.addListener((tabId, info) => onTabRemoved(tabId, info.windowId));
chrome.tabs.onMoved.addListener((tabId, info) => onTabMoved(tabId, info.windowId));
chrome.windows.onFocusChanged.addListener((windowId) => onWindowChanged(windowId));
// chrome.runtime.onSuspend.addListener(saveStorage);
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







//--------Feilds----------------------------------------

var map = new Map()
var positions = new Map()
var changedWithHotKey = false
var lastWindowId = -1







//--------Storage Functions----------------------------------------

async function loadStorage() {
  let result = await chrome.storage.local.get(['map']);
  if (result.map) {
    map = new Map(JSON.parse(result.map))
    console.log("load", map)
  }
}

async function saveStorage() {
  let result = await chrome.storage.local.set({ map: JSON.stringify(Array.from(map.entries())) });
  console.log("Save", map)
}

async function getCurrent() {
  let queryOptions = { active: true, currentWindow: true };
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab ? tab : { id: -1, windowId: -1 };
}








//------OnTab Listener Functions------------------------------------------------


async function onTabChanged(tabId, windowId) {
  if (changedWithHotKey) { // when back or forward hotkeys are pressed
    console.log("changedWithHotKey")
  }
  else { // When new tab is clicked on
    if (lastWindowId == windowId)
      await mapAddPositionTopOfStack(windowId, getPosition(windowId)) // add last tab to top of stack

    await mapAdd(tabId, windowId) // add new tab to top of stack
    setPosition(windowId, 0)
  }

  changedWithHotKey = false
  lastWindowId = windowId
}

async function onTabMoved(tabId, windowId) {
  await pruneAll(map, tabId)
  onTabChanged(tabId, windowId)

}

async function onTabRemoved(tabId, windowId) {
  await prune(map.get(windowId), tabId)

}

async function onWindowChanged(wId) {
  var { id, windowId } = await getCurrent()
  lastWindowId = windowId
}







//----------Position Functions-------------------------------------------


function getPosition(windowId) {
  return positions.has(windowId) ? positions.get(windowId) : 0
}

function setPosition(windowId, value) {
  return positions.set(windowId, value)
}







//----------Map Functions-----------------------------------------------


function mapHas(tabId, windowId) {
  return map.has(windowId) && map.get(windowId).includes(tabId)
}

async function mapAdd(tabId, windowId) {
  initUnsaved(windowId)
  pruneUnsaved(map.get(windowId), tabId)
  if (tabId) {
    map.get(windowId).unshift(tabId)
  }
  await saveStorage()
}

async function mapAddPositionTopOfStack(windowId, position) {
  if (map.has(windowId) && map.get(windowId).length >= position) {
    await mapAdd(map.get(windowId)[position], windowId)
  }
}

function pruneUnsaved(arr, tabId) {
  if (arr) {
    const index = arr.indexOf(tabId)
    if (index > -1) {
      arr.splice(index, 1);
    }
  }
  return arr
}
async function prune(arr, tabId) {
  pruneUnsaved(arr, tabId)
  await saveStorage()
  return arr
}

async function pruneAll(_map, tabId) {
  for (let [key, arr] of _map) {
    await prune(arr, tabId)
    if (arr.length <= 0)
      _map.delete(key)
  }

  await saveStorage()
}

async function init(windowId) {
  initUnsaved(windowId)
  await saveStorage()
}
function initUnsaved(windowId) {
  if (!map.has(windowId))
    map.set(windowId, [])
}






//----------- Tab Functions ------------------------------------------------


async function goToTabDirection(direction) {
  // if (!map)
  await loadStorage()

  var { id, windowId } = await getCurrent()

  if (map.has(windowId)) {
    console.log("here", windowId)

    setPosition(windowId, getTabIndexDirection(map.get(windowId), getPosition(windowId), direction))
    goToTabId = map.get(windowId)[getPosition(windowId)]

    if (id !== goToTabId)
      _goToTab(goToTabId, windowId, direction)
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
    await prune(map.get(windowId), tabId)
    goToTabDirection(direction)
  }
  try {
    await chrome.tabs.update(tabId, { active: true })
    changedWithHotKey = true
  } catch (error) { //if tab does not exist prune and go to the next one
    await prune(map.get(windowId), tabId)
    goToTabDirection(direction)
  }
}

