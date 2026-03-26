import { navigate } from './router.js'
import { state } from './state.js'

async function boot() {
  const initial = await window.api.app.getInitialState()
  state.todayKey  = initial.todayKey
  state.streaks   = initial.streaks

  // update streak badge
  document.getElementById('streak-count').textContent = initial.streaks.current

  if (!initial.onboardingComplete) {
    await showOnboarding()
  } else {
    state.profile = await window.api.store.getProfile()
    await navigate('dashboard')
  }

  // bind sidebar nav
  document.querySelectorAll('.nav-item[data-view]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.view))
  })
}

async function showOnboarding() {
  const slot = document.getElementById('view-slot')
  const res = await fetch('views/onboarding.html')
  slot.innerHTML = await res.text()

  // hide nav items during onboarding
  document.getElementById('nav').style.opacity = '0.3'
  document.getElementById('nav').style.pointerEvents = 'none'

  const { init } = await import('./views/onboarding.js')
  await init(async () => {
    // onboarding complete callback
    document.getElementById('nav').style.opacity = ''
    document.getElementById('nav').style.pointerEvents = ''
    state.profile = await window.api.store.getProfile()
    const streaks = await window.api.store.getStreaks()
    state.streaks = streaks
    document.getElementById('streak-count').textContent = streaks.current
    await navigate('dashboard')
  })
}

// expose for views that need to update streak badge
export function refreshStreakBadge(count) {
  const el = document.getElementById('streak-count')
  if (el) el.textContent = count
}

boot()
