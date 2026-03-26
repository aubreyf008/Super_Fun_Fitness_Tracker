import { state } from '../state.js'
import { toast, macroPills } from '../ui.js'

let parsedResult = null

export async function init() {
  await renderTodayLog()
  bindEvents()
}

function bindEvents() {
  document.getElementById('parse-btn').addEventListener('click', parseFood)
  document.getElementById('cancel-btn').addEventListener('click', hideConfirm)
  document.getElementById('confirm-btn').addEventListener('click', confirmAdd)
  document.getElementById('edit-toggle').addEventListener('click', toggleEdit)

  document.getElementById('food-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) parseFood()
  })
}

async function parseFood() {
  const input = document.getElementById('food-input').value.trim()
  if (!input) { toast('Enter a meal description', 'error'); return }

  setLoading(true)
  hideConfirm()

  const result = await window.api.ai.parseFood(input)

  setLoading(false)

  if (result.error) {
    toast('AI error: ' + result.error, 'error')
    return
  }

  parsedResult = result
  showConfirm(result, input)
}

function setLoading(on) {
  document.getElementById('parse-btn').style.display = on ? 'none' : ''
  document.getElementById('parse-loading').style.display = on ? 'flex' : 'none'
}

function showConfirm(result, originalInput) {
  document.getElementById('confirm-box').style.display = 'block'
  document.getElementById('result-name').textContent   = result.name || originalInput
  document.getElementById('result-notes').textContent  = result.notes || ''

  const confEl = document.getElementById('result-confidence')
  const conf = result.confidence || 'medium'
  const confColors = { high: 'green', medium: 'orange', low: 'red' }
  confEl.innerHTML = `<span class="badge badge-${confColors[conf] || 'orange'}">${conf} confidence</span>`

  document.getElementById('result-pills').innerHTML = macroPills({
    calories: result.calories,
    protein:  result.protein,
    carbs:    result.carbs,
    fat:      result.fat
  })

  // populate edit fields
  document.getElementById('edit-name').value    = result.name || originalInput
  document.getElementById('edit-cal').value     = result.calories
  document.getElementById('edit-protein').value = result.protein
  document.getElementById('edit-carbs').value   = result.carbs
  document.getElementById('edit-fat').value     = result.fat
}

function hideConfirm() {
  document.getElementById('confirm-box').style.display = 'none'
  document.getElementById('edit-fields').style.display = 'none'
  parsedResult = null
}

function toggleEdit() {
  const fields = document.getElementById('edit-fields')
  fields.style.display = fields.style.display === 'none' ? 'block' : 'none'
}

async function confirmAdd() {
  if (!parsedResult) return

  // use edited values if edit fields are visible
  const editVisible = document.getElementById('edit-fields').style.display !== 'none'
  const meal = editVisible ? {
    name:        document.getElementById('edit-name').value.trim() || parsedResult.name,
    description: document.getElementById('food-input').value.trim(),
    calories:    parseFloat(document.getElementById('edit-cal').value)     || parsedResult.calories,
    protein:     parseFloat(document.getElementById('edit-protein').value) || parsedResult.protein,
    carbs:       parseFloat(document.getElementById('edit-carbs').value)   || parsedResult.carbs,
    fat:         parseFloat(document.getElementById('edit-fat').value)     || parsedResult.fat
  } : {
    name:        parsedResult.name,
    description: document.getElementById('food-input').value.trim(),
    calories:    parsedResult.calories,
    protein:     parsedResult.protein,
    carbs:       parsedResult.carbs,
    fat:         parsedResult.fat
  }

  const res = await window.api.store.addMeal(state.todayKey, meal)
  if (res.success) {
    state.todayMeals.push(res.meal)
    // update streak badge
    const streaks = await window.api.store.getStreaks()
    state.streaks = streaks
    const badge = document.getElementById('streak-count')
    if (badge) badge.textContent = streaks.current

    toast(`Added: ${meal.name}`, 'success')
    document.getElementById('food-input').value = ''
    hideConfirm()
    await renderTodayLog()
  } else {
    toast('Failed to save meal', 'error')
  }
}

async function renderTodayLog() {
  const meals = await window.api.store.getDailyLog(state.todayKey)
  state.todayMeals = meals
  const el = document.getElementById('log-meals-list')
  if (!el) return

  if (meals.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">&#x1F957;</div><p>Nothing logged yet today</p></div>`
    return
  }

  el.innerHTML = meals.map((m, i) => `
    <div class="meal-item" data-id="${m.id}">
      <div class="meal-info">
        <div class="meal-name">${escHtml(m.name || m.description)}</div>
        <div class="meal-macros">${Math.round(m.protein)}g P · ${Math.round(m.carbs)}g C · ${Math.round(m.fat)}g F</div>
      </div>
      <div class="meal-cal">${Math.round(m.calories)} kcal</div>
      <button class="btn-icon delete-meal-btn" title="Delete" data-idx="${i}">&#x1F5D1;&#xFE0F;</button>
    </div>
  `).join('')

  el.querySelectorAll('.delete-meal-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx  = parseInt(btn.dataset.idx)
      const meal = meals[idx]
      await window.api.store.deleteMeal(state.todayKey, meal.id)
      toast('Meal removed', 'info')
      await renderTodayLog()
    })
  })
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
