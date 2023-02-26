


//--------Listeners----------------------------------------


chrome.tabs.onActivated.addListener((info) => onTabChanged(info.tabId, info.windowId));
chrome.tabs.onRemoved.addListener((tabId, info) => onTabRemoved(tabId, info.windowId));
chrome.tabs.onMoved.addListener((tabId, info) => onTabMoved(tabId, info.windowId));
chrome.windows.onFocusChanged.addListener((windowId) => onWindowChanged(windowId));

chrome.commands.onCommand.addListener(async (command) => {
  switch (command) {
    case "cycle-back":
      await goToTabDirection(1)
      break;
    case "cycle-forward":
      await goToTabDirection(-1)
      break;
    default:
    // ---
  }
});







//--------Feilds----------------------------------------

// var map = new Map()
// var positions = new Map()
// var changedWithHotKey = false
// var lastWindowId = -1







//--------Storage Functions----------------------------------------

async function getAppData() {
  var appData = {}
  let result = await chrome.storage.local.get(['map', 'positions', 'changedWithHotKey', 'lastWindowId']);

  if (result.map)
    appData.map = new Map(JSON.parse(result.map))
  else
    appData.map = new Map()

  if (result.positions)
    appData.positions = new Map(JSON.parse(result.positions))
  else
    appData.positions = new Map()

  if (result.changedWithHotKey == null)
    appData.changedWithHotKey = false
  else
    appData.changedWithHotKey = result.changedWithHotKey

  if (result.lastWindowId == null)
    appData.lastWindowId = -1
  else
    appData.lastWindowId = result.lastWindowId


  // console.log("load", appData)

  return appData
}

async function saveAppData(appData) {
  // if (map.size > 0)
  await chrome.storage.local.set({
    map: JSON.stringify(Array.from(appData.map.entries())),
    positions: JSON.stringify(Array.from(appData.positions.entries())),
    changedWithHotKey: appData.changedWithHotKey,
    lastWindowId: appData.lastWindowId
  });

  // console.log("Save", appData)
}

async function getCurrent() {
  let queryOptions = { active: true, currentWindow: true };
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab ? tab : { id: -1, windowId: -1 };
}






//------OnTab Listener Functions------------------------------------------------


async function onTabChanged(tabId, windowId) {

  console.log("onTabChanged 1")
  var appData = await getAppData()

  if (appData.changedWithHotKey) { // when back or forward hotkeys are pressed
    console.log("here")
  }
  else { // When new tab is clicked on
    mapAddPositionTopOfStack(appData, windowId, getPosition(appData, windowId)) // add last tab to top of stack
    mapAdd(appData, tabId, windowId) // add new tab to top of stack
    setPosition(appData, windowId, 0)
  }

  appData.changedWithHotKey = false
  appData.lastWindowId = windowId


  await saveAppData(appData)

  console.log("onTabChanged 2")
}

async function onWindowChanged(wId) {
  // console.log("onWindowChanged 1")

  // var appData = await getAppData()

  // var { id, windowId } = await getCurrent()
  // appData.lastWindowId = windowId

  // await saveAppData(appData)
  // console.log("onWindowChanged 2")

}

async function onTabMoved(tabId, windowId) {
  // console.log("onTabMoved")

  var appData = await getAppData()

  pruneAll(appData.map, tabId)
  await saveAppData(appData)

  onTabChanged(tabId, windowId)
}

async function onTabRemoved(tabId, windowId) {
  // console.log("onTabRemoved")

  var appData = await getAppData()

  prune(appData.map.get(windowId), tabId)
  await saveAppData(appData)
}








//----------Position Functions-------------------------------------------


function getPosition(appData, windowId) {
  return appData.positions.has(windowId) ? appData.positions.get(windowId) : 0
}

function setPosition(appData, windowId, value) {
  return appData.positions.set(windowId, value)
}







//----------Map Functions-----------------------------------------------


function mapHas(appData, tabId, windowId) {
  return appData.map.has(windowId) && appData.map.get(windowId).includes(tabId)
}

function mapAdd(appData, tabId, windowId) {
  initUnsaved(appData, windowId)
  pruneUnsaved(appData.map.get(windowId), tabId)
  if (tabId) {
    appData.map.get(windowId).unshift(tabId)
  }
}

function mapAddPositionTopOfStack(appData, windowId, position) {
  if (appData.map.has(windowId) && appData.map.get(windowId).length >= position) {
    mapAdd(appData, appData.map.get(windowId)[position], windowId)
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
function prune(arr, tabId) {
  pruneUnsaved(arr, tabId)
  return arr
}

function pruneAll(_map, tabId) {
  for (let [key, arr] of _map) {
    prune(arr, tabId)
    if (arr.length <= 0)
      _map.delete(key)
  }
}

function init(appData, windowId) {
  initUnsaved(appData, windowId)
}
function initUnsaved(appData, windowId) {
  if (!appData.map.has(windowId))
    appData.map.set(windowId, [])
}






//----------- Tab Functions ------------------------------------------------


async function goToTabDirection(direction) {
  // console.log("goToTabDirection")
  var appData = await getAppData()


  var { id, windowId } = await getCurrent()


  if (appData.map.has(windowId) && appData.map.get(windowId).length > 0) {
    setPosition(appData, windowId, getTabIndexDirection(appData.map.get(windowId), getPosition(appData, windowId), direction))
    goToTabId = appData.map.get(windowId)[getPosition(appData, windowId)]

    if (id !== goToTabId) {
      // console.log("here1")
      _goToTab(appData, goToTabId, windowId, direction)
    }
    else if (appData.map.get(windowId).length > 1) {
      // console.log("here2")
      goToTabDirection(direction)
    }
  }

  await saveAppData(appData)
  // console.log("goToTabDirection")
}

function getTabIndexDirection(arr, lastIndex, distance) {
  var index = lastIndex + distance
  if (index >= arr.length)
    index = 0
  else if (index < 0)
    index = arr.length == 0 ? 0 : arr.length - 1

  return index
}

async function _goToTab(appData, tabId, windowId, direction) {
  if (tabId == null) {//check for null if so continue
    // console.log("Null", tabId)
    await prune(windowId, tabId)
    goToTabDirection(direction)
  }
  else
    try {

      // console.log("Attempt", tabId)
      appData.changedWithHotKey = true
      await saveAppData(appData)
      await chrome.tabs.update(tabId, { active: true })
    } catch (error) { //if tab does not exist prune and go to the next one

      // console.log("Fail")
      await prune(appData.map.get(windowId), tabId)
      goToTabDirection(direction)
    }
}

