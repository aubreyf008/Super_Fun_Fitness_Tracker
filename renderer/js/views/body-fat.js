import { state } from '../state.js'
import { toast, fmt, fmtDate } from '../ui.js'

let lastBF    = null
let visualBF  = null

export async function init() {
  const profile = state.profile

  // Pre-fill from profile
  if (profile?.height) document.getElementById('bf-height').value = profile.height
  if (profile?.weight) document.getElementById('bf-weight').value = profile.weight
  if (profile?.age)    document.getElementById('bf-age').value    = profile.age

  // Set photo date to today
  document.getElementById('photo-date').value = state.todayKey

  // Tab switching
  document.querySelectorAll('.tab-item').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'))
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))
      tab.classList.add('active')
      document.getElementById(`bf-tab-${tab.dataset.tab}`).classList.add('active')
    })
  })

  // Measurements tab
  document.getElementById('bf-calc-btn').addEventListener('click', calculate)
  document.getElementById('bf-save-btn').addEventListener('click', saveMeasurementResult)

  // Visual estimate tab
  document.getElementById('visual-bf-grid').addEventListener('click', e => {
    const card = e.target.closest('[data-bf]')
    if (!card) return
    document.querySelectorAll('.vbf-card').forEach(c => c.classList.remove('selected'))
    card.classList.add('selected')
    visualBF = parseFloat(card.dataset.bf)
    document.getElementById('visual-selected-val').textContent = `~${visualBF}%`
    document.getElementById('visual-selection').style.display = 'block'
  })
  document.getElementById('visual-save-btn').addEventListener('click', saveVisualEstimate)

  // Photos tab
  document.getElementById('photo-upload-btn').addEventListener('click', uploadPhoto)

  await loadPhotos()
}

// ─── Measurements ──────────────────────────────────────────────────────────

function calculate() {
  const neck   = parseFloat(document.getElementById('bf-neck').value)
  const waist  = parseFloat(document.getElementById('bf-waist').value)
  const height = parseFloat(document.getElementById('bf-height').value)
  const weight = parseFloat(document.getElementById('bf-weight').value)
  const age    = parseInt(document.getElementById('bf-age').value)

  if (!neck || !waist || !height) {
    toast('Enter at least neck, waist, and height', 'error')
    return
  }
  if (waist <= neck) {
    toast('Waist must be greater than neck', 'error')
    return
  }

  const results = []

  // Navy Method (neck + waist + height)
  const navy = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)) - 450
  results.push({ label: 'Navy Method', bf: navy, note: 'Neck + waist circumferences' })

  // YMCA Method (waist + weight)
  if (weight) {
    const ymca = ((-98.42 + (4.15 * waist) - (0.082 * weight)) / weight) * 100
    results.push({ label: 'YMCA Method', bf: ymca, note: 'Waist + bodyweight' })
  }

  // Deurenberg BMI-based (height + weight + age)
  if (weight && age) {
    const bmi  = (weight / (height * height)) * 703
    const deur = (1.20 * bmi) + (0.23 * age) - (10.8 * 1) - 5.4  // sex=1 for male
    results.push({ label: 'BMI Formula', bf: deur, note: 'Height, weight, age' })
  }

  // Clamp all to plausible range
  const clamped = results.map(r => ({ ...r, bf: Math.max(3, Math.min(60, r.bf)) }))

  // Average
  const avg = clamped.reduce((s, r) => s + r.bf, 0) / clamped.length
  lastBF = parseFloat(avg.toFixed(1))

  renderResult(lastBF, clamped, state.profile)
}

function renderResult(avgBF, methodResults, profile) {
  const el     = document.getElementById('bf-result')
  const goalBF = profile?.goalBodyFat || 12.5
  const weight = parseFloat(document.getElementById('bf-weight').value) || profile?.weight || 180

  const fatMass  = (avgBF / 100) * weight
  const leanMass = weight - fatMass

  let category = '', categoryColor = ''
  if (avgBF < 6)       { category = 'Essential Fat'; categoryColor = 'var(--accent-blue)' }
  else if (avgBF < 10) { category = 'Very Lean';     categoryColor = 'var(--accent-green)' }
  else if (avgBF < 14) { category = 'Athletic';      categoryColor = 'var(--accent-green)' }
  else if (avgBF < 18) { category = 'Fitness';       categoryColor = 'var(--accent-orange)' }
  else if (avgBF < 25) { category = 'Average';       categoryColor = 'var(--accent-orange)' }
  else                 { category = 'High BF';        categoryColor = 'var(--accent-red)' }

  const methodsHtml = methodResults.map(r => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding: 6px 0; border-bottom: 1px solid var(--border);">
      <div>
        <div style="font-size:0.8rem; font-weight:600;">${r.label}</div>
        <div style="font-size:0.7rem; color:var(--text-muted);">${r.note}</div>
      </div>
      <div style="font-weight:800; font-size:1rem;">${fmt(r.bf, 1)}%</div>
    </div>
  `).join('')

  el.innerHTML = `
    <div style="text-align: center; margin-bottom: 16px;">
      <div style="font-size: 3rem; font-weight: 900; color: var(--accent-blue); line-height: 1;">
        ${fmt(avgBF, 1)}<span style="font-size: 1.2rem;">%</span>
      </div>
      <div style="margin-top: 4px;">
        <span class="badge" style="background: transparent; border: 1px solid ${categoryColor}; color: ${categoryColor};">${category}</span>
        ${methodResults.length > 1 ? `<span style="font-size:0.7rem; color:var(--text-muted); margin-left:8px;">avg of ${methodResults.length} methods</span>` : ''}
      </div>
    </div>

    <div style="margin-bottom: 12px;">${methodsHtml}</div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px;">
      <div class="card" style="padding: 10px; text-align: center;">
        <div style="font-size: 1.3rem; font-weight: 800; color: var(--accent-orange);">${fmt(fatMass, 1)}</div>
        <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 2px;">lbs fat</div>
      </div>
      <div class="card" style="padding: 10px; text-align: center;">
        <div style="font-size: 1.3rem; font-weight: 800; color: var(--accent-blue);">${fmt(leanMass, 1)}</div>
        <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 2px;">lbs lean</div>
      </div>
    </div>
  `

  document.getElementById('bf-save-btn').style.display = 'inline-flex'

  // Progress bar
  const maxBF = 30, minBF = 3, range = maxBF - minBF
  const currentPct = Math.max(0, Math.min(100, ((maxBF - avgBF) / range) * 100))
  const goalPct    = Math.max(0, Math.min(100, ((maxBF - goalBF) / range) * 100))
  const lbsToLose  = Math.max(0, fatMass - (goalBF / 100) * weight)

  document.getElementById('bf-progress-section').style.display = 'block'
  document.getElementById('bf-progress-fill').style.width      = currentPct + '%'
  document.getElementById('bf-goal-marker').style.left         = goalPct + '%'
  document.getElementById('bf-goal-label').textContent         = `Goal: ${goalBF}%`

  document.getElementById('bf-stats').innerHTML = `
    <div class="card" style="padding: 12px; text-align: center;">
      <div style="font-size: 1.2rem; font-weight: 800; color: var(--accent-green);">${fmt(goalBF, 1)}%</div>
      <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 2px;">Goal BF</div>
    </div>
    <div class="card" style="padding: 12px; text-align: center;">
      <div style="font-size: 1.2rem; font-weight: 800; color: var(--accent-yellow);">${fmt(Math.max(0, avgBF - goalBF), 1)}%</div>
      <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 2px;">BF to Lose</div>
    </div>
    <div class="card" style="padding: 12px; text-align: center;">
      <div style="font-size: 1.2rem; font-weight: 800; color: var(--accent-orange);">${fmt(lbsToLose, 1)}</div>
      <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 2px;">lbs fat to lose</div>
    </div>
  `
}

async function saveMeasurementResult() {
  if (lastBF === null) return
  const profile = state.profile
  profile.bodyFat = lastBF
  await window.api.store.saveProfile(profile)
  state.profile = profile
  toast(`Body fat saved: ${lastBF}%`, 'success')
}

// ─── Visual Estimate ────────────────────────────────────────────────────────

async function saveVisualEstimate() {
  if (visualBF === null) return
  const profile = state.profile
  profile.bodyFat = visualBF
  await window.api.store.saveProfile(profile)
  state.profile = profile
  toast(`Body fat saved: ~${visualBF}% (visual estimate)`, 'success')
}

// ─── Progress Photos ────────────────────────────────────────────────────────

async function uploadPhoto() {
  const date = document.getElementById('photo-date').value
  if (!date) { toast('Select a date for the photo', 'error'); return }

  const sourcePath = await window.api.photos.openDialog()
  if (!sourcePath) return

  const btn = document.getElementById('photo-upload-btn')
  btn.disabled = true
  btn.textContent = 'Saving...'

  const result = await window.api.photos.savePhoto(sourcePath, date)

  btn.disabled = false
  btn.textContent = '+ Add Photo'

  if (result.success) {
    toast(`Photo saved for ${fmtDate(date)}`, 'success')
    await loadPhotos()
  } else {
    toast('Failed to save photo', 'error')
  }
}

async function loadPhotos() {
  const photos  = await window.api.photos.getPhotos()
  const gridEl  = document.getElementById('photo-grid')
  const emptyEl = document.getElementById('photo-grid-empty')

  if (photos.length === 0) {
    emptyEl.style.display = 'block'
    gridEl.innerHTML = ''
    return
  }

  emptyEl.style.display = 'none'

  // Sort newest first
  const sorted = [...photos].sort((a, b) => b.date.localeCompare(a.date))

  gridEl.innerHTML = sorted.map(p => `
    <div class="photo-card" data-id="${p.id}">
      <div class="photo-thumb-wrap">
        <img class="photo-thumb" src="file://${p.path}" alt="Progress photo ${p.date}" loading="lazy">
      </div>
      <div class="photo-meta">
        <div class="photo-date">${fmtDate(p.date)}</div>
        <button class="btn-icon photo-delete-btn" data-id="${p.id}" title="Delete photo">&#x1F5D1;&#xFE0F;</button>
      </div>
    </div>
  `).join('')

  gridEl.querySelectorAll('.photo-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this progress photo? This cannot be undone.')) return
      await window.api.photos.deletePhoto(btn.dataset.id)
      toast('Photo deleted', 'info')
      await loadPhotos()
    })
  })
}
