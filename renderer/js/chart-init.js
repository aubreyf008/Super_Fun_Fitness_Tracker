// Configure Chart.js global defaults for dark athletic theme
// Called once after Chart.js UMD is loaded

export function initChartDefaults() {
  if (typeof Chart === 'undefined') return

  Chart.defaults.color            = '#a0aec0'
  Chart.defaults.borderColor      = '#2d3748'
  Chart.defaults.backgroundColor  = 'rgba(104,211,145,0.1)'
  Chart.defaults.font.family      = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
  Chart.defaults.font.size        = 12
  Chart.defaults.animation.duration = 400

  Chart.defaults.plugins.legend.display = false
  Chart.defaults.plugins.tooltip.backgroundColor = '#1a1f2e'
  Chart.defaults.plugins.tooltip.borderColor = '#2d3748'
  Chart.defaults.plugins.tooltip.borderWidth = 1
  Chart.defaults.plugins.tooltip.titleColor = '#f7fafc'
  Chart.defaults.plugins.tooltip.bodyColor  = '#a0aec0'
  Chart.defaults.plugins.tooltip.padding    = 12
  Chart.defaults.plugins.tooltip.cornerRadius = 8

  Chart.defaults.scale.grid.color = 'rgba(45,55,72,0.6)'
  Chart.defaults.scale.ticks.color = '#a0aec0'
}
