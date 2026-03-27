import { toast } from '../ui.js'
import { computeGoalTargets } from '../state.js'

let onCompleteCallback = null

const steps = [0, 1, 2]

// Selections for step 1
let selectedGoal   = 'cut'
let selectedAggr   = 'moderate'
let selectedActiv  = 'moderate'

function showStep(n) {
  steps.forEach(i => {
    document.getElementById(`step-${i}`).classList.toggle('active', i === n)
    const dot = document.getElementById(`dot-${i}`)
    dot.classList.toggle('active', i === n)
    dot.classList.toggle('done', i < n)
  })
}

function validate0() {
  const name   = document.getElementById('onb-name').value.trim()
  const weight = parseFloat(document.getElementById('onb-weight').value)
  const height = parseFloat(document.getElementById('onb-height').value)
  const age    = parseInt(document.getElementById('onb-age').value)
  const bf     = parseFloat(document.getElementById('onb-bodyfat').value)
  const goalBf = parseFloat(document.getElementById('onb-goalbf').value)
  if (!name) { toast('Please enter your name', 'error'); return false }
  if (!weight || weight < 50) { toast('Enter a valid weight', 'error'); return false }
  if (!height || height < 48) { toast('Enter height in inches (e.g. 69 for 5\'9")', 'error'); return false }
  if (!age || age < 16 || age > 80) { toast('Enter a valid age', 'error'); return false }
  if (!bf || bf < 3 || bf > 60) { toast('Enter a valid body fat %', 'error'); return false }
  if (!goalBf || goalBf < 3) { toast('Enter a valid goal body fat %', 'error'); return false }
  return true
}

function updateAggrSubtitles() {
  const isCut  = selectedGoal === 'cut'
  const isBulk = selectedGoal === 'bulk'

  if (isCut) {
    document.getElementById('onb-aggr-slow-sub').textContent  = '−250 cal/day · ~0.5 lbs/wk'
    document.getElementById('onb-aggr-mod-sub').textContent   = '−500 cal/day · ~1 lb/wk'
    document.getElementById('onb-aggr-agg-sub').textContent   = '−750 cal/day · ~1.5 lbs/wk'
  } else if (isBulk) {
    document.getElementById('onb-aggr-slow-sub').textContent  = '+150 cal/day · ~0.3 lbs/wk'
    document.getElementById('onb-aggr-mod-sub').textContent   = '+300 cal/day · ~0.6 lbs/wk'
    document.getElementById('onb-aggr-agg-sub').textContent   = '+500 cal/day · ~1 lb/wk'
  }
}

function updateTargetsPreview() {
  const weight = parseFloat(document.getElementById('onb-weight').value) || 180
  const height = parseFloat(document.getElementById('onb-height').value) || 69
  const age    = parseInt(document.getElementById('onb-age').value)      || 30

  const targets = computeGoalTargets({
    weight, height, age,
    goalType:       selectedGoal,
    aggressiveness: selectedAggr,
    activityLevel:  selectedActiv
  })

  const preview = document.getElementById('onb-targets-preview')
  preview.innerHTML = [
    { label: 'Calories', value: targets.dailyCalTarget, unit: 'kcal', color: 'var(--accent-green)' },
    { label: 'Protein',  value: targets.proteinTarget,  unit: 'g',    color: 'var(--accent-blue)' },
    { label: 'Carbs',    value: targets.carbTarget,     unit: 'g',    color: 'var(--accent-orange)' },
    { label: 'Fat',      value: targets.fatTarget,      unit: 'g',    color: 'var(--accent-yellow)' }
  ].map(t => `
    <div>
      <div style="font-size: 1.3rem; font-weight: 800; color: ${t.color};">${t.value}<span style="font-size:0.75rem; font-weight:500; color:var(--text-muted);">${t.unit}</span></div>
      <div style="font-size: 0.7rem; color: var(--text-muted);">${t.label}</div>
    </div>
  `).join('')

  document.getElementById('onb-tdee-info').textContent =
    `TDEE est. ${targets.tdee} kcal/day · targets auto-adjust as your weight changes`
}

async function finish() {
  const btn = document.getElementById('step2-finish')
  btn.disabled = true
  btn.textContent = 'Saving...'

  const weight = parseFloat(document.getElementById('onb-weight').value)
  const height = parseFloat(document.getElementById('onb-height').value)
  const age    = parseInt(document.getElementById('onb-age').value)

  const targets = computeGoalTargets({
    weight, height, age,
    goalType:       selectedGoal,
    aggressiveness: selectedAggr,
    activityLevel:  selectedActiv
  })

  const profile = {
    name:           document.getElementById('onb-name').value.trim(),
    weight,
    height,
    age,
    bodyFat:        parseFloat(document.getElementById('onb-bodyfat').value),
    goalBodyFat:    parseFloat(document.getElementById('onb-goalbf').value),
    goalType:       selectedGoal,
    aggressiveness: selectedAggr,
    activityLevel:  selectedActiv,
    dailyCalTarget: targets.dailyCalTarget,
    proteinTarget:  targets.proteinTarget,
    carbTarget:     targets.carbTarget,
    fatTarget:      targets.fatTarget,
    createdAt:      new Date().toISOString()
  }

  const apiKey = document.getElementById('onb-apikey').value.trim()

  await window.api.store.saveProfile(profile)
  if (apiKey) await window.api.store.saveApiKey(apiKey)

  toast('Profile saved!', 'success')
  if (onCompleteCallback) onCompleteCallback()
}

export function init(onComplete) {
  onCompleteCallback = onComplete

  // Pre-fill defaults
  document.getElementById('onb-weight').value  = '180'
  document.getElementById('onb-height').value  = '69'
  document.getElementById('onb-age').value     = '28'
  document.getElementById('onb-bodyfat').value = '18.5'
  document.getElementById('onb-goalbf').value  = '12.5'

  // Goal type cards
  document.getElementById('onb-goal-grid').addEventListener('click', e => {
    const card = e.target.closest('[data-goal]')
    if (!card) return
    selectedGoal = card.dataset.goal
    document.querySelectorAll('#onb-goal-grid .goal-card').forEach(c =>
      c.classList.toggle('selected', c === card)
    )
    // Show/hide aggressiveness for cut/bulk
    const showAggr = selectedGoal === 'cut' || selectedGoal === 'bulk'
    document.getElementById('onb-aggr-wrap').style.display = showAggr ? 'block' : 'none'
    updateAggrSubtitles()
    updateTargetsPreview()
  })

  // Aggressiveness cards
  document.getElementById('onb-aggr-grid').addEventListener('click', e => {
    const card = e.target.closest('[data-aggr]')
    if (!card) return
    selectedAggr = card.dataset.aggr
    document.querySelectorAll('#onb-aggr-grid .aggr-card').forEach(c =>
      c.classList.toggle('selected', c === card)
    )
    updateTargetsPreview()
  })

  // Activity cards
  document.getElementById('onb-activity-grid').addEventListener('click', e => {
    const card = e.target.closest('[data-activity]')
    if (!card) return
    selectedActiv = card.dataset.activity
    document.querySelectorAll('#onb-activity-grid .activity-card').forEach(c =>
      c.classList.toggle('selected', c === card)
    )
    updateTargetsPreview()
  })

  // Step navigation
  document.getElementById('step0-next').addEventListener('click', () => {
    if (!validate0()) return
    updateAggrSubtitles()
    updateTargetsPreview()
    showStep(1)
  })
  document.getElementById('step1-back').addEventListener('click', () => showStep(0))
  document.getElementById('step1-next').addEventListener('click', () => showStep(2))
  document.getElementById('step2-back').addEventListener('click', () => showStep(1))
  document.getElementById('step2-finish').addEventListener('click', finish)

  document.getElementById('test-key-btn').addEventListener('click', async () => {
    const key = document.getElementById('onb-apikey').value.trim()
    if (!key) { toast('Enter an API key first', 'error'); return }

    const btn = document.getElementById('test-key-btn')
    const result = document.getElementById('key-test-result')
    btn.disabled = true
    btn.textContent = 'Testing...'
    result.style.display = 'none'

    const res = await window.api.ai.testKey(key)

    btn.disabled = false
    btn.textContent = '🔧 Test Connection'
    result.style.display = 'block'

    if (res.success) {
      result.innerHTML = '<span style="color: var(--accent-green)">&#x2713; API key works!</span>'
    } else {
      result.innerHTML = `<span style="color: var(--accent-red)">&#x2717; ${res.error || 'Invalid key'}</span>`
    }
  })
}
