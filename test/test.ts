import { getLogger } from '@/index'

describe('smoke tests', () => {
  const log = getLogger('my-test-logger')

  test('can create logger', () => {
    expect(log).not.toBeFalsy()
  })
  test('can log trace', () => {
    log.trace('some trace log entry')
  })
  test('can log debug', () => {
    log.debug('some debug log entry')
  })
  test('can log info', () => {
    log.info('some info log entry')
  })
  test('can log warn', () => {
    log.warn('some warn log entry (ignore)')
  })
  test('can log error', () => {
    log.error('some error log entry (ignore)')
  })
})
