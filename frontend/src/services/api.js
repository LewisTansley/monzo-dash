import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
})

export default api

export const vaultApi = {
  status: () => api.get('/vault/status'),
  init: (passphrase) => api.post('/vault/init', { passphrase }),
  unlock: (passphrase) => api.post('/vault/unlock', { passphrase }),
  lock: () => api.post('/vault/lock'),
  getMonzoCredentials: () => api.get('/vault/monzo-credentials'),
  getMonzoSetup: () => api.get('/vault/monzo-setup'),
  setMonzoCredentials: ({ clientId, clientSecret }) => {
    const body = { clientId }
    if (clientSecret !== undefined) {
      body.clientSecret = clientSecret
    }
    return api.put('/vault/monzo-credentials', body)
  }
}

export const authApi = {
  monzoUrl: () => api.get('/auth/monzo/url'),
  diagnose: () => api.get('/monzo/setup/diagnose'),
  completeSetup: () => api.post('/monzo/setup/complete')
}

export const monzoApi = {
  balance: () => api.get('/monzo/balance'),
  pots: () => api.get('/monzo/pots'),
  transactions: (params) => api.get('/monzo/transactions', { params }),
  transactionMonth: (month) =>
    api.get('/monzo/transactions', { params: month ? { month } : {} })
}

export const analyticsApi = {
  summary: (period) => api.get('/analytics/summary', { params: { period } }),
  projections: () => api.get('/analytics/projections')
}

export const automationsApi = {
  list: () => api.get('/automations'),
  get: (id) => api.get(`/automations/${id}`),
  create: (data) => api.post('/automations', data),
  update: (id, data) => api.put(`/automations/${id}`, data),
  delete: (id) => api.delete(`/automations/${id}`),
  dryRun: (id) => api.post(`/automations/${id}/dry-run`),
  run: (id) => api.post(`/automations/${id}/run`)
}

export const automationGroupsApi = {
  list: () => api.get('/automation-groups'),
  get: (id) => api.get(`/automation-groups/${id}`),
  create: (data) => api.post('/automation-groups', data),
  update: (id, data) => api.put(`/automation-groups/${id}`, data),
  delete: (id) => api.delete(`/automation-groups/${id}`),
  dryRun: (id) => api.post(`/automation-groups/${id}/dry-run`),
  run: (id) => api.post(`/automation-groups/${id}/run`)
}

export const budgetsApi = {
  get: () => api.get('/budgets'),
  set: (budgets) => api.put('/budgets', { budgets })
}

export const budgetApi = {
  get: () => api.get('/budget'),
  createItem: (data) => api.post('/budget/items', data),
  updateItem: (id, data) => api.put(`/budget/items/${id}`, data),
  deleteItem: (id) => api.delete(`/budget/items/${id}`)
}
