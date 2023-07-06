


//--------Listeners----------------------------------------

var isInUse = false // run listeners once, avoids listeners from running at the same time
function withAppData(func) {
  return async (...args) => {
    if (!isInUse) {
      isInUse = true
      const appData = await getAppData();
      await func(appData, ...args);
      await saveAppData(appData);
      isInUse = false
    }
  }
}


chrome.tabs.onActivated.addListener(withAppData(async (appData, info) => {
  await onTabChanged(appData, info.tabId, info.windowId)
}));
chrome.tabs.onRemoved.addListener(withAppData(async (appData, tabId, info) => {
  await onTabRemoved(appData, tabId, info.windowId)
}));
chrome.tabs.onMoved.addListener(withAppData(async (appData, tabId, info) => {
  await onTabMoved(appData, tabId, info.windowId)
}));
// chrome.windows.onFocusChanged.addListener(withAppData(async (appData, windowId) => { await onWindowChanged(appData, windowId) }));


chrome.commands.onCommand.addListener(debounce(90, withAppData(async (appData, command) => {
  switch (command) {
    case "cycle-back":
      await onTabCommandAction(appData, 1) // Right
      break;
    case "cycle-forward":
      await onTabCommandAction(appData, -1) // Left
      break;
    default:
  }
})));




//--------Storage Functions----------------------------------------

async function getAppData() {
  var appData = {}
  let result = await chrome.storage.local.get(['map', 'positions', 'changedWithHotKey', 'lastWindowId']);

  appData.map = result.map ? new Map(JSON.parse(result.map)) : new Map()
  appData.positions = result.positions ? new Map(JSON.parse(result.positions)) : new Map()
  appData.changedWithHotKey = result.changedWithHotKey || false;
  appData.lastWindowId = result.lastWindowId || -1

  // console.log("load", appData)

  return appData
}

async function saveAppData(appData) {
  await chrome.storage.local.set({
    map: JSON.stringify(Array.from(appData.map.entries())),
    positions: JSON.stringify(Array.from(appData.positions.entries())),
    changedWithHotKey: appData.changedWithHotKey,
    lastWindowId: appData.lastWindowId
  });

  // console.log("Save")
}

async function getCurrent() {
  let queryOptions = { active: true, currentWindow: true };
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab ? tab : { id: -1, windowId: -1 };
}









//------OnTab Listener Functions------------------------------------------------

async function onTabChanged(appData, tabId, windowId) {
  // console.log("onTabChanged 1")

  mapAdd(appData, windowId, tabId) // add new tab to top of stack
  setPosition(appData, windowId, 0)

  appData.lastWindowId = windowId

  // console.log("onTabChanged 2")
}

async function onTabRemoved(appData, _tabId, _windowId) {
  // console.log("onTabRemoved 1 --")

  prune(appData, _windowId, _tabId)

  var { id, windowId } = await getCurrent()
  onTabChanged(appData, id, windowId)

  // console.log("onTabRemoved 2 --")
}

async function onTabMoved(appData, tabId, windowId) {
  // console.log("onTabMoved")

  pruneAll(appData, tabId)
  onTabChanged(appData, tabId, windowId)

  // await saveAppData(appData)
}

async function onTabCommandAction(appData, direction) {
  // console.log("goToTabDirection 1 ")

  var { id, windowId } = await getCurrent()


  if (appData.map.has(windowId) && appData.map.get(windowId).length > 0) {
    newPosition = getNextPosition(appData, windowId, direction)
    setPosition(appData, windowId, newPosition)
    goToTabId = appData.map.get(windowId)[newPosition]


    if (goToTabId == null) {//check for null if so continue
      prune(appData, windowId, goToTabId)
      onTabCommandAction(appData, direction)
    }
    else if (id !== goToTabId) {
      try {
        await chrome.tabs.update(goToTabId, { active: true })
      } catch (error) { //if tab does not exist prune and go to the next one
        console.log("here")
        prune(appData, windowId, goToTabId)
        onTabCommandAction(appData, direction)
      }
    }
    else if (id === goToTabId && appData.map.get(windowId).length > 1) {
      onTabCommandAction(appData, direction)
    }
  }


  // console.log("goToTabDirection 2")
}


async function onWindowChanged(appData, wId) {
  // console.log("onWindowChanged 1")

  // var { id, windowId } = await getCurrent()
  // appData.lastWindowId = windowId

  // console.log("onWindowChanged 2")
}








//----------Position Functions-------------------------------------------


function getPosition(appData, windowId) {
  if (appData.positions.has(windowId) && Number.isInteger(appData.positions.get(windowId))) {
    return appData.positions.get(windowId)
  }
  else
    return 0
}

function setPosition(appData, windowId, value) {
  return appData.positions.set(windowId, value)
}

function getNextPosition(appData, windowId, distance) {
  var tabArray = appData.map.get(windowId)
  var currentPosition = getPosition(appData, windowId)

  var newPosition = currentPosition + distance
  if (newPosition >= tabArray.length)
    newPosition = 0
  else if (newPosition < 0)
    newPosition = tabArray.length == 0 ? 0 : tabArray.length - 1

  return newPosition
}






//----------Map Functions-----------------------------------------------


function mapHasTab(appData, windowId, tabId) {
  return appData.map.has(windowId) && appData.map.get(windowId).includes(tabId)
}

function mapAdd(appData, windowId, tabId) {
  var position = getPosition(appData, windowId)
  var tabArr = appData.map.get(windowId)

  init(appData, windowId)
  if (tabId && tabArr) {
    if (position > 0)
      tabArr.push(...tabArr.splice(0, position)) // rotate around position so position is at index 0 [1,2,3,4] to [3,4,1,2] if position was 2

    prune(appData, windowId, tabId)
    tabArr.unshift(tabId)
  }
}

function prune(appData, windowId, tabId) {
  var tabArray = appData.map.get(windowId)

  if (tabArray) {
    const index = tabArray.indexOf(tabId)
    if (index > -1) {
      tabArray.splice(index, 1);
    }
  }
  return tabArray
}

function pruneAll(appData, tabId) {
  for (let [key, arr] of appData.map) {
    prune(appData, key, tabId)
    if (arr.length <= 0)
      appData.map.delete(key)
  }
}

function init(appData, windowId) {
  if (!appData.map.has(windowId))
    appData.map.set(windowId, [])
}






//----------Util Functions-----------------------------------------------


function debounce(wait, func) { // Used to prevent skipping on double mouse click (cheap mouse)
  let time = Date.now();
  return async (...args) => {
    if (Math.abs(Date.now() - time) > wait) {
      await func(...args);
      time = Date.now()
    }
  };
}