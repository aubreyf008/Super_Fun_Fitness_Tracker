// ── Progress Ring ──────────────────────────────────────────────────
export function createRing({ id, size = 100, strokeWidth = 8, color, value, max, label, unit = '' }) {
  const r = (size / 2) - strokeWidth
  const circumference = 2 * Math.PI * r
  const pct = Math.min(1, max > 0 ? value / max : 0)
  const offset = circumference * (1 - pct)
  const displayVal = Math.round(value)

  return `
    <div class="ring-container">
      <div class="ring-wrap">
        <svg width="${size}" height="${size}">
          <circle class="ring-track" cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${strokeWidth}"/>
          <circle class="ring-fill"
            cx="${size/2}" cy="${size/2}" r="${r}"
            stroke-width="${strokeWidth}"
            stroke="${color}"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${offset}"
            id="ring-fill-${id}"/>
        </svg>
        <div class="ring-center-text">
          <span class="ring-value" style="color:${color}">${displayVal}</span>
          <span class="ring-unit">${unit}</span>
        </div>
      </div>
      <div class="ring-label">${label}</div>
      <div class="ring-sub">${Math.round(max - value) > 0 ? Math.round(max - value) + ' left' : '<span style="color:var(--accent-red)">over!</span>'}</div>
    </div>
  `
}

export function updateRingFill(id, value, max, color) {
  const el = document.getElementById(`ring-fill-${id}`)
  if (!el) return
  const r = parseFloat(el.getAttribute('r'))
  const circumference = 2 * Math.PI * r
  const pct = Math.min(1, max > 0 ? value / max : 0)
  el.style.strokeDashoffset = circumference * (1 - pct)
}

// ── Toast Notifications ────────────────────────────────────────────
export function toast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container')
  if (!container) return
  const el = document.createElement('div')
  el.className = `toast ${type}`
  el.textContent = message
  container.appendChild(el)
  setTimeout(() => {
    el.style.animation = 'fadeOut 0.3s ease forwards'
    setTimeout(() => el.remove(), 300)
  }, duration)
}

// ── Macro Pills ────────────────────────────────────────────────────
export function macroPills({ calories, protein, carbs, fat }) {
  return `
    <div class="macro-pills">
      <div class="macro-pill green"><span class="pill-val">${Math.round(calories)}</span><span class="pill-label">cal</span></div>
      <div class="macro-pill blue"><span class="pill-val">${Math.round(protein)}g</span><span class="pill-label">protein</span></div>
      <div class="macro-pill orange"><span class="pill-val">${Math.round(carbs)}g</span><span class="pill-label">carbs</span></div>
      <div class="macro-pill yellow"><span class="pill-val">${Math.round(fat)}g</span><span class="pill-label">fat</span></div>
    </div>
  `
}

// ── Number formatting ──────────────────────────────────────────────
export function fmt(n, decimals = 0) {
  return Number(n).toFixed(decimals)
}

export function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
