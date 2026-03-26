import { state } from '../state.js'
import { fmt, fmtDate } from '../ui.js'

export async function init() {
  const profile = state.profile
  renderStats(profile)

  const slider = document.getElementById('deficit-slider')
  slider.addEventListener('input', () => recalc(profile, parseInt(slider.value)))
  recalc(profile, parseInt(slider.value))
}

function renderStats(profile) {
  const bf     = profile.bodyFat     || 18.5
  const goalBf = profile.goalBodyFat || 12.5
  const weight = profile.weight      || 180
  const fatMass = (bf / 100) * weight
  const lbsToLose = Math.max(0, fatMass - (goalBf / 100) * weight)

  document.getElementById('current-stats').innerHTML = `
    <div class="card" style="padding: 14px; text-align: center;">
      <div style="font-size: 1.5rem; font-weight: 800;">${fmt(bf, 1)}%</div>
      <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">Current BF</div>
    </div>
    <div class="card" style="padding: 14px; text-align: center;">
      <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent-green);">${fmt(goalBf, 1)}%</div>
      <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">Goal BF</div>
    </div>
    <div class="card" style="padding: 14px; text-align: center;">
      <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent-orange);">${fmt(weight, 0)}</div>
      <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">lbs weight</div>
    </div>
    <div class="card" style="padding: 14px; text-align: center;">
      <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent-yellow);">${fmt(lbsToLose, 1)}</div>
      <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">lbs fat to lose</div>
    </div>
  `
}

function recalc(profile, deficit) {
  const bf       = profile.bodyFat     || 18.5
  const goalBf   = profile.goalBodyFat || 12.5
  const weight   = profile.weight      || 180

  const fatMass    = (bf / 100) * weight
  const lbsToLose  = Math.max(0, fatMass - (goalBf / 100) * weight)
  const calNeeded  = lbsToLose * 3500
  const days       = deficit > 0 ? Math.ceil(calNeeded / deficit) : Infinity

  document.getElementById('deficit-val').textContent = deficit
  document.getElementById('deficit-context').textContent =
    `~${fmt(deficit / 3500 * 7, 2)} lbs/week · ~${fmt(lbsToLose, 1)} lbs total to lose`

  if (days === Infinity || !isFinite(days)) {
    document.getElementById('goal-date').textContent = '—'
    document.getElementById('goal-days').textContent = 'Set a deficit to project your date'
    document.getElementById('goal-disclaimer').textContent = ''
    return
  }

  const goalDate = new Date()
  goalDate.setDate(goalDate.getDate() + days)
  const monthYear = goalDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const dayNum    = goalDate.toLocaleDateString('en-US', { day: 'numeric' })

  document.getElementById('goal-date').textContent = `${monthYear} ${dayNum}`
  document.getElementById('goal-days').textContent = `~${days} days from now`
  document.getElementById('goal-disclaimer').textContent =
    'Assumes consistent deficit & no muscle loss adjustment'

  renderMilestones(profile, deficit, days)
}

function renderMilestones(profile, deficit, totalDays) {
  const bf     = profile.bodyFat     || 18.5
  const goalBf = profile.goalBodyFat || 12.5
  const weight = profile.weight      || 180
  const section = document.getElementById('milestones-section')
  const list = document.getElementById('milestones-list')

  // Generate milestones at each % body fat step down
  const steps = []
  const startBF = Math.floor(bf)
  const endBF   = Math.ceil(goalBf)
  for (let pct = startBF; pct >= endBF; pct--) {
    const lbsNeeded = ((bf / 100) * weight) - ((pct / 100) * weight)
    const daysNeeded = deficit > 0 ? Math.ceil(lbsNeeded * 3500 / deficit) : Infinity
    const d = new Date()
    d.setDate(d.getDate() + daysNeeded)
    steps.push({ pct, date: d, days: daysNeeded })
  }

  section.style.display = 'block'
  list.innerHTML = steps.map((s, i) => `
    <div class="meal-item">
      <div class="meal-info">
        <div class="meal-name" style="font-weight: ${s.pct === Math.ceil(goalBf) ? '800' : '500'}; color: ${s.pct === Math.ceil(goalBf) ? 'var(--accent-green)' : 'var(--text-primary)'}">
          ${s.pct === Math.ceil(goalBf) ? '&#x1F3AF; ' : ''}${s.pct}% body fat
        </div>
      </div>
      <div style="color: var(--text-secondary); font-size: 0.85rem; margin-right: 12px;">~${s.days} days</div>
      <div style="font-weight: 600; font-size: 0.9rem; min-width: 80px; text-align: right;">
        ${s.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </div>
    </div>
  `).join('')
}
