import { state, localDateKey } from '../state.js'
import { toast, fmt } from '../ui.js'
import { initChartDefaults } from '../chart-init.js'

const QUALITY_LABELS = { 1: 'Terrible 😴', 2: 'Poor 😕', 3: 'OK 😐', 4: 'Good 😊', 5: 'Great ⚡' }
const QUALITY_COLORS = { 1: 'var(--accent-red)', 2: 'var(--accent-orange)', 3: 'var(--accent-yellow)', 4: 'var(--accent-blue)', 5: 'var(--accent-green)' }

let selectedQuality = 4
let chartInstance = null

export async function init() {
  initChartDefaults()
  selectQuality(4)
  bindEvents()

  const existing = await window.api.store.getSleep(state.todayKey)
  if (existing) renderTodayDisplay(existing)

  await renderChart()
}

function bindEvents() {
  document.querySelectorAll('.quality-btn').forEach(btn => {
    btn.addEventListener('click', () => selectQuality(parseInt(btn.dataset.val)))
  })

  document.getElementById('sleep-save-btn').addEventListener('click', saveSleep)

  // auto-calculate duration when times change
  document.getElementById('sleep-bedtime').addEventListener('change', updateDurationPreview)
  document.getElementById('sleep-waketime').addEventListener('change', updateDurationPreview)
}

function selectQuality(val) {
  selectedQuality = val
  document.querySelectorAll('.quality-btn').forEach(btn => {
    const active = parseInt(btn.dataset.val) === val
    btn.style.background      = active ? 'var(--bg-hover)' : ''
    btn.style.borderColor     = active ? QUALITY_COLORS[val] : ''
    btn.style.color           = active ? QUALITY_COLORS[val] : ''
  })
}

function updateDurationPreview() {
  const hrs = calcHours()
  if (hrs !== null) {
    const h = Math.floor(hrs)
    const m = Math.round((hrs - h) * 60)
    document.getElementById('sleep-save-btn').textContent = `Save Sleep (${h}h ${m}m)`
  } else {
    document.getElementById('sleep-save-btn').textContent = 'Save Sleep'
  }
}

function calcHours() {
  const bed  = document.getElementById('sleep-bedtime').value
  const wake = document.getElementById('sleep-waketime').value
  if (!bed || !wake) return null
  const [bH, bM] = bed.split(':').map(Number)
  const [wH, wM] = wake.split(':').map(Number)
  let mins = (wH * 60 + wM) - (bH * 60 + bM)
  if (mins <= 0) mins += 24 * 60  // crossed midnight
  return mins / 60
}

async function saveSleep() {
  const hours = calcHours()
  if (!hours || hours < 0.5 || hours > 24) {
    toast('Enter valid bedtime and wake time', 'error')
    return
  }

  const entry = {
    bedtime:  document.getElementById('sleep-bedtime').value,
    waketime: document.getElementById('sleep-waketime').value,
    hours:    parseFloat(hours.toFixed(2)),
    quality:  selectedQuality,
    notes:    document.getElementById('sleep-notes').value.trim(),
    savedAt:  new Date().toISOString()
  }

  await window.api.store.saveSleep(state.todayKey, entry)
  renderTodayDisplay(entry)
  await renderChart()
  toast(`Sleep logged: ${fmt(hours, 1)}h`, 'success')
}

function renderTodayDisplay(entry) {
  const el = document.getElementById('sleep-today-display')
  if (!el) return

  const h = Math.floor(entry.hours)
  const m = Math.round((entry.hours - h) * 60)
  const qualColor = QUALITY_COLORS[entry.quality] || 'var(--accent-blue)'
  const optimal = entry.hours >= 7 && entry.hours <= 9

  el.innerHTML = `
    <div style="text-align:center; margin-bottom: 20px;">
      <div style="font-size:3.5rem; font-weight:900; color:${qualColor}; line-height:1;">${h}<span style="font-size:1.5rem;">h</span> ${m}<span style="font-size:1.5rem;">m</span></div>
      <div style="margin-top:8px;">
        <span class="badge" style="background:transparent; border:1px solid ${qualColor}; color:${qualColor};">${QUALITY_LABELS[entry.quality]}</span>
        ${optimal
          ? '<span class="badge badge-green" style="margin-left:6px;">Optimal range ✓</span>'
          : entry.hours < 7
            ? '<span class="badge badge-orange" style="margin-left:6px;">Below 7h target</span>'
            : '<span class="badge badge-blue" style="margin-left:6px;">Above 9h</span>'}
      </div>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
      <div class="card" style="padding:12px; text-align:center;">
        <div style="font-size:1rem; font-weight:700;">🌙 ${entry.bedtime}</div>
        <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">Bedtime</div>
      </div>
      <div class="card" style="padding:12px; text-align:center;">
        <div style="font-size:1rem; font-weight:700;">☀️ ${entry.waketime}</div>
        <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">Wake time</div>
      </div>
    </div>
    ${entry.notes ? `<div style="margin-top:12px; font-size:0.82rem; color:var(--text-secondary); font-style:italic;">"${escHtml(entry.notes)}"</div>` : ''}
  `
}

async function renderChart() {
  const canvas = document.getElementById('sleep-chart')
  if (!canvas) return
  if (chartInstance) { chartInstance.destroy(); chartInstance = null }

  // build last 14 days
  const labels = [], hours = [], colors = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = localDateKey(d)
    const entry = await window.api.store.getSleep(key)
    labels.push(key.slice(5))  // MM-DD
    hours.push(entry ? entry.hours : null)
    colors.push(entry ? (QUALITY_COLORS[entry.quality] || 'var(--accent-blue)') : 'transparent')
  }

  chartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: hours,
        backgroundColor: colors,
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0, max: 12,
          grid: { color: 'rgba(45,55,72,0.5)' },
          ticks: { callback: v => v + 'h' }
        },
        x: { grid: { display: false } }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => ctx.parsed.y !== null ? `${ctx.parsed.y}h sleep` : 'Not logged'
          }
        },
        annotation: {
          annotations: {
            minLine: {
              type: 'line', yMin: 7, yMax: 7,
              borderColor: 'rgba(104,211,145,0.4)', borderWidth: 1, borderDash: [4, 4]
            }
          }
        }
      }
    }
  })
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
