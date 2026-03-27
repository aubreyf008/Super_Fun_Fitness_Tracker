const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  store: {
    getProfile: () => ipcRenderer.invoke('store:get-profile'),
    saveProfile: (profile) => ipcRenderer.invoke('store:save-profile', profile),
    getSettings: () => ipcRenderer.invoke('store:get-settings'),
    saveApiKey: (key) => ipcRenderer.invoke('store:save-api-key', { key }),
    getDailyLog: (date) => ipcRenderer.invoke('store:get-daily-log', { date }),
    addMeal: (date, meal) => ipcRenderer.invoke('store:add-meal', { date, meal }),
    deleteMeal: (date, mealId) => ipcRenderer.invoke('store:delete-meal', { date, mealId }),
    getWeightLog: () => ipcRenderer.invoke('store:get-weight-log'),
    addWeight: (date, weight) => ipcRenderer.invoke('store:add-weight', { date, weight }),
    getStreaks: () => ipcRenderer.invoke('store:get-streaks'),
    getActivityLog: (date) => ipcRenderer.invoke('store:get-activity-log', { date }),
    addActivity: (date, activity) => ipcRenderer.invoke('store:add-activity', { date, activity }),
    deleteActivity: (date, activityId) => ipcRenderer.invoke('store:delete-activity', { date, activityId }),
    getDaySummary: (date) => ipcRenderer.invoke('store:get-day-summary', { date }),
    getLoggedDates: () => ipcRenderer.invoke('store:get-logged-dates')
  },
  ai: {
    parseFood: (description) => ipcRenderer.invoke('ai:parse-food', { description }),
    suggestMeals: (remaining) => ipcRenderer.invoke('ai:suggest-meals', { remaining }),
    parseActivity: (description) => ipcRenderer.invoke('ai:parse-activity', { description }),
    testKey: (key) => ipcRenderer.invoke('ai:test-key', { key })
  },
  app: {
    getInitialState: () => ipcRenderer.invoke('app:get-initial-state')
  }
})
