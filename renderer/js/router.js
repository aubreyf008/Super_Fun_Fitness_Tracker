const viewModules = {
  'dashboard':     () => import('./views/dashboard.js'),
  'log-food':      () => import('./views/log-food.js'),
  'suggestions':   () => import('./views/suggestions.js'),
  'weight-tracker':() => import('./views/weight-tracker.js'),
  'body-fat':      () => import('./views/body-fat.js'),
  'goal-timeline': () => import('./views/goal-timeline.js'),
  'activity':      () => import('./views/activity.js'),
  'history':       () => import('./views/history.js')
}

let currentView = null

export async function navigate(viewName) {
  const slot = document.getElementById('view-slot')
  if (!slot) return

  // load HTML fragment
  const res = await fetch(`views/${viewName}.html`)
  if (!res.ok) {
    slot.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>View not found: ${viewName}</p></div>`
    return
  }
  slot.innerHTML = await res.text()

  // update active nav item
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === viewName)
  })

  currentView = viewName

  // dynamically import and init the view module
  const loader = viewModules[viewName]
  if (loader) {
    const mod = await loader()
    if (typeof mod.init === 'function') await mod.init()
  }
}

export function getCurrentView() { return currentView }
