const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

let Store
let store
let mainWindow

async function initStore() {
  const { default: ElectronStore } = await import('electron-store')
  Store = ElectronStore
  store = new Store({
    defaults: {
      userProfile: null,
      settings: { anthropicApiKey: '', units: 'imperial' },
      dailyLogs: {},
      weightLog: [],
      streaks: { current: 0, longest: 0, lastLoggedDate: null }
    }
  })
}

function getTodayKey() {
  return new Date().toISOString().split('T')[0]
}

function getYesterdayKey() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

function decayStreakIfNeeded() {
  const streaks = store.get('streaks')
  const today = getTodayKey()
  const yesterday = getYesterdayKey()
  if (
    streaks.lastLoggedDate &&
    streaks.lastLoggedDate !== today &&
    streaks.lastLoggedDate !== yesterday
  ) {
    store.set('streaks.current', 0)
  }
}

function registerStoreHandlers() {
  ipcMain.handle('store:get-profile', () => store.get('userProfile'))

  ipcMain.handle('store:save-profile', (_, profile) => {
    store.set('userProfile', { ...profile, onboardingComplete: true })
    return { success: true }
  })

  ipcMain.handle('store:get-settings', () => store.get('settings'))

  ipcMain.handle('store:save-api-key', (_, { key }) => {
    store.set('settings.anthropicApiKey', key)
    return { success: true }
  })

  ipcMain.handle('store:get-daily-log', (_, { date }) => {
    const logs = store.get('dailyLogs')
    return logs[date] ? logs[date].meals : []
  })

  ipcMain.handle('store:add-meal', (_, { date, meal }) => {
    const logs = store.get('dailyLogs')
    if (!logs[date]) logs[date] = { meals: [] }
    const newMeal = {
      ...meal,
      id: require('crypto').randomUUID(),
      loggedAt: new Date().toISOString()
    }
    logs[date].meals.push(newMeal)
    store.set('dailyLogs', logs)

    // update streak
    const streaks = store.get('streaks')
    const today = getTodayKey()
    const yesterday = getYesterdayKey()
    if (date === today) {
      if (streaks.lastLoggedDate === yesterday) {
        const newCurrent = streaks.current + 1
        const newLongest = Math.max(newCurrent, streaks.longest)
        store.set('streaks', { current: newCurrent, longest: newLongest, lastLoggedDate: today })
      } else if (streaks.lastLoggedDate !== today) {
        const newCurrent = 1
        const newLongest = Math.max(newCurrent, streaks.longest)
        store.set('streaks', { current: newCurrent, longest: newLongest, lastLoggedDate: today })
      }
    }

    return { success: true, meal: newMeal }
  })

  ipcMain.handle('store:delete-meal', (_, { date, mealId }) => {
    const logs = store.get('dailyLogs')
    if (logs[date]) {
      logs[date].meals = logs[date].meals.filter(m => m.id !== mealId)
      store.set('dailyLogs', logs)
    }
    return { success: true }
  })

  ipcMain.handle('store:get-weight-log', () => store.get('weightLog'))

  ipcMain.handle('store:add-weight', (_, { date, weight }) => {
    const log = store.get('weightLog')
    const existing = log.findIndex(e => e.date === date)
    if (existing >= 0) {
      log[existing].weight = weight
    } else {
      log.push({ date, weight })
      log.sort((a, b) => a.date.localeCompare(b.date))
    }
    store.set('weightLog', log)
    return { success: true }
  })

  ipcMain.handle('store:get-streaks', () => store.get('streaks'))

  ipcMain.handle('app:get-initial-state', () => {
    const profile = store.get('userProfile')
    return {
      onboardingComplete: profile ? profile.onboardingComplete === true : false,
      todayKey: getTodayKey(),
      streaks: store.get('streaks')
    }
  })
}

function registerAIHandlers() {
  const FOOD_PARSE_SYSTEM = `You are a precise nutrition data parser. When given a meal description, return ONLY valid JSON with no explanation, markdown, or code blocks. If uncertain, provide reasonable estimates for a typical portion. Never refuse food logging requests.`

  const FOOD_PARSE_USER = (description) =>
    `Parse the nutrition for this meal and return JSON in exactly this format (numeric values only, no units in values):
{"name":"friendly meal name","calories":450,"protein":35,"carbs":40,"fat":12,"confidence":"high","notes":"any assumptions"}

Meal: ${description}`

  const SUGGEST_SYSTEM = `You are a sports nutrition coach helping an athlete hit precise macro targets. Suggest realistic, whole-food meals. Return ONLY valid JSON with no explanation, markdown, or code blocks.`

  const SUGGEST_USER = (remaining) =>
    `I have these macros remaining today:
Calories: ${remaining.calories}, Protein: ${remaining.protein}g, Carbs: ${remaining.carbs}g, Fat: ${remaining.fat}g

Suggest 3 meals or snacks. Return JSON in exactly this format:
{"suggestions":[{"name":"Meal name","description":"Brief description with portion","calories":300,"protein":25,"carbs":30,"fat":8}]}

Keep suggestions practical and high-protein. User is cutting to ~12% body fat.`

  ipcMain.handle('ai:parse-food', async (_, { description }) => {
    const apiKey = store.get('settings.anthropicApiKey')
    if (!apiKey) return { error: 'No API key configured' }

    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      const client = new Anthropic({ apiKey })

      const tryParse = async (userContent) => {
        const msg = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: FOOD_PARSE_SYSTEM,
          messages: [{ role: 'user', content: userContent }]
        })
        const text = msg.content[0].text.trim()
        // strip markdown code blocks if present
        const cleaned = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
        return JSON.parse(cleaned)
      }

      try {
        return await tryParse(FOOD_PARSE_USER(description))
      } catch {
        return await tryParse(FOOD_PARSE_USER(description) + '\n\nIMPORTANT: Return raw JSON only, no markdown.')
      }
    } catch (err) {
      return { error: err.message }
    }
  })

  ipcMain.handle('ai:suggest-meals', async (_, { remaining }) => {
    const apiKey = store.get('settings.anthropicApiKey')
    if (!apiKey) return { error: 'No API key configured' }

    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      const client = new Anthropic({ apiKey })

      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: SUGGEST_SYSTEM,
        messages: [{ role: 'user', content: SUGGEST_USER(remaining) }]
      })
      const text = msg.content[0].text.trim()
      const cleaned = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
      return JSON.parse(cleaned)
    } catch (err) {
      return { error: err.message }
    }
  })

  ipcMain.handle('ai:test-key', async (_, { key }) => {
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      const client = new Anthropic({ apiKey: key })
      await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Say "ok"' }]
      })
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f1117',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
}

app.whenReady().then(async () => {
  await initStore()
  decayStreakIfNeeded()
  registerStoreHandlers()
  registerAIHandlers()
  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
