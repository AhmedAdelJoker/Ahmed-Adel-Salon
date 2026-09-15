export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function firstDayOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}
