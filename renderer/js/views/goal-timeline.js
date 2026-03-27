import { state, computeGoalTargets } from '../state.js'
import { toast } from '../ui.js'

let profile = null
let selectedGoal  = 'cut'
let selectedAggr  = 'moderate'
let selectedActiv = 'moderate'
let dirty = false

export async function init() {
  profile = state.profile

  selectedGoal  = profile.goalType      || 'cut'
  selectedAggr  = profile.aggressiveness || 'moderate'
  selectedActiv = profile.activityLevel  || 'moderate'

  applySelections()
  updateAggrSubtitles()
  renderTargets()
  renderProgress()

  // Goal type cards
  document.getElementById('gt-goal-grid').addEventListener('click', e => {
    const card = e.target.closest('[data-goal]')
    if (!card) return
    selectedGoal = card.dataset.goal
    applySelections()
    updateAggrSubtitles()
    renderTargets()
    renderProgress()
    markDirty()
  })

  // Aggressiveness cards
  document.getElementById('gt-aggr-grid').addEventListener('click', e => {
    const card = e.target.closest('[data-aggr]')
    if (!card) return
    selectedAggr = card.dataset.aggr
    applySelections()
    renderTargets()
    renderProgress()
    markDirty()
  })

  // Activity cards
  document.getElementById('gt-activity-grid').addEventListener('click', e => {
    const card = e.target.closest('[data-activity]')
    if (!card) return
    selectedActiv = card.dataset.activity
    applySelections()
    renderTargets()
    markDirty()
  })

  document.getElementById('gt-save-btn').addEventListener('click', saveGoal)
}

function applySelections() {
  // Goal type
  document.querySelectorAll('#gt-goal-grid .goal-card').forEach(c =>
    c.classList.toggle('selected', c.dataset.goal === selectedGoal)
  )

  // Aggressiveness — hide for maintain/recomp
  const showAggr = selectedGoal === 'cut' || selectedGoal === 'bulk'
  document.getElementById('gt-aggr-section').style.display = showAggr ? 'block' : 'none'
  document.querySelectorAll('#gt-aggr-grid .aggr-card').forEach(c =>
    c.classList.toggle('selected', c.dataset.aggr === selectedAggr)
  )

  // Activity
  document.querySelectorAll('#gt-activity-grid .activity-card').forEach(c =>
    c.classList.toggle('selected', c.dataset.activity === selectedActiv)
  )
}

function updateAggrSubtitles() {
  const isCut  = selectedGoal === 'cut'
  const isBulk = selectedGoal === 'bulk'
  if (isCut) {
    document.getElementById('gt-aggr-slow-sub').textContent  = '−250 cal/day · ~0.5 lbs/wk'
    document.getElementById('gt-aggr-mod-sub').textContent   = '−500 cal/day · ~1 lb/wk'
    document.getElementById('gt-aggr-agg-sub').textContent   = '−750 cal/day · ~1.5 lbs/wk'
  } else if (isBulk) {
    document.getElementById('gt-aggr-slow-sub').textContent  = '+150 cal/day · ~0.3 lbs/wk'
    document.getElementById('gt-aggr-mod-sub').textContent   = '+300 cal/day · ~0.6 lbs/wk'
    document.getElementById('gt-aggr-agg-sub').textContent   = '+500 cal/day · ~1 lb/wk'
  }
}

function renderTargets() {
  const targets = computeGoalTargets({
    ...profile,
    goalType:       selectedGoal,
    aggressiveness: selectedAggr,
    activityLevel:  selectedActiv
  })

  const display = document.getElementById('gt-targets-display')
  display.innerHTML = [
    { label: 'Calories', value: targets.dailyCalTarget, unit: 'kcal', color: 'var(--accent-green)' },
    { label: 'Protein',  value: targets.proteinTarget,  unit: 'g',    color: 'var(--accent-blue)' },
    { label: 'Carbs',    value: targets.carbTarget,     unit: 'g',    color: 'var(--accent-orange)' },
    { label: 'Fat',      value: targets.fatTarget,      unit: 'g',    color: 'var(--accent-yellow)' }
  ].map(t => `
    <div class="card" style="padding: 12px;">
      <div style="font-size: 1.5rem; font-weight: 800; color: ${t.color}; line-height: 1;">${t.value}<span style="font-size:0.7rem; font-weight:500; color:var(--text-muted);">${t.unit}</span></div>
      <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">${t.label}</div>
    </div>
  `).join('')

  const goalLabels = { cut: 'Cutting', bulk: 'Bulking', maintain: 'Maintaining', recomp: 'Recomping' }
  const aggrLabels = { slow: 'slow', moderate: 'moderate', aggressive: 'aggressive' }
  const actLabels  = {
    sedentary: 'sedentary', light: 'light activity', moderate: 'moderate activity',
    active: 'active', very_active: 'very active'
  }

  let desc = goalLabels[selectedGoal] || selectedGoal
  if (selectedGoal === 'cut' || selectedGoal === 'bulk') {
    desc += ` · ${aggrLabels[selectedAggr]}`
  }
  desc += ` · TDEE ${targets.tdee} kcal (${actLabels[selectedActiv] || selectedActiv})`

  document.getElementById('gt-tdee-info').textContent = desc
}

function renderProgress() {
  const bf     = profile.bodyFat     || 18.5
  const goalBf = profile.goalBodyFat || 12.5
  const weight = profile.weight      || 180

  const fatMass   = (bf / 100) * weight
  const lbsToLose = Math.max(0, fatMass - (goalBf / 100) * weight)
  const pctDone   = bf <= goalBf ? 100 : Math.max(0, Math.round(
    ((profile.startBodyFat || bf) - bf) / ((profile.startBodyFat || bf) - goalBf) * 100
  ))

  const statsEl = document.getElementById('gt-progress-stats')
  statsEl.innerHTML = [
    { label: 'Current BF',   value: `${bf}%`,          color: 'var(--text-primary)' },
    { label: 'Goal BF',      value: `${goalBf}%`,       color: 'var(--accent-green)' },
    { label: 'Current Weight', value: `${weight} lbs`,  color: 'var(--accent-orange)' },
    { label: 'Fat to Lose',  value: `${lbsToLose.toFixed(1)} lbs`, color: 'var(--accent-yellow)' }
  ].map(s => `
    <div class="card" style="padding: 12px; text-align: center;">
      <div style="font-size: 1.4rem; font-weight: 800; color: ${s.color};">${s.value}</div>
      <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 3px;">${s.label}</div>
    </div>
  `).join('')

  // Projected date based on current goal settings
  const targets = computeGoalTargets({
    ...profile,
    goalType:       selectedGoal,
    aggressiveness: selectedAggr,
    activityLevel:  selectedActiv
  })
  const dailyDeficit = targets.tdee - targets.dailyCalTarget
  const completionEl = document.getElementById('gt-completion')

  if ((selectedGoal === 'cut' || selectedGoal === 'recomp') && lbsToLose > 0 && dailyDeficit > 0) {
    const calNeeded = lbsToLose * 3500
    const days      = Math.ceil(calNeeded / dailyDeficit)
    const goalDate  = new Date()
    goalDate.setDate(goalDate.getDate() + days)
    const dateStr   = goalDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    completionEl.innerHTML = `
      <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Projected goal date</div>
      <div style="font-size: 2rem; font-weight: 900; color: var(--accent-green);">${dateStr}</div>
      <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">~${days} days from today</div>
    `
    renderMilestones(dailyDeficit)
  } else {
    completionEl.innerHTML = ''
    document.getElementById('milestones-section').style.display = 'none'
  }
}

function renderMilestones(dailyDeficit) {
  const bf     = profile.bodyFat     || 18.5
  const goalBf = profile.goalBodyFat || 12.5
  const weight = profile.weight      || 180
  const section = document.getElementById('milestones-section')
  const list    = document.getElementById('milestones-list')

  const steps = []
  for (let pct = Math.floor(bf); pct >= Math.ceil(goalBf); pct--) {
    const lbsNeeded  = ((bf / 100) * weight) - ((pct / 100) * weight)
    const daysNeeded = Math.ceil(lbsNeeded * 3500 / dailyDeficit)
    const d = new Date()
    d.setDate(d.getDate() + daysNeeded)
    steps.push({ pct, date: d, days: daysNeeded })
  }

  section.style.display = 'block'
  list.innerHTML = steps.map(s => `
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

function markDirty() {
  if (!dirty) {
    dirty = true
    document.getElementById('gt-save-wrap').style.display = 'block'
  }
}

async function saveGoal() {
  const btn = document.getElementById('gt-save-btn')
  btn.disabled = true
  btn.textContent = 'Saving...'

  const targets = computeGoalTargets({
    ...profile,
    goalType:       selectedGoal,
    aggressiveness: selectedAggr,
    activityLevel:  selectedActiv
  })

  const updated = {
    ...profile,
    goalType:       selectedGoal,
    aggressiveness: selectedAggr,
    activityLevel:  selectedActiv,
    dailyCalTarget: targets.dailyCalTarget,
    proteinTarget:  targets.proteinTarget,
    carbTarget:     targets.carbTarget,
    fatTarget:      targets.fatTarget
  }

  await window.api.store.saveProfile(updated)
  state.profile = updated
  profile = updated

  dirty = false
  document.getElementById('gt-save-wrap').style.display = 'none'
  btn.disabled = false
  btn.textContent = 'Save Goal Changes'

  toast('Goal updated — targets recalculated', 'success')
}
