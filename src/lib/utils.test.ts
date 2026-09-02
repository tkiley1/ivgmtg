import { describe, expect, it } from 'vitest'
import { formatDateTime, localDateTimeInZone } from './utils'

describe('localDateTimeInZone', () => {
  it('converts an event-local time to the correct instant', () => {
    const date = localDateTimeInZone('2026-09-04T18:30', 'America/New_York')
    expect(date.toISOString()).toBe('2026-09-04T22:30:00.000Z')
    expect(formatDateTime(date, 'America/New_York')).toContain('6:30 PM')
  })

  it('rejects nonexistent daylight-saving times and unknown zones', () => {
    expect(() => localDateTimeInZone('2026-03-08T02:30', 'America/New_York')).toThrow()
    expect(() => localDateTimeInZone('2026-09-04T18:30', 'Not/A_Zone')).toThrow()
  })
})
