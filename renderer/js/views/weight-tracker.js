import { state } from '../state.js'
import { toast, fmt, fmtDate } from '../ui.js'
import { initChartDefaults } from '../chart-init.js'

let chartInstance = null

export async function init() {
  initChartDefaults()

  // set date input to today
  document.getElementById('wt-date').value = state.todayKey

  document.getElementById('wt-add-btn').addEventListener('click', addWeight)
  document.getElementById('wt-val').addEventListener('keydown', e => {
    if (e.key === 'Enter') addWeight()
  })

  await refresh()
}

async function addWeight() {
  const date   = document.getElementById('wt-date').value
  const weight = parseFloat(document.getElementById('wt-val').value)

  if (!date)           { toast('Select a date', 'error'); return }
  if (!weight || weight < 50) { toast('Enter a valid weight', 'error'); return }

  await window.api.store.addWeight(date, weight)

  // update profile's current weight if it's today
  if (date === state.todayKey && state.profile) {
    state.profile.weight = weight
    await window.api.store.saveProfile(state.profile)
  }

  toast(`Logged: ${weight} lbs on ${fmtDate(date)}`, 'success')
  document.getElementById('wt-val').value = ''
  await refresh()
}

async function refresh() {
  const log = await window.api.store.getWeightLog()
  renderStats(log)
  renderChart(log)
  renderHistory(log)
}

function renderStats(log) {
  const profile = state.profile
  const goalBf  = profile?.goalBodyFat || 12.5
  const startW  = profile?.weight || (log.length > 0 ? log[0].weight : null)

  if (log.length === 0) return

  const current = log[log.length - 1].weight
  const start   = log[0].weight
  const change  = current - start

  // Estimate goal weight: keep current lean mass, hit goalBF%
  const bf       = profile?.bodyFat || 18
  const leanMass = startW * (1 - bf / 100)
  const goalW    = leanMass / (1 - goalBf / 100)

  const changeColor = change <= 0 ? 'var(--accent-green)' : 'var(--accent-red)'

  document.getElementById('wt-current').textContent = `${fmt(current, 1)} lbs`
  document.getElementById('wt-start').textContent   = `${fmt(start, 1)} lbs`
  document.getElementById('wt-change').innerHTML    = `<span style="color:${changeColor}">${change > 0 ? '+' : ''}${fmt(change, 1)} lbs</span>`
  document.getElementById('wt-goal').textContent    = `${fmt(goalW, 1)} lbs`
}

function renderChart(log) {
  const canvas = document.getElementById('weight-chart')
  if (!canvas) return

  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }

  if (log.length === 0) {
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    return
  }

  const labels  = log.map(e => fmtDate(e.date))
  const weights = log.map(e => e.weight)
  const minW    = Math.min(...weights) - 2
  const maxW    = Math.max(...weights) + 2

  chartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: weights,
        borderColor: '#68d391',
        backgroundColor: 'rgba(104,211,145,0.08)',
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#68d391',
        pointBorderColor: '#0f1117',
        pointBorderWidth: 2,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: 'rgba(45,55,72,0.5)' },
          ticks: { maxTicksLimit: 8 }
        },
        y: {
          min: minW,
          max: maxW,
          grid: { color: 'rgba(45,55,72,0.5)' },
          ticks: {
            callback: val => val + ' lbs'
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.parsed.y} lbs`
          }
        }
      }
    }
  })
}

function renderHistory(log) {
  const el = document.getElementById('wt-history')
  if (!el) return

  if (log.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">&#x2696;&#xFE0F;</div><p>No weight entries yet</p></div>`
    return
  }

  const sorted = [...log].reverse()
  el.innerHTML = sorted.map((e, i) => {
    const prev = sorted[i + 1]
    const diff = prev ? e.weight - prev.weight : null
    const diffStr = diff !== null
      ? `<span style="color:${diff <= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}; font-size: 0.8rem; margin-left: 8px;">${diff > 0 ? '+' : ''}${fmt(diff, 1)} lbs</span>`
      : ''
    return `
      <div class="meal-item">
        <div class="meal-info">
          <div class="meal-name">${fmtDate(e.date)}</div>
          <div class="meal-macros">${e.date}</div>
        </div>
        <div style="font-size: 1.1rem; font-weight: 700;">${fmt(e.weight, 1)} lbs${diffStr}</div>
      </div>
    `
  }).join('')
}
