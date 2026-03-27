import { state, computeTotals } from '../state.js'
import { createRing, toast } from '../ui.js'
import { navigate } from '../router.js'

export async function init() {
  const profile    = state.profile
  const meals      = await window.api.store.getDailyLog(state.todayKey)
  const activities = await window.api.store.getActivityLog(state.todayKey)
  const waterOz    = await window.api.store.getWater(state.todayKey)
  state.todayMeals = meals

  renderDate()
  renderRings(profile, meals)
  renderMealsList(meals)
  renderHealthTargets(profile, meals, waterOz)
  renderBurnSection(meals, activities)
  renderStats(profile, meals)

  document.getElementById('dash-log-btn').addEventListener('click', () => navigate('log-food'))
  document.getElementById('dash-water-card').addEventListener('click', () => navigate('water'))
}

function renderDate() {
  const el = document.getElementById('dash-date')
  if (el) {
    const d = new Date()
    el.textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }
}

function renderRings(profile, meals) {
  const totals = computeTotals(meals)
  const container = document.getElementById('macro-rings')
  if (!container) return

  container.innerHTML = [
    createRing({ id: 'cal',     size: 120, strokeWidth: 10, color: 'var(--accent-green)',  value: totals.calories, max: profile.dailyCalTarget || 2300, label: 'Calories',  unit: 'kcal' }),
    createRing({ id: 'protein', size: 120, strokeWidth: 10, color: 'var(--accent-blue)',   value: totals.protein,  max: profile.proteinTarget  || 190,  label: 'Protein',   unit: 'g' }),
    createRing({ id: 'carbs',   size: 120, strokeWidth: 10, color: 'var(--accent-orange)', value: totals.carbs,    max: profile.carbTarget     || 215,  label: 'Carbs',     unit: 'g' }),
    createRing({ id: 'fat',     size: 120, strokeWidth: 10, color: 'var(--accent-yellow)', value: totals.fat,      max: profile.fatTarget      || 68,   label: 'Fat',       unit: 'g' })
  ].join('')
}

function renderMealsList(meals) {
  const el = document.getElementById('meals-list')
  if (!el) return

  if (meals.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">&#x1F957;</div>
        <p>No meals logged today. Hit "Log Food" to get started!</p>
      </div>`
    return
  }

  el.innerHTML = meals.map(m => `
    <div class="meal-item" data-id="${m.id}">
      <div class="meal-info">
        <div class="meal-name">${escHtml(m.name || m.description)}</div>
        <div class="meal-macros">${Math.round(m.protein)}g protein · ${Math.round(m.carbs)}g carbs · ${Math.round(m.fat)}g fat</div>
      </div>
      <div class="meal-cal">${Math.round(m.calories)} kcal</div>
      <button class="btn-icon delete-meal-btn" title="Delete meal">&#x1F5D1;&#xFE0F;</button>
    </div>
  `).join('')

  el.querySelectorAll('.delete-meal-btn').forEach((btn, i) => {
    btn.addEventListener('click', async () => {
      const meal = meals[i]
      await window.api.store.deleteMeal(state.todayKey, meal.id)
      state.todayMeals.splice(i, 1)
      meals.splice(i, 1)
      renderMealsList(meals)
      renderRings(state.profile, meals)
      renderBurnSection(meals, await window.api.store.getActivityLog(state.todayKey))
      renderStats(state.profile, meals)
      toast('Meal removed', 'info')
    })
  })
}

function renderHealthTargets(profile, meals, waterOz) {
  const fiberGoal  = profile.fiberTarget  || 35
  const sodiumGoal = profile.sodiumTarget || 2300

  const totalFiber  = meals.reduce((s, m) => s + (m.fiber  || 0), 0)
  const totalSodium = meals.reduce((s, m) => s + (m.sodium || 0), 0)

  const fiberEl   = document.getElementById('dash-fiber')
  const sodiumEl  = document.getElementById('dash-sodium')
  const waterEl   = document.getElementById('dash-water')
  const fiberBar  = document.getElementById('dash-fiber-bar')
  const sodiumBar = document.getElementById('dash-sodium-bar')
  const waterBar  = document.getElementById('dash-water-bar')

  if (!fiberEl) return

  document.getElementById('dash-fiber-goal').textContent  = fiberGoal
  document.getElementById('dash-sodium-goal').textContent = sodiumGoal

  fiberEl.textContent  = Math.round(totalFiber)
  sodiumEl.textContent = Math.round(totalSodium)
  waterEl.textContent  = Math.round(waterOz)

  const sodiumPct = Math.min(100, (totalSodium / sodiumGoal) * 100)
  sodiumEl.style.color = sodiumPct > 90 ? 'var(--accent-red)' : sodiumPct > 70 ? 'var(--accent-orange)' : 'var(--accent-green)'

  if (fiberBar)  fiberBar.style.width  = Math.min(100, (totalFiber / fiberGoal) * 100) + '%'
  if (sodiumBar) sodiumBar.style.width = sodiumPct + '%'
  if (waterBar)  waterBar.style.width  = Math.min(100, (waterOz / 128) * 100) + '%'
}

function renderBurnSection(meals, activities) {
  const totals  = computeTotals(meals)
  const eaten   = totals.calories
  const burned  = activities.reduce((s, a) => s + (a.adjustedCalories || 0), 0)
  const net     = Math.round(eaten - burned)
  const target  = state.profile?.dailyCalTarget || 2300

  // deficit = how far below target the net intake is (positive = deficit, negative = surplus)
  const deficit = target - net

  const eatenEl   = document.getElementById('dash-eaten')
  const burnedEl  = document.getElementById('dash-burned')
  const netEl     = document.getElementById('dash-net')
  const deficitEl = document.getElementById('dash-deficit')
  const defSubEl  = document.getElementById('dash-deficit-sub')
  const warnEl    = document.getElementById('dash-deficit-warning')

  if (!eatenEl) return

  eatenEl.textContent  = Math.round(eaten)
  burnedEl.textContent = Math.round(burned)

  // net color: green if under target, red if over
  netEl.textContent  = net
  netEl.style.color  = net <= target ? 'var(--accent-green)' : 'var(--accent-red)'

  if (burned > 0) {
    deficitEl.textContent   = Math.abs(deficit)
    deficitEl.style.color   = deficit > 0 ? 'var(--accent-green)' : 'var(--accent-red)'
    defSubEl.textContent    = deficit > 0 ? 'below target ✓' : 'above target'
    defSubEl.style.color    = deficit > 0 ? 'var(--accent-green)' : 'var(--accent-red)'
  } else {
    deficitEl.textContent  = '—'
    deficitEl.style.color  = 'var(--text-muted)'
    defSubEl.textContent   = 'Log activity to see'
    defSubEl.style.color   = 'var(--text-muted)'
  }

  // aggressive deficit warning
  if (warnEl) warnEl.style.display = (burned > 0 && net < 1500) ? 'block' : 'none'
}

function renderStats(profile, meals) {
  const totals      = computeTotals(meals)
  const calLeft     = Math.max(0, (profile.dailyCalTarget || 2300) - totals.calories)
  const proteinLeft = Math.max(0, (profile.proteinTarget  || 190)  - totals.protein)

  const streaks = state.streaks
  document.getElementById('stat-streak-val').textContent  = streaks.current
  document.getElementById('stat-streak-sub').textContent  = streaks.longest > 0 ? `Best: ${streaks.longest} days` : ''
  document.getElementById('stat-cal-val').textContent     = Math.round(calLeft)
  document.getElementById('stat-cal-sub').textContent     = `${Math.round(totals.calories)} consumed`
  document.getElementById('stat-protein-val').textContent = Math.round(proteinLeft)
  document.getElementById('stat-protein-sub').textContent = `${Math.round(totals.protein)}g consumed`
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
