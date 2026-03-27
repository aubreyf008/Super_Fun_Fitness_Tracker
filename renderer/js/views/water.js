import { state } from '../state.js'
import { toast } from '../ui.js'

const GOAL_OZ = 128
// Bottle fill area: y goes from ~36 (top of body) to 188 (bottom), total height ~152px
const BOTTLE_TOP = 36
const BOTTLE_BOTTOM = 188
const BOTTLE_HEIGHT = BOTTLE_BOTTOM - BOTTLE_TOP  // 152

export async function init() {
  const oz = await window.api.store.getWater(state.todayKey)
  render(oz)
  bindEvents()
}

function bindEvents() {
  document.querySelectorAll('.quick-add').forEach(btn => {
    btn.addEventListener('click', () => addWater(parseInt(btn.dataset.oz)))
  })

  document.getElementById('water-custom-btn').addEventListener('click', () => {
    const val = parseInt(document.getElementById('water-custom').value)
    if (!val || val < 1) { toast('Enter a valid amount', 'error'); return }
    document.getElementById('water-custom').value = ''
    addWater(val)
  })

  document.getElementById('water-custom').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('water-custom-btn').click()
  })

  document.getElementById('water-reset-btn').addEventListener('click', async () => {
    await window.api.store.resetWater(state.todayKey)
    render(0)
    toast('Water reset to 0', 'info')
  })
}

async function addWater(oz) {
  const res = await window.api.store.addWater(state.todayKey, oz)
  if (res.success) {
    render(res.total)
    const msg = res.total >= GOAL_OZ ? '🎉 Goal reached!' : `+${oz} oz logged`
    toast(msg, res.total >= GOAL_OZ ? 'success' : 'info')
  }
}

function render(oz) {
  const capped = Math.min(oz, GOAL_OZ)
  const pct    = capped / GOAL_OZ

  // update text
  document.getElementById('water-oz-display').textContent = Math.round(oz)
  document.getElementById('water-pct-label').textContent  = `${Math.round(pct * 100)}% of goal`

  // animate bottle fill — rect grows upward from bottom
  const fillHeight = Math.round(pct * BOTTLE_HEIGHT)
  const fillY      = BOTTLE_BOTTOM - fillHeight
  const fillRect   = document.getElementById('water-fill-rect')
  const waveRect   = document.getElementById('wave-rect')
  if (fillRect) {
    fillRect.setAttribute('y', fillY)
    fillRect.setAttribute('height', fillHeight + 2)
  }
  if (waveRect) {
    waveRect.setAttribute('y', fillY - 3)
  }

  // bottle color shifts blue → deep blue as it fills
  if (fillRect) {
    const opacity = 0.35 + pct * 0.45
    fillRect.setAttribute('opacity', opacity.toFixed(2))
  }

  // progress bar
  const bar = document.getElementById('water-progress-bar')
  if (bar) bar.style.width = Math.min(100, pct * 100) + '%'

  // milestones
  renderMilestones(oz)
}

function renderMilestones(oz) {
  const el = document.getElementById('water-milestones')
  if (!el) return

  const milestones = [
    { oz: 32,  label: '¼ gallon',  icon: '💧' },
    { oz: 64,  label: '½ gallon',  icon: '💧💧' },
    { oz: 96,  label: '¾ gallon',  icon: '💧💧💧' },
    { oz: 128, label: '1 gallon!', icon: '🎉' }
  ]

  el.innerHTML = milestones.map(m => {
    const done = oz >= m.oz
    return `
      <div style="display:flex; align-items:center; gap:10px; opacity:${done ? '1' : '0.4'};">
        <span style="font-size:1rem;">${m.icon}</span>
        <div class="progress-bar-wrap" style="flex:1; height:6px;">
          <div class="progress-bar-fill" style="width:${Math.min(100, (oz / m.oz) * 100)}%; background:var(--accent-blue);"></div>
        </div>
        <span style="font-size:0.75rem; color:${done ? 'var(--accent-blue)' : 'var(--text-muted)'}; min-width:64px; text-align:right;">
          ${m.label} ${done ? '✓' : `(${Math.max(0, m.oz - Math.round(oz))} oz left)`}
        </span>
      </div>
    `
  }).join('')
}
