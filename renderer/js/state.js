export function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const state = {
  todayKey: localDateKey(),
  profile: null,
  todayMeals: [],
  streaks: { current: 0, longest: 0, lastLoggedDate: null }
}

export function computeTotals(meals) {
  return meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories || 0),
      protein:  acc.protein  + (m.protein  || 0),
      carbs:    acc.carbs    + (m.carbs     || 0),
      fat:      acc.fat      + (m.fat       || 0)
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
}

export function computeRemaining(profile, totals) {
  return {
    calories: Math.max(0, (profile.dailyCalTarget || 2300) - totals.calories),
    protein:  Math.max(0, (profile.proteinTarget  || 190)  - totals.protein),
    carbs:    Math.max(0, (profile.carbTarget      || 215)  - totals.carbs),
    fat:      Math.max(0, (profile.fatTarget       || 68)   - totals.fat)
  }
}

// Activity multipliers for Mifflin-St Jeor TDEE
const ACTIVITY_MULTS = {
  sedentary:   1.2,
  light:       1.375,
  moderate:    1.55,
  active:      1.725,
  very_active: 1.9
}

const DEFICITS  = { slow: 250, moderate: 500, aggressive: 750 }
const SURPLUSES = { slow: 150, moderate: 300, aggressive: 500 }

/**
 * Compute TDEE and daily macro targets from profile.
 * Returns { tdee, dailyCalTarget, proteinTarget, carbTarget, fatTarget }
 */
export function computeGoalTargets(profile) {
  const weight       = profile.weight        || 180
  const height       = profile.height        || 69
  const age          = profile.age           || 30
  const goalType     = profile.goalType      || 'cut'
  const aggr         = profile.aggressiveness || 'moderate'
  const actLevel     = profile.activityLevel  || 'moderate'

  // Mifflin-St Jeor BMR (assuming male — Session 4 can add sex field if needed)
  const weightKg = weight / 2.205
  const heightCm = height * 2.54
  const bmr      = 10 * weightKg + 6.25 * heightCm - 5 * age + 5
  const tdee     = Math.round(bmr * (ACTIVITY_MULTS[actLevel] || 1.55))

  let calories
  if (goalType === 'cut')       calories = tdee - (DEFICITS[aggr]  || 500)
  else if (goalType === 'bulk') calories = tdee + (SURPLUSES[aggr] || 300)
  else                          calories = tdee  // maintain or recomp

  // Protein: 1g/lb cut/recomp, 0.9g/lb bulk, 0.8g/lb maintain
  const proteinPerLb = goalType === 'maintain' ? 0.8 : goalType === 'bulk' ? 0.9 : 1.0
  const protein = Math.round(weight * proteinPerLb)

  // Fat: minimum 0.35g/lb for hormonal health
  const fat = Math.round(weight * 0.35)

  // Carbs fill remaining calories (protein=4cal/g, fat=9cal/g, carbs=4cal/g)
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4))

  return { tdee, dailyCalTarget: calories, proteinTarget: protein, carbTarget: carbs, fatTarget: fat }
}
