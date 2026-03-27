import { state, localDateKey } from '../state.js'
import { toast } from '../ui.js'
import { initChartDefaults } from '../chart-init.js'

const ENERGY_COLORS = {
  1: 'var(--accent-red)', 2: 'var(--accent-orange)', 3: 'var(--accent-yellow)',
  4: 'var(--accent-blue)', 5: 'var(--accent-green)'
}
const MOOD_COLORS = { ...ENERGY_COLORS }

let selectedEnergy = 3
let selectedMood   = 3
let chartInstance  = null

export async function init() {
  initChartDefaults()
  selectRating('energy', 3)
  selectRating('mood', 3)
  bindEvents()

  const existing = await window.api.store.getMood(state.todayKey)
  if (existing) {
    selectRating('energy', existing.energy)
    selectRating('mood', existing.mood)
    document.getElementById('mood-note').value = existing.note || ''
    renderTodayDisplay(existing)
  }

  await renderInsight()
  await renderChart()
}

function bindEvents() {
  document.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', () => selectRating(btn.dataset.type, parseInt(btn.dataset.val)))
  })
  document.getElementById('mood-save-btn').addEventListener('click', saveCheckin)
}

function selectRating(type, val) {
  if (type === 'energy') selectedEnergy = val
  else selectedMood = val

  document.querySelectorAll(`.rating-btn[data-type="${type}"]`).forEach(btn => {
    const active = parseInt(btn.dataset.val) === val
    const color  = type === 'energy' ? ENERGY_COLORS[val] : MOOD_COLORS[val]
    btn.style.background  = active ? 'var(--bg-hover)' : ''
    btn.style.borderColor = active ? color : ''
    btn.style.color       = active ? color : ''
  })
}

async function saveCheckin() {
  const entry = {
    energy:  selectedEnergy,
    mood:    selectedMood,
    note:    document.getElementById('mood-note').value.trim(),
    savedAt: new Date().toISOString()
  }
  await window.api.store.saveMood(state.todayKey, entry)
  renderTodayDisplay(entry)
  await renderInsight()
  await renderChart()
  toast('Check-in saved!', 'success')
}

function renderTodayDisplay(entry) {
  const el = document.getElementById('mood-today-display')
  if (!el) return

  const eColor = ENERGY_COLORS[entry.energy]
  const mColor = MOOD_COLORS[entry.mood]
  const energyEmojis = { 1:'😵', 2:'😓', 3:'😐', 4:'😊', 5:'⚡' }
  const moodEmojis   = { 1:'😤', 2:'😞', 3:'😶', 4:'😄', 5:'🔥' }
  const energyLabels = { 1:'Drained', 2:'Low', 3:'Neutral', 4:'Good', 5:'Charged' }
  const moodLabels   = { 1:'Rough', 2:'Meh', 3:'Okay', 4:'Good', 5:'Killing it' }

  el.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
      <div class="card" style="padding:16px; text-align:center; border-color:${eColor};">
        <div style="font-size:2rem;">${energyEmojis[entry.energy]}</div>
        <div style="font-size:1rem; font-weight:700; color:${eColor}; margin-top:4px;">${energyLabels[entry.energy]}</div>
        <div style="font-size:0.7rem; color:var(--text-muted);">Energy</div>
      </div>
      <div class="card" style="padding:16px; text-align:center; border-color:${mColor};">
        <div style="font-size:2rem;">${moodEmojis[entry.mood]}</div>
        <div style="font-size:1rem; font-weight:700; color:${mColor}; margin-top:4px;">${moodLabels[entry.mood]}</div>
        <div style="font-size:0.7rem; color:var(--text-muted);">Mood</div>
      </div>
    </div>
    ${entry.note ? `<div style="font-size:0.82rem; color:var(--text-secondary); font-style:italic; padding:8px; background:var(--bg-elevated); border-radius:var(--radius);">"${escHtml(entry.note)}"</div>` : ''}
  `
}

async function renderInsight() {
  const sleep  = await window.api.store.getSleep(state.todayKey)
  const mood   = await window.api.store.getMood(state.todayKey)
  const card   = document.getElementById('mood-insight-card')
  const content = document.getElementById('mood-insight-content')
  if (!card || !content) return

  if (!sleep && !mood) { card.style.display = 'none'; return }
  card.style.display = 'block'

  const rows = []
  if (sleep) {
    const sleepColor = sleep.hours >= 7 ? 'var(--accent-green)' : 'var(--accent-orange)'
    rows.push(`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:1.2rem;">🌙</span>
      <span style="flex:1;">Last night's sleep</span>
      <span style="font-weight:700;color:${sleepColor};">${sleep.hours.toFixed(1)}h</span>
    </div>`)
  }
  if (mood) {
    rows.push(`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:1.2rem;">⚡</span>
      <span style="flex:1;">Energy today</span>
      <span style="font-weight:700;color:${ENERGY_COLORS[mood.energy]};">${mood.energy}/5</span>
    </div>`)
    rows.push(`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;">
      <span style="font-size:1.2rem;">😊</span>
      <span style="flex:1;">Mood today</span>
      <span style="font-weight:700;color:${MOOD_COLORS[mood.mood]};">${mood.mood}/5</span>
    </div>`)
  }

  // correlation note
  if (sleep && mood) {
    const sleepGood  = sleep.hours >= 7
    const energyGood = mood.energy >= 4
    let note = ''
    if (sleepGood && energyGood)   note = '✅ Good sleep → good energy. Keep it up!'
    if (sleepGood && !energyGood)  note = '🤔 Good sleep but low energy — check your nutrition or stress.'
    if (!sleepGood && !energyGood) note = '⚠️ Low sleep + low energy. Prioritize rest tonight.'
    if (!sleepGood && energyGood)  note = '💪 Low sleep but energy is holding. Push through!'
    if (note) rows.push(`<div style="margin-top:10px;padding:10px;background:var(--bg-elevated);border-radius:var(--radius);font-size:0.82rem;color:var(--text-secondary);">${note}</div>`)
  }

  content.innerHTML = rows.join('')
}

async function renderChart() {
  const canvas = document.getElementById('mood-chart')
  if (!canvas) return
  if (chartInstance) { chartInstance.destroy(); chartInstance = null }

  const labels = [], energyData = [], moodData = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key   = localDateKey(d)
    const entry = await window.api.store.getMood(key)
    labels.push(key.slice(5))
    energyData.push(entry ? entry.energy : null)
    moodData.push(entry ? entry.mood : null)
  }

  chartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Energy',
          data: energyData,
          borderColor: '#68d391',
          backgroundColor: 'rgba(104,211,145,0.1)',
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#68d391',
          spanGaps: true
        },
        {
          label: 'Mood',
          data: moodData,
          borderColor: '#63b3ed',
          backgroundColor: 'rgba(99,179,237,0.1)',
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#63b3ed',
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0, max: 6,
          grid: { color: 'rgba(45,55,72,0.5)' },
          ticks: { stepSize: 1, callback: v => v > 0 && v < 6 ? v : '' }
        },
        x: { grid: { display: false } }
      },
      plugins: {
        legend: { display: true, labels: { color: '#a0aec0', boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}/5` } }
      }
    }
  })
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
