import { describe, it, expect } from 'vitest'
import { maintenanceStatus, latestOdometerByBus } from '@/lib/fuel/maintenance'

describe('maintenanceStatus', () => {
  it('calcule km depuis entretien et km restants', () => {
    const s = maintenanceStatus({ service_interval_km: 15000, last_service_km: 100000 }, 108000)
    expect(s?.kmSinceService).toBe(8000)
    expect(s?.kmRemaining).toBe(7000)
    expect(s?.due).toBe(false)
  })
  it('signale une révision due quand il reste moins de 10 %', () => {
    const s = maintenanceStatus({ service_interval_km: 15000, last_service_km: 100000 }, 114000)
    expect(s?.due).toBe(true) // 1000 restants < 1500
  })
  it('renvoie null sans intervalle ou sans odomètre', () => {
    expect(maintenanceStatus({ service_interval_km: null, last_service_km: 0 }, 1000)).toBeNull()
    expect(maintenanceStatus({ service_interval_km: 15000, last_service_km: 0 }, null)).toBeNull()
  })
})

describe('latestOdometerByBus', () => {
  it('retient le plus grand odomètre par bus (casse/espaces ignorés)', () => {
    const map = latestOdometerByBus([
      { bus_number: 'CG 6377', odometer_km: 100000 },
      { bus_number: 'cg6377', odometer_km: 105000 },
      { bus_number: 'BM 1', odometer_km: null },
    ])
    expect(map.get('CG6377')).toBe(105000)
    expect(map.has('BM1')).toBe(false)
  })
})
