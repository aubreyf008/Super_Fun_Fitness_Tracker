import { state, localDateKey } from '../state.js'
import { fmtDate } from '../ui.js'

const ACTIVITY_ICONS = {
  running: '🏃', walking: '🚶', cycling: '🚴', swimming: '🏊',
  hiit: '⚡', strength: '🏋️', elliptical: '🔄', other: '💪'
}

let currentYear, currentMonth, loggedDates

export async function init() {
  const today = new Date()
  currentYear  = today.getFullYear()
  currentMonth = today.getMonth()

  loggedDates = new Set(await window.api.store.getLoggedDates())

  renderCalendar()
  bindEvents()
}

function bindEvents() {
  document.getElementById('cal-prev').addEventListener('click', () => {
    currentMonth--
    if (currentMonth < 0) { currentMonth = 11; currentYear-- }
    renderCalendar()
  })
  document.getElementById('cal-next').addEventListener('click', () => {
    currentMonth++
    if (currentMonth > 11) { currentMonth = 0; currentYear++ }
    renderCalendar()
  })
  document.getElementById('detail-close').addEventListener('click', () => {
    document.getElementById('day-detail').style.display = 'none'
  })
}

function renderCalendar() {
  const label = new Date(currentYear, currentMonth, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  document.getElementById('cal-month-label').textContent = label

  const firstDay  = new Date(currentYear, currentMonth, 1).getDay()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const today = localDateKey()

  const grid = document.getElementById('cal-grid')
  grid.innerHTML = ''

  // empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    grid.appendChild(emptyCell())
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    grid.appendChild(dayCell(day, dateStr, today))
  }
}

function emptyCell() {
  const el = document.createElement('div')
  el.style.cssText = 'padding: 6px; min-height: 52px;'
  return el
}

function dayCell(day, dateStr, today) {
  const el = document.createElement('div')
  const isToday   = dateStr === today
  const isFuture  = dateStr > today
  const hasData   = loggedDates.has(dateStr)

  el.style.cssText = `
    padding: 6px; min-height: 52px; border-radius: 8px; cursor: ${isFuture ? 'default' : 'pointer'};
    border: 1px solid ${isToday ? 'var(--accent-green)' : 'transparent'};
    background: ${isToday ? 'var(--accent-green-dim)' : 'var(--bg-elevated)'};
    transition: background 150ms ease;
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    opacity: ${isFuture ? '0.3' : '1'};
  `

  el.innerHTML = `
    <div style="font-size:0.85rem; font-weight:${isToday ? '800' : '500'}; color:${isToday ? 'var(--accent-green)' : 'var(--text-primary)'};">${day}</div>
    <div id="dots-${dateStr}" style="display:flex; gap:3px; flex-wrap:wrap; justify-content:center;"></div>
  `

  if (!isFuture) {
    el.addEventListener('mouseenter', () => {
      if (!isToday) el.style.background = 'var(--bg-hover)'
    })
    el.addEventListener('mouseleave', () => {
      if (!isToday) el.style.background = 'var(--bg-elevated)'
    })
    el.addEventListener('click', () => loadDayDetail(dateStr))
  }

  // load dots asynchronously so the calendar renders fast
  if (hasData) loadDots(dateStr)

  return el
}

async function loadDots(dateStr) {
  const summary = await window.api.store.getDaySummary(dateStr)
  const dotsEl  = document.getElementById(`dots-${dateStr}`)
  if (!dotsEl) return

  const dots = []
  if (summary.meals.length > 0)      dots.push('var(--accent-green)')
  if (summary.activities.length > 0) dots.push('var(--accent-orange)')
  if (summary.weight)                dots.push('var(--accent-blue)')

  dotsEl.innerHTML = dots.map(color =>
    `<div style="width:6px;height:6px;border-radius:50%;background:${color};"></div>`
  ).join('')
}

async function loadDayDetail(dateStr) {
  const summary = await window.api.store.getDaySummary(dateStr)
  const profile  = state.profile

  const panel = document.getElementById('day-detail')
  panel.style.display = 'block'
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' })

  document.getElementById('detail-date-heading').textContent = fmtDate(dateStr) + ', ' + dateStr.split('-')[0]

  // compute totals
  const eaten   = summary.meals.reduce((s, m) => s + (m.calories || 0), 0)
  const protein  = summary.meals.reduce((s, m) => s + (m.protein  || 0), 0)
  const burned  = summary.activities.reduce((s, a) => s + (a.adjustedCalories || 0), 0)
  const net     = eaten - burned
  const target  = profile?.dailyCalTarget || 2300
  const deficit = target - net

  document.getElementById('detail-stats').innerHTML = `
    <div class="card" style="text-align:center; padding:14px;">
      <div style="font-size:1.4rem; font-weight:800; color:var(--accent-green);">${Math.round(eaten)}</div>
      <div class="card-title" style="margin-top:4px;">Eaten</div>
    </div>
    <div class="card" style="text-align:center; padding:14px;">
      <div style="font-size:1.4rem; font-weight:800; color:var(--accent-orange);">${Math.round(burned)}</div>
      <div class="card-title" style="margin-top:4px;">Burned</div>
    </div>
    <div class="card" style="text-align:center; padding:14px;">
      <div style="font-size:1.4rem; font-weight:800; color:${deficit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${Math.abs(Math.round(deficit))}</div>
      <div class="card-title" style="margin-top:4px;">${deficit >= 0 ? 'Deficit' : 'Surplus'}</div>
    </div>
    <div class="card" style="text-align:center; padding:14px;">
      <div style="font-size:1.4rem; font-weight:800; color:var(--accent-blue);">${summary.weight ? summary.weight + ' lbs' : '—'}</div>
      <div class="card-title" style="margin-top:4px;">Weight</div>
    </div>
  `

  // meals
  const mealsEl = document.getElementById('detail-meals')
  if (summary.meals.length === 0) {
    mealsEl.innerHTML = `<div class="empty-state" style="padding:20px;"><p>No meals logged</p></div>`
  } else {
    mealsEl.innerHTML = summary.meals.map(m => `
      <div class="meal-item">
        <div class="meal-info">
          <div class="meal-name">${escHtml(m.name || m.description)}</div>
          <div class="meal-macros">${Math.round(m.protein)}g P · ${Math.round(m.carbs)}g C · ${Math.round(m.fat)}g F</div>
        </div>
        <div class="meal-cal">${Math.round(m.calories)} kcal</div>
      </div>
    `).join('')
  }

  // activities
  const actEl = document.getElementById('detail-activities')
  if (summary.activities.length === 0) {
    actEl.innerHTML = `<div class="empty-state" style="padding:20px;"><p>No activities logged</p></div>`
  } else {
    actEl.innerHTML = summary.activities.map(a => {
      const icon = ACTIVITY_ICONS[a.type] || '💪'
      const duration = a.duration ? `${a.duration} ${a.durationUnit || 'min'}` : ''
      return `
        <div class="meal-item">
          <div style="font-size:1.3rem; margin-right:10px;">${icon}</div>
          <div class="meal-info">
            <div class="meal-name">${escHtml(a.name)}</div>
            <div class="meal-macros">${a.correctionLabel || a.type}${duration ? ' · ' + duration : ''}</div>
          </div>
          <div class="meal-cal" style="color:var(--accent-orange);">${a.adjustedCalories ? a.adjustedCalories + ' kcal' : '—'}</div>
        </div>
      `
    }).join('')
  }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
