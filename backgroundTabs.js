


//--------Listeners----------------------------------------

var isInUse = false // run listeners once
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

chrome.commands.onCommand.addListener(withAppData(async (appData, command) => {
  switch (command) {
    case "cycle-back":
      await onTabCommandAction(appData, 1) // Right
      break;
    case "cycle-forward":
      await onTabCommandAction(appData, -1) // Left
      break;
    default:
    // ---
  }
}));




//--------Storage Functions----------------------------------------

async function getAppData() {
  var appData = {}
  let result = await chrome.storage.local.get(['map', 'positions', 'changedWithHotKey', 'lastWindowId']);

  appData.map = result.map ? new Map(JSON.parse(result.map)) : new Map()
  appData.positions = result.positions ? new Map(JSON.parse(result.positions)) : new Map()
  appData.changedWithHotKey = result.changedWithHotKey || false;
  appData.lastWindowId = result.lastWindowId || -1

  console.log("load")

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

  console.log("Save")
}

async function getCurrent() {
  let queryOptions = { active: true, currentWindow: true };
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab ? tab : { id: -1, windowId: -1 };
}









//------OnTab Listener Functions------------------------------------------------

async function onTabChanged(appData, tabId, windowId) {
  console.log("onTabChanged 1")

  if (appData.changedWithHotKey) { // when back or forward hotkeys are pressed
    // console.log("here")
  }
  else { // When new tab is clicked on
    // if (appData.lastWindowId !== windowId)
    mapAddPositionTopOfStack(appData, windowId, getPosition(appData, windowId)) // add last tab to top of stack
    mapAdd(appData, tabId, windowId) // add new tab to top of stack
    setPosition(appData, windowId, 0)
  }

  appData.changedWithHotKey = false
  appData.lastWindowId = windowId

  console.log("onTabChanged 2")
}

async function onTabRemoved(appData, tabId, windowId) {
  console.log("onTabRemoved 1 --")

  prune(appData, windowId, tabId)
  // newPosition = getNextPosition(appData, windowId, 1)
  setPosition(appData, windowId, 0)
  // await saveAppData(appData)

  console.log("onTabRemoved 2 --")

}

async function onTabMoved(appData, tabId, windowId) {
  // console.log("onTabMoved")

  pruneAll(appData, tabId)
  onTabChanged(appData, tabId, windowId)
  // await saveAppData(appData)
}

async function onTabCommandAction(appData, direction) {
  console.log("goToTabDirection 1 ")

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
        // console.log("Attempt", tabId)
        appData.changedWithHotKey = true
        // await saveAppData(appData)
        await chrome.tabs.update(goToTabId, { active: true })

        appData.changedWithHotKey = false
        appData.lastWindowId = windowId
      } catch (error) { //if tab does not exist prune and go to the next one

        // console.log("Fail")
        prune(appData, windowId, goToTabId)
        onTabCommandAction(appData, direction)
      }
    }
    else if (id === goToTabId && appData.map.get(windowId).length > 1) {
      onTabCommandAction(appData, direction)
    }
  }


  console.log("goToTabDirection 2")
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


function mapHas(appData, tabId, windowId) {
  return appData.map.has(windowId) && appData.map.get(windowId).includes(tabId)
}

function mapAdd(appData, tabId, windowId) {
  init(appData, windowId)
  prune(appData, windowId, tabId)
  if (tabId) {
    appData.map.get(windowId).unshift(tabId)
  }
}

function mapAddPositionTopOfStack(appData, windowId, position) {
  if (appData.map.has(windowId) && appData.map.get(windowId).length >= position) {
    mapAdd(appData, appData.map.get(windowId)[position], windowId)
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





