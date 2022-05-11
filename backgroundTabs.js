chrome.tabs.onActivated.addListener((info) => onTabChanged(info.tabId, info.windowId));
chrome.tabs.onRemoved.addListener((tabId, info) => prune(tabStack[info.windowId], tabId));
chrome.windows.onFocusChanged.addListener((windowId) => onWindowChanged(windowId));

var tabStack = []
var tabIndex = 0
var time = 0
var resetInterval = 10

async function getCurrent() {
  let queryOptions = { active: true, currentWindow: true };
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

async function onTabChanged(tabId, windowId) {
  if (tabIndex == 0)
    addStack(tabId, windowId)
}

async function onWindowChanged(lastWindowId) {
  var t = await getCurrent()
  if (t) {
    addStack(t.id, t.windowId)
    if (lastWindowId != t.windowId)
      tabIndex = 0
  }
}

function addStack(tabId, windowId) {
  init(tabStack, windowId)
  prune(tabStack[windowId], tabId)
  tabStack[windowId].unshift(tabId)
}

function init(stack, windowId) {
  if (!stack[windowId])
    stack[windowId] = []
}

async function goToTabDirection(direction) {
  var t = await getCurrent()
  if (t) {
    init(tabStack, t.windowId)
    tabIndex = getTabIndexDirection(tabStack[t.windowId], tabIndex, direction)
    tabId = tabStack[t.windowId][tabIndex]
    chrome.tabs.update(tabId, { active: true })
    resetIfIdel()
  }
}

function getTabIndexDirection(stack, lastIndex, distance) {
  var index = lastIndex + distance
  if (index >= stack.length)
    index = 0
  else if (index < 0)
    index = stack.length - 1

  return index
}

async function resetIfIdel() {
  time = resetInterval
}

setInterval(() => {
  if (tabIndex != 0 && time == 0) {
    tabIndex = 0
    getCurrent().then((t) => {
      if (t)
        addStack(t.id, t.windowId)
    })
  }
  else if (time > 0)
    time -= 1
}, 100)

function prune(stack, value) {
  if (stack) {
    const index = stack.indexOf(value)
    if (index > -1) {
      stack.splice(index, 1);
    }
  }

  return stack
}

chrome.commands.onCommand.addListener((command) => {
  if (command == "cycle-back") {
    goToTabDirection(1)
  }
  if (command == "cycle-forward") {
    goToTabDirection(-1)
  }
});