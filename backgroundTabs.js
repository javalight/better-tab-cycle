
//--------Listeners----------------------------------------


chrome.tabs.onActivated.addListener((info) => onTabChanged(info.tabId, info.windowId));
chrome.tabs.onRemoved.addListener((tabId, info) => onTabRemoved(tabId, info.windowId));
chrome.tabs.onMoved.addListener((tabId, info) => onTabMoved(tabId, info.windowId));
chrome.windows.onFocusChanged.addListener((windowId) => onWindowChanged(windowId));

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
  let result = await chrome.storage.local.get(['map', 'positions']);
  if (result.map) {
    var _map = new Map(JSON.parse(result.map))
    if (_map.size > 0) {
      map = _map
    }
  }

  if (result.positions)
    positions = new Map(JSON.parse(result.positions))

  console.log("load", map)
}

async function saveStorage() {
  if (map.size > 0)
    await chrome.storage.local.set({
      map: JSON.stringify(Array.from(map.entries())),
      positions: JSON.stringify(Array.from(positions.entries()))
    });

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
  console.log(map)
  if (map.size == 0)
    await loadStorage()

  var { id, windowId } = await getCurrent()

  if (map.has(windowId) && map.get(windowId).length > 0) {
    setPosition(windowId, getTabIndexDirection(map.get(windowId), getPosition(windowId), direction))
    goToTabId = map.get(windowId)[getPosition(windowId)]

    if (id !== goToTabId) {
      // console.log("here1")
      _goToTab(goToTabId, windowId, direction)
    }
    else if (map.get(windowId).length > 1) {
      // console.log("here2")
      goToTabDirection(direction)
    }
  }
}

function getTabIndexDirection(arr, lastIndex, distance) {
  var index = lastIndex + distance
  if (index >= arr.length)
    index = 0
  else if (index < 0)
    index = arr.length == 0 ? 0 : arr.length - 1

  return index
}

async function _goToTab(tabId, windowId, direction) {
  if (tabId == null) {//check for null if so continue
    // console.log("Null", tabId)
    await prune(windowId, tabId)
    goToTabDirection(direction)
  }
  else
    try {

      // console.log("Attempt", tabId)
      await chrome.tabs.update(tabId, { active: true })
      changedWithHotKey = true
    } catch (error) { //if tab does not exist prune and go to the next one

      // console.log("Fail")
      await prune(map.get(windowId), tabId)
      goToTabDirection(direction)
    }
}

