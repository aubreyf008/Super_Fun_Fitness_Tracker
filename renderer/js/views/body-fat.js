import { state } from '../state.js'
import { toast, fmt } from '../ui.js'

export async function init() {
  const profile = state.profile

  // pre-fill height from profile
  if (profile?.height) {
    document.getElementById('bf-height').value = profile.height
  }

  document.getElementById('bf-calc-btn').addEventListener('click', calculate)
  document.getElementById('bf-save-btn').addEventListener('click', saveResult)
}

let lastBF = null

function calculate() {
  const neck   = parseFloat(document.getElementById('bf-neck').value)
  const waist  = parseFloat(document.getElementById('bf-waist').value)
  const height = parseFloat(document.getElementById('bf-height').value)

  if (!neck || !waist || !height) {
    toast('Enter all measurements', 'error')
    return
  }
  if (waist <= neck) {
    toast('Waist must be greater than neck measurement', 'error')
    return
  }

  // Navy Method formula for males (all inches)
  const bf = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)) - 450
  lastBF = Math.max(3, Math.min(60, bf))

  renderResult(lastBF, state.profile)
}

function renderResult(bf, profile) {
  const el = document.getElementById('bf-result')
  const goalBF = profile?.goalBodyFat || 12.5
  const weight = profile?.weight || 180
  const fatMass    = (bf / 100) * weight
  const leanMass   = weight - fatMass
  const goalFatMass = (goalBF / 100) * weight
  const lbsToLose  = Math.max(0, fatMass - goalFatMass)

  let category = ''
  let categoryColor = ''
  if (bf < 6)       { category = 'Essential Fat';  categoryColor = 'var(--accent-blue)' }
  else if (bf < 14) { category = 'Athletic';        categoryColor = 'var(--accent-green)' }
  else if (bf < 18) { category = 'Fitness';         categoryColor = 'var(--accent-green)' }
  else if (bf < 25) { category = 'Average';         categoryColor = 'var(--accent-orange)' }
  else              { category = 'Obese';            categoryColor = 'var(--accent-red)' }

  el.innerHTML = `
    <div style="text-align: center; margin-bottom: 20px;">
      <div style="font-size: 3.5rem; font-weight: 900; color: var(--accent-blue); line-height: 1;">
        ${fmt(bf, 1)}<span style="font-size: 1.5rem;">%</span>
      </div>
      <div style="margin-top: 6px;">
        <span class="badge" style="background: transparent; border: 1px solid ${categoryColor}; color: ${categoryColor};">
          ${category}
        </span>
      </div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px;">
      <div class="card" style="padding: 12px; text-align: center;">
        <div style="font-size: 1.4rem; font-weight: 800; color: var(--accent-orange);">${fmt(fatMass, 1)}</div>
        <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">lbs fat</div>
      </div>
      <div class="card" style="padding: 12px; text-align: center;">
        <div style="font-size: 1.4rem; font-weight: 800; color: var(--accent-blue);">${fmt(leanMass, 1)}</div>
        <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">lbs lean</div>
      </div>
    </div>
  `

  document.getElementById('bf-save-btn').style.display = 'inline-flex'

  // Progress bar (scale: 30% = 0%, goal = marker, current position)
  const maxBF = 30, minBF = 3
  const range = maxBF - minBF
  const currentPct = Math.max(0, Math.min(100, ((maxBF - bf) / range) * 100))
  const goalPct    = Math.max(0, Math.min(100, ((maxBF - goalBF) / range) * 100))

  document.getElementById('bf-progress-section').style.display = 'block'
  document.getElementById('bf-progress-fill').style.width = currentPct + '%'
  document.getElementById('bf-goal-marker').style.left = goalPct + '%'
  document.getElementById('bf-goal-label').textContent = `Goal: ${goalBF}%`

  document.getElementById('bf-stats').innerHTML = `
    <div class="card" style="padding: 14px; text-align: center;">
      <div style="font-size: 1.3rem; font-weight: 800; color: var(--accent-green);">${fmt(goalBF, 1)}%</div>
      <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">Goal BF</div>
    </div>
    <div class="card" style="padding: 14px; text-align: center;">
      <div style="font-size: 1.3rem; font-weight: 800; color: var(--accent-yellow);">${fmt(bf - goalBF, 1)}%</div>
      <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">BF to Lose</div>
    </div>
    <div class="card" style="padding: 14px; text-align: center;">
      <div style="font-size: 1.3rem; font-weight: 800; color: var(--accent-orange);">${fmt(lbsToLose, 1)}</div>
      <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">lbs fat to lose</div>
    </div>
  `
}

async function saveResult() {
  if (lastBF === null) return
  const profile = state.profile
  profile.bodyFat = parseFloat(lastBF.toFixed(1))
  await window.api.store.saveProfile(profile)
  state.profile = profile
  toast(`Body fat saved: ${profile.bodyFat}%`, 'success')
}
