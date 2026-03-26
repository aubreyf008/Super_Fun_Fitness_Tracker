import { toast } from '../ui.js'

let onCompleteCallback = null

const steps = [0, 1, 2]
let currentStep = 0

function showStep(n) {
  steps.forEach(i => {
    document.getElementById(`step-${i}`).classList.toggle('active', i === n)
    const dot = document.getElementById(`dot-${i}`)
    dot.classList.toggle('active', i === n)
    dot.classList.toggle('done', i < n)
  })
  currentStep = n
}

function validate0() {
  const name   = document.getElementById('onb-name').value.trim()
  const weight = parseFloat(document.getElementById('onb-weight').value)
  const height = parseFloat(document.getElementById('onb-height').value)
  const bf     = parseFloat(document.getElementById('onb-bodyfat').value)
  if (!name) { toast('Please enter your name', 'error'); return false }
  if (!weight || weight < 50) { toast('Enter a valid weight', 'error'); return false }
  if (!height || height < 48) { toast('Enter height in inches (e.g. 69 for 5\'9")', 'error'); return false }
  if (!bf || bf < 3 || bf > 60) { toast('Enter a valid body fat %', 'error'); return false }
  return true
}

function validate1() {
  const goalBf  = parseFloat(document.getElementById('onb-goalbf').value)
  const cal     = parseInt(document.getElementById('onb-cal').value)
  const protein = parseInt(document.getElementById('onb-protein').value)
  const carbs   = parseInt(document.getElementById('onb-carbs').value)
  const fat     = parseInt(document.getElementById('onb-fat').value)
  if (!goalBf || goalBf < 3) { toast('Enter a valid goal body fat %', 'error'); return false }
  if (!cal || cal < 1000) { toast('Enter a valid calorie target', 'error'); return false }
  if (!protein || !carbs || !fat) { toast('Fill in all macro targets', 'error'); return false }
  return true
}

async function finish() {
  const btn = document.getElementById('step2-finish')
  btn.disabled = true
  btn.textContent = 'Saving...'

  const profile = {
    name:           document.getElementById('onb-name').value.trim(),
    weight:         parseFloat(document.getElementById('onb-weight').value),
    height:         parseFloat(document.getElementById('onb-height').value),
    bodyFat:        parseFloat(document.getElementById('onb-bodyfat').value),
    goalBodyFat:    parseFloat(document.getElementById('onb-goalbf').value),
    dailyCalTarget: parseInt(document.getElementById('onb-cal').value),
    proteinTarget:  parseInt(document.getElementById('onb-protein').value),
    carbTarget:     parseInt(document.getElementById('onb-carbs').value),
    fatTarget:      parseInt(document.getElementById('onb-fat').value),
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

  // Pre-fill with defaults from CLAUDE.md
  document.getElementById('onb-weight').value  = '180'
  document.getElementById('onb-height').value  = '69'
  document.getElementById('onb-bodyfat').value = '18.5'
  document.getElementById('onb-goalbf').value  = '12.5'
  document.getElementById('onb-cal').value     = '2300'
  document.getElementById('onb-protein').value = '190'
  document.getElementById('onb-carbs').value   = '215'
  document.getElementById('onb-fat').value     = '68'

  document.getElementById('step0-next').addEventListener('click', () => {
    if (validate0()) showStep(1)
  })
  document.getElementById('step1-back').addEventListener('click', () => showStep(0))
  document.getElementById('step1-next').addEventListener('click', () => {
    if (validate1()) showStep(2)
  })
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
