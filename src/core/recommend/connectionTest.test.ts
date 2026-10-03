import { expect, it, vi } from 'vitest'
import { createConnectionTest } from './connectionTest'
it('connection test exposes needConfig/testing/ok, rejects repeated presses while pending', async() => {
  let release!: () => void
  const request = vi.fn(async() => new Promise<void>(resolve => { release = resolve }))
  const report = vi.fn()
  const test = createConnectionTest(request, report)
  await test({ apiKey: '', model: '' })
  expect(report).toHaveBeenLastCalledWith('needConfig', '')
  expect(request).not.toHaveBeenCalled()
  const pending = test({ apiKey: 'secret', model: 'model' })
  expect(report).toHaveBeenLastCalledWith('testing', '')
  await test({ apiKey: 'secret', model: 'model' })
  expect(request).toHaveBeenCalledOnce()
  release(); await pending
  expect(report).toHaveBeenLastCalledWith('ok', '')
})
it('failure is visible, credential redacted and retry remains available', async() => {
  const request = vi.fn().mockRejectedValueOnce(new Error('401 secret')).mockResolvedValueOnce({})
  const report = vi.fn(); const test = createConnectionTest(request, report)
  await test({ apiKey: 'secret', model: 'model' })
  expect(report).toHaveBeenLastCalledWith('fail', '401 [redacted]')
  await test({ apiKey: 'secret', model: 'model' })
  expect(report).toHaveBeenLastCalledWith('ok', '')
})
