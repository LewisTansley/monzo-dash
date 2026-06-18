const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function defaultAutoTriggerForm() {
  const today = new Date().toISOString().slice(0, 10)
  return {
    enabled: false,
    mode: 'conditions',
    schedule: {
      type: 'weekly',
      time: '09:00',
      daysOfWeek: [5],
      dayOfMonth: 1,
      intervalDays: 14,
      anchorDate: today
    },
    frequency: 'once_per_day'
  }
}

export function autoTriggerToForm(autoTrigger) {
  const defaults = defaultAutoTriggerForm()
  if (!autoTrigger) return defaults

  return {
    enabled: autoTrigger.enabled === true,
    mode: autoTrigger.mode || defaults.mode,
    schedule: {
      ...defaults.schedule,
      ...(autoTrigger.schedule || {}),
      daysOfWeek: [...(autoTrigger.schedule?.daysOfWeek || defaults.schedule.daysOfWeek)]
    },
    frequency: autoTrigger.frequency || defaults.frequency
  }
}

export function autoTriggerToPayload(form) {
  const schedule = {
    type: form.schedule.type,
    time: form.schedule.time || '09:00',
    daysOfWeek: (form.schedule.daysOfWeek || []).map(Number),
    dayOfMonth: Number(form.schedule.dayOfMonth) || 1,
    intervalDays: Number(form.schedule.intervalDays) || 1,
    anchorDate: form.schedule.anchorDate || new Date().toISOString().slice(0, 10)
  }

  let frequency = form.frequency
  if (form.mode === 'schedule' || form.mode === 'schedule_and_conditions') {
    if (!frequency || frequency === 'once_per_day') {
      frequency = 'once_per_window'
    }
  } else if (!frequency) {
    frequency = 'once_per_day'
  }

  return {
    enabled: form.enabled === true,
    mode: form.mode,
    schedule,
    frequency
  }
}

export function toggleDayOfWeek(days, day) {
  const set = new Set(days)
  if (set.has(day)) set.delete(day)
  else set.add(day)
  return [...set].sort((a, b) => a - b)
}

export { DAY_LABELS }
