import { state } from '../state.js'
import { toast } from '../ui.js'

const CORRECTION_FACTORS = {
  running:  { factor: 0.82, label: 'Running',          discount: '18% discount' },
  walking:  { factor: 0.88, label: 'Walking',          discount: '12% discount' },
  cycling:  { factor: 0.83, label: 'Cycling',          discount: '17% discount' },
  swimming: { factor: 0.85, label: 'Swimming',         discount: '15% discount' },
  hiit:     { factor: 0.75, label: 'HIIT / Circuits',  discount: '25% discount' },
  strength: { factor: 0.65, label: 'Strength Training', discount: '35% discount' },
  elliptical:{ factor: 0.80, label: 'Elliptical',      discount: '20% discount' },
  other:    { factor: 0.80, label: 'Other',            discount: '20% discount' }
}

const ACTIVITY_ICONS = {
  running: '🏃', walking: '🚶', cycling: '🚴', swimming: '🏊',
  hiit: '⚡', strength: '🏋️', elliptical: '🔄', other: '💪'
}

let parsedActivity = null

export async function init() {
  await renderActivityList()
  renderBurnStats(await window.api.store.getActivityLog(state.todayKey))
  bindEvents()
}

function bindEvents() {
  document.getElementById('parse-activity-btn').addEventListener('click', parseActivity)
  document.getElementById('activity-cancel-btn').addEventListener('click', hideConfirm)
  document.getElementById('activity-confirm-btn').addEventListener('click', confirmLog)
  document.getElementById('activity-edit-toggle').addEventListener('click', toggleEdit)

  document.getElementById('activity-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) parseActivity()
  })

  // live-update correction when type changes in edit mode
  document.getElementById('edit-activity-type').addEventListener('change', () => {
    const type = document.getElementById('edit-activity-type').value
    const watchCal = parseFloat(document.getElementById('edit-activity-watch-cal').value) || 0
    if (watchCal > 0) updateCorrectionDisplay(type, watchCal)
  })

  document.getElementById('edit-activity-watch-cal').addEventListener('input', () => {
    const type = document.getElementById('edit-activity-type').value
    const watchCal = parseFloat(document.getElementById('edit-activity-watch-cal').value) || 0
    if (watchCal > 0) updateCorrectionDisplay(type, watchCal)
  })
}

async function parseActivity() {
  const input = document.getElementById('activity-input').value.trim()
  if (!input) { toast('Describe your workout first', 'error'); return }

  setLoading(true)
  hideConfirm()

  const result = await window.api.ai.parseActivity(input)

  setLoading(false)

  if (result.error) {
    toast('AI error: ' + result.error, 'error')
    return
  }

  parsedActivity = result
  showConfirm(result)
}

function setLoading(on) {
  document.getElementById('parse-activity-btn').style.display = on ? 'none' : ''
  document.getElementById('activity-parse-loading').style.display = on ? 'flex' : 'none'
}

function showConfirm(result) {
  const box = document.getElementById('activity-confirm-box')
  box.style.display = 'block'

  document.getElementById('activity-result-name').textContent = result.name || 'Activity'
  document.getElementById('activity-result-notes').textContent = result.notes || ''

  // populate edit fields
  document.getElementById('edit-activity-name').value     = result.name || ''
  document.getElementById('edit-activity-type').value     = result.type || 'other'
  document.getElementById('edit-activity-duration').value = result.duration || ''
  document.getElementById('edit-activity-watch-cal').value= result.watchCalories || ''

  // summary pills
  const duration = result.duration ? `${result.duration} ${result.durationUnit || 'min'}` : '—'
  document.getElementById('activity-summary-pills').innerHTML = `
    <div class="macro-pill blue"><span class="pill-val">${ACTIVITY_ICONS[result.type] || '💪'}</span><span class="pill-label">${(CORRECTION_FACTORS[result.type] || CORRECTION_FACTORS.other).label}</span></div>
    <div class="macro-pill"><span class="pill-val">${duration}</span><span class="pill-label">duration</span></div>
  `

  // correction display
  if (result.watchCalories) {
    updateCorrectionDisplay(result.type || 'other', result.watchCalories)
    document.getElementById('correction-info').style.display = 'block'
  } else {
    document.getElementById('correction-info').style.display = 'none'
  }
}

function updateCorrectionDisplay(type, watchCal) {
  const cf = CORRECTION_FACTORS[type] || CORRECTION_FACTORS.other
  const adjusted = Math.round(watchCal * cf.factor)
  document.getElementById('correction-watch-cal').textContent = `${Math.round(watchCal)} kcal`
  document.getElementById('correction-adj-cal').textContent   = `${adjusted} kcal`
  document.getElementById('correction-type-badge').innerHTML  =
    `<span class="badge badge-orange">${cf.label}</span>`
  document.getElementById('correction-factor-label').textContent = cf.discount
}

function hideConfirm() {
  document.getElementById('activity-confirm-box').style.display = 'none'
  document.getElementById('activity-edit-fields').style.display = 'none'
  parsedActivity = null
}

function toggleEdit() {
  const fields = document.getElementById('activity-edit-fields')
  fields.style.display = fields.style.display === 'none' ? 'block' : 'none'
}

async function confirmLog() {
  if (!parsedActivity) return

  const editVisible = document.getElementById('activity-edit-fields').style.display !== 'none'

  const type        = editVisible ? document.getElementById('edit-activity-type').value     : (parsedActivity.type || 'other')
  const name        = editVisible ? document.getElementById('edit-activity-name').value.trim(): parsedActivity.name
  const duration    = editVisible ? parseFloat(document.getElementById('edit-activity-duration').value) : parsedActivity.duration
  const watchCal    = editVisible ? parseFloat(document.getElementById('edit-activity-watch-cal').value) : parsedActivity.watchCalories

  const cf = CORRECTION_FACTORS[type] || CORRECTION_FACTORS.other
  const adjustedCalories = watchCal ? Math.round(watchCal * cf.factor) : null

  const activity = {
    name,
    description: document.getElementById('activity-input').value.trim(),
    type,
    duration:         duration || null,
    durationUnit:     parsedActivity.durationUnit || 'min',
    watchCalories:    watchCal || null,
    adjustedCalories,
    correctionFactor: cf.factor,
    correctionLabel:  cf.label
  }

  const res = await window.api.store.addActivity(state.todayKey, activity)
  if (res.success) {
    toast(`Logged: ${name}`, 'success')
    document.getElementById('activity-input').value = ''
    hideConfirm()
    await renderActivityList()
    renderBurnStats(await window.api.store.getActivityLog(state.todayKey))
  } else {
    toast('Failed to log activity', 'error')
  }
}

async function renderActivityList() {
  const activities = await window.api.store.getActivityLog(state.todayKey)
  const el = document.getElementById('activity-list')
  if (!el) return

  if (activities.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🏃</div><p>No activities logged today. Describe your workout above!</p></div>`
    return
  }

  el.innerHTML = activities.map((a, i) => {
    const icon = ACTIVITY_ICONS[a.type] || '💪'
    const cf   = CORRECTION_FACTORS[a.type] || CORRECTION_FACTORS.other
    const duration = a.duration ? `${a.duration} ${a.durationUnit || 'min'}` : ''
    const calDisplay = a.adjustedCalories
      ? `${a.adjustedCalories} kcal <span style="color:var(--text-muted); font-size:0.75rem;">(${a.watchCalories} raw)</span>`
      : '— kcal'

    return `
      <div class="meal-item" data-id="${a.id}">
        <div style="font-size: 1.4rem; margin-right: 12px;">${icon}</div>
        <div class="meal-info">
          <div class="meal-name">${escHtml(a.name)}</div>
          <div class="meal-macros">
            ${cf.label}${duration ? ' · ' + duration : ''}
            ${a.correctionFactor ? ` · ${Math.round((1 - a.correctionFactor) * 100)}% Watch correction` : ''}
          </div>
        </div>
        <div class="meal-cal" style="color: var(--accent-orange);">${calDisplay}</div>
        <button class="btn-icon delete-activity-btn" title="Delete" data-idx="${i}">&#x1F5D1;&#xFE0F;</button>
      </div>
    `
  }).join('')

  el.querySelectorAll('.delete-activity-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.idx)
      await window.api.store.deleteActivity(state.todayKey, activities[idx].id)
      toast('Activity removed', 'info')
      await renderActivityList()
      renderBurnStats(await window.api.store.getActivityLog(state.todayKey))
    })
  })
}

function renderBurnStats(activities) {
  const watchTotal = activities.reduce((s, a) => s + (a.watchCalories || 0), 0)
  const adjTotal   = activities.reduce((s, a) => s + (a.adjustedCalories || 0), 0)
  const saved      = watchTotal - adjTotal

  const watchEl = document.getElementById('stat-watch-total')
  const adjEl   = document.getElementById('stat-adj-total')
  const savedEl = document.getElementById('stat-saved')
  if (watchEl) watchEl.textContent = Math.round(watchTotal)
  if (adjEl)   adjEl.textContent   = Math.round(adjTotal)
  if (savedEl) savedEl.textContent = Math.round(saved)
}

// also export so dashboard can use the same logic
export function computeTodayBurn(activities) {
  return activities.reduce((s, a) => s + (a.adjustedCalories || 0), 0)
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
