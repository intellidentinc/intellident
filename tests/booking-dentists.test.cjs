const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')

function route(file, mocks) {
  const source = read(file).replace(/^import .*\r?\n/gm, '').replace(/export async function/g, 'async function')
  const context = vm.createContext({
    URL,
    ROLES: { PATIENT: 4 },
    NextResponse: { json: body => ({ body, headers: new Headers() }) },
    ...mocks,
  })
  vm.runInContext(`${source}\nglobalThis.handler = GET`, context)
  return context.handler
}

test('switching from CAB to KH returns KH service IDs without caching the previous clinic', async () => {
  let clinicId = 'CAB'
  const getAuthContext = async () => ({ role: 4, clinicId })
  const getServices = route('app/api/appointments/services/route.js', {
    getAuthContext,
    prisma: { service: { findMany: async ({ where }) => [{ id: `${where.clinicId}-consultation` }] } },
  })
  const cab = await getServices()
  assert.equal(cab.headers.get('Cache-Control'), 'private, no-store')
  clinicId = 'KH'
  const kh = await getServices()
  assert.equal(kh.body.services[0].id, 'KH-consultation')
  assert.equal(kh.headers.get('Cache-Control'), 'private, no-store')
  const getDentists = route('app/api/appointments/dentists/route.js', {
    getAuthContext,
    prisma: { dentist: { findMany: async ({ where }) => {
      const service = where.AND[0].services.some
      return service.clinicId === 'KH' && service.id === 'KH-consultation' ? [{ id: 'kh-dentist' }] : []
    } } },
  })
  const response = await getDentists({ url: `https://example.invalid/api/appointments/dentists?serviceIds=${kh.body.services[0].id}` })
  assert.equal(response.body.dentists[0].id, 'kh-dentist')
})

function dentistEffect() {
  const source = read('app/modules/schedules-page/BookAppointmentModal.jsx')
  const start = source.indexOf('  // Ignore obsolete responses')
  const end = source.indexOf('  // Fetch slots', start)
  const pending = []
  const state = {}
  let effect
  const context = vm.createContext({
    open: true, serviceIds: ['KH-consultation'],
    useEffect: fn => { effect = fn },
    fetch: (url, options) => {
      assert.equal(options.cache, 'no-store')
      return new Promise(resolve => pending.push(resolve))
    },
    setDentists: value => { state.dentists = value },
    setDentistsLoading: value => { state.loading = value },
    setDentistId() {}, setDate() {}, setTimeSlot() {}, setSlots() {},
    showToast: () => { state.error = true },
  })
  vm.runInContext(source.slice(start, end), context)
  return { effect, pending, state }
}
const flush = () => new Promise(resolve => setImmediate(resolve))

test('a slower obsolete dentist response cannot replace the current service assignments', async () => {
  const { effect, pending, state } = dentistEffect()
  const cleanup = effect()
  cleanup()
  effect()
  pending[1]({ ok: true, json: async () => ({ dentists: [{ id: 'current-dentist' }] }) })
  await flush()
  pending[0]({ ok: true, json: async () => ({ dentists: [] }) })
  await flush()
  assert.equal(state.dentists[0].id, 'current-dentist')
  assert.equal(state.loading, false)
})

test('obsolete failures do not clear current dentists or finish their loading state', async () => {
  const { effect, pending, state } = dentistEffect()
  const cleanup = effect()
  cleanup()
  effect()
  pending[0]({ ok: false })
  await flush()
  assert.equal(state.loading, true)
  assert.equal(state.error, undefined)
  pending[1]({ ok: true, json: async () => ({ dentists: [{ id: 'kh-dentist' }] }) })
  await flush()
  assert.equal(state.dentists[0].id, 'kh-dentist')
})

test('booking bypasses already-cached service catalogs', () => {
  assert.match(read('app/modules/schedules-page/BookAppointmentModal.jsx'), /fetch\('\/api\/appointments\/services', \{ cache: 'no-store' \}\)/)
})
