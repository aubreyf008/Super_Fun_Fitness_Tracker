import { state, computeTotals, computeRemaining } from '../state.js'
import { macroPills, toast } from '../ui.js'

export async function init() {
  const meals   = await window.api.store.getDailyLog(state.todayKey)
  const totals  = computeTotals(meals)
  const remaining = computeRemaining(state.profile, totals)

  document.getElementById('remaining-pills').innerHTML = macroPills(remaining)
  document.getElementById('suggest-btn').addEventListener('click', () => getSuggestions(remaining))
}

async function getSuggestions(remaining) {
  setLoading(true)

  const result = await window.api.ai.suggestMeals(remaining)

  setLoading(false)

  if (result.error) {
    toast('AI error: ' + result.error, 'error')
    return
  }

  renderSuggestions(result.suggestions || [])
}

function setLoading(on) {
  document.getElementById('suggest-btn').style.display = on ? 'none' : ''
  document.getElementById('suggest-loading').style.display = on ? 'flex' : 'none'
}

function renderSuggestions(suggestions) {
  const container = document.getElementById('suggestions-results')
  const list = document.getElementById('suggestions-list')
  if (!list) return

  container.style.display = 'block'

  list.innerHTML = suggestions.map((s, i) => `
    <div class="suggestion-card">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
        <div>
          <div style="font-size: 1.05rem; font-weight: 700; margin-bottom: 4px;">${escHtml(s.name)}</div>
          <div style="color: var(--text-secondary); font-size: 0.85rem;">${escHtml(s.description)}</div>
        </div>
        <div style="text-align: right; flex-shrink: 0;">
          <div style="font-size: 1.3rem; font-weight: 800; color: var(--accent-green);">${Math.round(s.calories)}</div>
          <div style="font-size: 0.7rem; color: var(--text-muted);">kcal</div>
        </div>
      </div>
      ${macroPills({ calories: s.calories, protein: s.protein, carbs: s.carbs, fat: s.fat })}
      <button class="btn btn-secondary btn-sm log-suggestion-btn" style="margin-top: 12px;" data-idx="${i}">
        + Log This Meal
      </button>
    </div>
  `).join('')

  list.querySelectorAll('.log-suggestion-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.idx)
      const s = suggestions[idx]
      btn.disabled = true
      btn.textContent = 'Logging...'

      const meal = {
        name:        s.name,
        description: s.description,
        calories:    s.calories,
        protein:     s.protein,
        carbs:       s.carbs,
        fat:         s.fat
      }

      const res = await window.api.store.addMeal(state.todayKey, meal)
      if (res.success) {
        state.todayMeals.push(res.meal)
        const streaks = await window.api.store.getStreaks()
        state.streaks = streaks
        const badge = document.getElementById('streak-count')
        if (badge) badge.textContent = streaks.current

        btn.textContent = '✓ Logged!'
        btn.classList.add('btn-primary')
        btn.classList.remove('btn-secondary')
        toast(`Logged: ${s.name}`, 'success')
      } else {
        btn.disabled = false
        btn.textContent = '+ Log This Meal'
        toast('Failed to log meal', 'error')
      }
    })
  })
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
