import { state, computeGoalTargets } from '../state.js'
import { toast, fmt, fmtDate } from '../ui.js'
import { initChartDefaults } from '../chart-init.js'

let chartInstance = null

export async function init() {
  initChartDefaults()

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

  if (!date)               { toast('Select a date', 'error'); return }
  if (!weight || weight < 50) { toast('Enter a valid weight', 'error'); return }

  await window.api.store.addWeight(date, weight)

  // Always recalculate targets when weight is logged for today
  if (date === state.todayKey && state.profile) {
    await recalculateTargets(weight)
  }

  toast(`Logged: ${weight} lbs on ${fmtDate(date)}`, 'success')
  document.getElementById('wt-val').value = ''
  await refresh()
}

/**
 * Recompute macro targets from new weight, save to profile, notify if changed.
 * Then attempt TDEE calibration from real data.
 */
async function recalculateTargets(newWeight) {
  const profile = state.profile
  const updatedProfile = { ...profile, weight: newWeight }
  const newTargets = computeGoalTargets(updatedProfile)

  const calChanged = newTargets.dailyCalTarget !== profile.dailyCalTarget

  Object.assign(updatedProfile, newTargets)
  await window.api.store.saveProfile(updatedProfile)
  state.profile = updatedProfile

  if (calChanged) {
    toast(
      `Targets updated → ${newTargets.dailyCalTarget} kcal · ${newTargets.proteinTarget}g protein`,
      'info'
    )
  }

  // Try calibrating TDEE from actual food + weight data
  await tryCalibrateTDEE(updatedProfile)
}

/**
 * Back-calculate real TDEE from actual weight trend + food logs.
 * Requires ≥14 days of data with ≥7 food log days.
 * If calibrated TDEE differs from formula TDEE by >100 kcal, update and notify.
 */
async function tryCalibrateTDEE(profile) {
  const weightLog = await window.api.store.getWeightLog()
  if (weightLog.length < 2) return

  const sorted = [...weightLog].sort((a, b) => a.date.localeCompare(b.date))
  const newest = sorted[sorted.length - 1]

  // Find the oldest entry that's at least 14 days before newest
  const cutoff = new Date(newest.date)
  cutoff.setDate(cutoff.getDate() - 28)
  const cutoffKey = cutoff.toISOString().slice(0, 10)

  const oldEntry = sorted.find(e => e.date <= cutoffKey) ||
                   (sorted.length >= 2 ? sorted[0] : null)

  if (!oldEntry || oldEntry.date === newest.date) return

  const daysBetween = Math.round(
    (new Date(newest.date) - new Date(oldEntry.date)) / (1000 * 60 * 60 * 24)
  )
  if (daysBetween < 14) return

  // Pull calorie logs for this window
  const calorieHistory = await window.api.store.getCalorieHistory(oldEntry.date, newest.date)
  if (!calorieHistory || calorieHistory.length < 7) return

  const totalCals  = calorieHistory.reduce((s, d) => s + d.calories, 0)
  const avgDailyCals = totalCals / calorieHistory.length

  // realTDEE = avgEaten - (actualWeightChange * 3500 / days)
  const weightChangeLbs = newest.weight - oldEntry.weight
  const calibratedTDEE  = Math.round(avgDailyCals - (weightChangeLbs * 3500 / daysBetween))

  // Sanity check: must be in a plausible range
  if (calibratedTDEE < 1200 || calibratedTDEE > 6000) return

  const formulaTDEE = computeGoalTargets(profile).tdee
  const diff = Math.abs(calibratedTDEE - formulaTDEE)

  // Update stored calibration either way for display, but only re-save targets if diff is significant
  const updatedProfile = {
    ...profile,
    calibratedTDEE,
    calibratedTDEEDate: newest.date,
    calibrationDays: daysBetween,
    calibrationLogDays: calorieHistory.length
  }

  if (diff > 100) {
    // Recalculate targets using calibrated TDEE by temporarily overriding it
    const newTargets = computeGoalTargetsWithTDEE(updatedProfile, calibratedTDEE)
    Object.assign(updatedProfile, newTargets)

    await window.api.store.saveProfile(updatedProfile)
    state.profile = updatedProfile

    toast(
      `Real TDEE est. ${calibratedTDEE} kcal (formula: ${formulaTDEE}) — targets adjusted`,
      'info'
    )
  } else {
    await window.api.store.saveProfile(updatedProfile)
    state.profile = updatedProfile
  }
}

/**
 * Same as computeGoalTargets but uses an externally provided TDEE
 * instead of recalculating from the formula.
 */
function computeGoalTargetsWithTDEE(profile, tdee) {
  const weight = profile.weight || 180
  const goalType = profile.goalType || 'cut'
  const aggr     = profile.aggressiveness || 'moderate'

  const DEFICITS  = { slow: 250, moderate: 500, aggressive: 750 }
  const SURPLUSES = { slow: 150, moderate: 300, aggressive: 500 }

  let calories
  if (goalType === 'cut')       calories = tdee - (DEFICITS[aggr]  || 500)
  else if (goalType === 'bulk') calories = tdee + (SURPLUSES[aggr] || 300)
  else                          calories = tdee

  const proteinPerLb = goalType === 'maintain' ? 0.8 : goalType === 'bulk' ? 0.9 : 1.0
  const protein = Math.round(weight * proteinPerLb)
  const fat     = Math.round(weight * 0.35)
  const carbs   = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4))

  return { dailyCalTarget: calories, proteinTarget: protein, carbTarget: carbs, fatTarget: fat }
}

async function refresh() {
  const log = await window.api.store.getWeightLog()
  renderStats(log)
  renderPaceAlert(log)
  renderCalibration()
  renderChart(log)
  renderHistory(log)
}

function computeWeeklyRate(log) {
  if (log.length < 2) return null
  const sorted = [...log].sort((a, b) => a.date.localeCompare(b.date))

  // Find two entries roughly 7-28 days apart (prefer longer window for accuracy)
  const newest = sorted[sorted.length - 1]
  let bestOld = null
  for (let i = sorted.length - 2; i >= 0; i--) {
    const days = Math.round(
      (new Date(newest.date) - new Date(sorted[i].date)) / (1000 * 60 * 60 * 24)
    )
    if (days >= 7) { bestOld = sorted[i]; break }
  }
  if (!bestOld) {
    // Fallback: use whatever two entries we have
    bestOld = sorted[0]
  }

  const days = Math.round(
    (new Date(newest.date) - new Date(bestOld.date)) / (1000 * 60 * 60 * 24)
  )
  if (days === 0) return null

  const lbsPerWeek = ((newest.weight - bestOld.weight) / days) * 7
  return { lbsPerWeek, days, from: bestOld.date, to: newest.date }
}

function renderStats(log) {
  const profile = state.profile
  const goalBf  = profile?.goalBodyFat || 12.5

  if (log.length === 0) return

  const startW   = log[0].weight
  const current  = log[log.length - 1].weight
  const change   = current - startW

  const bf       = profile?.bodyFat || 18
  const leanMass = startW * (1 - bf / 100)
  const goalW    = leanMass / (1 - goalBf / 100)

  const changeColor = change <= 0 ? 'var(--accent-green)' : 'var(--accent-red)'

  document.getElementById('wt-current').textContent = `${fmt(current, 1)} lbs`
  document.getElementById('wt-start').textContent   = `${fmt(startW, 1)} lbs`
  document.getElementById('wt-change').innerHTML    = `<span style="color:${changeColor}">${change > 0 ? '+' : ''}${fmt(change, 1)} lbs</span>`
  document.getElementById('wt-goal').textContent    = `${fmt(goalW, 1)} lbs`

  // Weekly pace
  const rate = computeWeeklyRate(log)
  const paceEl = document.getElementById('wt-pace')
  if (rate) {
    const sign  = rate.lbsPerWeek > 0 ? '+' : ''
    const color = rate.lbsPerWeek < 0 ? 'var(--accent-green)' : 'var(--accent-red)'
    paceEl.innerHTML = `<span style="color:${color}">${sign}${fmt(rate.lbsPerWeek, 2)}</span>`
  } else {
    paceEl.textContent = '—'
  }
}

function renderPaceAlert(log) {
  const alertEl = document.getElementById('wt-pace-alert')
  const profile = state.profile
  const goalType = profile?.goalType || 'cut'

  alertEl.style.display = 'none'
  alertEl.innerHTML = ''

  if (log.length < 2) return

  const rate = computeWeeklyRate(log)
  if (!rate || rate.days < 7) return

  const r = rate.lbsPerWeek
  let msg = null
  let color = null
  let icon = null

  if (goalType === 'cut' || goalType === 'recomp') {
    if (r < -1.5) {
      msg   = `You're losing ${fmt(Math.abs(r), 2)} lbs/wk — faster than 1.5 lbs/wk risks muscle loss. Consider reducing your deficit slightly.`
      color = 'var(--accent-red)'
      icon  = '⚠️'
    } else if (r > -0.25) {
      msg   = `You're losing ${fmt(Math.abs(r), 2)} lbs/wk — slower than expected for a cut. Check your logging accuracy or tighten up your deficit.`
      color = 'var(--accent-yellow)'
      icon  = '📊'
    } else {
      msg   = `Solid pace: ${fmt(Math.abs(r), 2)} lbs/wk over the last ${rate.days} days. Keep it up.`
      color = 'var(--accent-green)'
      icon  = '✅'
    }
  } else if (goalType === 'bulk') {
    if (r > 1.0) {
      msg   = `Gaining ${fmt(r, 2)} lbs/wk — faster than ~1 lb/wk may increase fat gain. Consider reducing your surplus.`
      color = 'var(--accent-yellow)'
      icon  = '⚠️'
    } else if (r < 0.1) {
      msg   = `Gaining ${fmt(r, 2)} lbs/wk — slower than expected for a bulk. You may need to eat more.`
      color = 'var(--accent-blue)'
      icon  = '📊'
    } else {
      msg   = `Good bulk pace: ${fmt(r, 2)} lbs/wk over the last ${rate.days} days.`
      color = 'var(--accent-green)'
      icon  = '✅'
    }
  }

  if (msg) {
    alertEl.style.display = 'block'
    alertEl.innerHTML = `
      <div class="card" style="border-color: ${color}; display: flex; gap: 12px; align-items: flex-start; padding: 14px 18px;">
        <div style="font-size: 1.2rem;">${icon}</div>
        <div style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.5;">${msg}</div>
      </div>
    `
  }
}

function renderCalibration() {
  const profile = state.profile
  const calEl   = document.getElementById('wt-calibration')
  const bodyEl  = document.getElementById('wt-calibration-body')

  if (!profile?.calibratedTDEE) {
    calEl.style.display = 'none'
    return
  }

  calEl.style.display = 'block'
  const formulaTDEE = computeGoalTargets(profile).tdee
  const diff = profile.calibratedTDEE - formulaTDEE
  const diffStr = diff > 0 ? `+${diff}` : `${diff}`
  const direction = diff > 0 ? 'higher' : 'lower'

  bodyEl.innerHTML = `
    Your measured TDEE is <strong style="color:var(--accent-blue)">${profile.calibratedTDEE} kcal/day</strong>
    — ${diffStr} kcal (${direction}) than the Mifflin-St Jeor formula estimate of ${formulaTDEE} kcal.<br>
    Based on <strong>${profile.calibrationLogDays} food log days</strong> over a <strong>${profile.calibrationDays}-day window</strong>.
    Targets are using your real TDEE.
  `
}

function renderChart(log) {
  const canvas = document.getElementById('weight-chart')
  if (!canvas) return

  if (chartInstance) { chartInstance.destroy(); chartInstance = null }

  if (log.length === 0) {
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
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
        x: { grid: { color: 'rgba(45,55,72,0.5)' }, ticks: { maxTicksLimit: 8 } },
        y: {
          min: minW, max: maxW,
          grid: { color: 'rgba(45,55,72,0.5)' },
          ticks: { callback: val => val + ' lbs' }
        }
      },
      plugins: { tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} lbs` } } }
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
    const prev    = sorted[i + 1]
    const diff    = prev ? e.weight - prev.weight : null
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
