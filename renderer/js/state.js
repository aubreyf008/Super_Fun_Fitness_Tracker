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
