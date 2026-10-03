import { describe, expect, it } from 'vitest'
import { isReactive, reactive, toRaw } from '@vue/runtime-core'
import defaultSetting from '@/config/defaultSetting'
import { stripSensitiveSetting } from './sensitiveSetting'

const buildSetting = () => ({
  'ai.enable': true,
  'ai.provider': 'openai-compatible',
  'ai.baseUrl': 'https://api.openai.com/v1',
  'ai.apiKey': 'sk-secret-key',
  'ai.model': 'gpt-4o-mini',
  'common.lang': 'zh-cn',
} as unknown as LX.AppSetting)

describe('stripSensitiveSetting - 备份导出剔除 API Key', () => {
  it('apiKey 被清空，其余 ai 配置保留', () => {
    // arrange
    const setting = buildSetting()

    // act
    const result = stripSensitiveSetting(setting)

    // assert
    expect(result['ai.apiKey']).toBe('')
    expect(result['ai.model']).toBe('gpt-4o-mini')
    expect(result['ai.baseUrl']).toBe('https://api.openai.com/v1')
  })

  it('不改动入参对象', () => {
    // arrange
    const setting = buildSetting()

    // act
    stripSensitiveSetting(setting)

    // assert
    expect(setting['ai.apiKey']).toBe('sk-secret-key')
  })

  it('apiKey 本就为空时原样返回副本', () => {
    // arrange
    const setting = buildSetting()
    setting['ai.apiKey'] = ''

    // act
    const result = stripSensitiveSetting(setting)

    // assert
    expect(result['ai.apiKey']).toBe('')
    expect(result['ai.model']).toBe('gpt-4o-mini')
  })
})

describe.each([
  { name: '默认设置', overrides: {} },
  {
    name: '已配置主备源与 AI Key',
    overrides: {
      'common.apiSource': 'user_api_primary',
      'common.apiSourceBackups': ['user_api_backup_1', 'user_api_backup_2'],
      'ai.apiKey': 'sk-secret-key',
      'ai.model': 'configured-model',
      'ai.baseUrl': 'https://example.com/v1',
    },
  },
])('响应式设置经过移动端 JSON 持久化边界：$name', ({ overrides }) => {
  it.each(['setting_v2', 'allData_v2'] as const)('%s 可传输且只剔除 API Key', async(type) => {
    const setting = reactive<LX.AppSetting>({ ...defaultSetting, ...overrides })
    const original = structuredClone(toRaw(setting))
    expect(isReactive(setting['common.apiSourceBackups'])).toBe(true)

    const exported = stripSensitiveSetting(setting)
    // 与 SettingBackup.vue 的两种导出格式一致；不在测试中提前 JSON 化或解开代理。
    const payload = type == 'setting_v2'
      ? { type, data: exported }
      : { type, setting: exported, playList: [] }
    const expectedSetting = { ...original, 'ai.apiKey': '' }
    const expectedPayload = type == 'setting_v2'
      ? { type, data: expectedSetting }
      : { type, setting: expectedSetting, playList: [] }
    const serialized = JSON.stringify(payload)
    expect(JSON.parse(serialized)).toEqual(expectedPayload)
    expect(serialized).not.toContain('sk-secret-key')
    expect(exported).not.toBe(setting)
    expect(setting).toEqual(original)
  })
})
