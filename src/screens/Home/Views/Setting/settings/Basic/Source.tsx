import { memo, useCallback, useMemo, useRef } from 'react'

import { View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import { createStyle } from '@/utils/tools'
import { setApiSource, setUserApiBackups } from '@/core/apiSource'
import { useI18n } from '@/lang'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { useSettingValue } from '@/store/setting/hook'
import { useStatus, useUserApiList, useApiStatuses } from '@/store/userApi'
import Button from '../../components/Button'
import UserApiEditModal, { type UserApiEditModalType } from './UserApiEditModal'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
// import { importUserApi, removeUserApi } from '@/core/userApi'

const apiSourceList = apiSourceInfo.map(api => ({
  id: api.id,
  name: api.name,
  disabled: api.disabled,
}))

const useActive = (id: string) => {
  const activeLangId = useSettingValue('common.apiSource')
  const isActive = useMemo(() => activeLangId == id, [activeLangId, id])
  return isActive
}

const Item = ({ id, name, desc, statusLabel, change }: {
  id: string
  name: string
  desc?: string
  statusLabel?: string
  change: (id: string) => void
}) => {
  const isActive = useActive(id)
  const theme = useTheme()
  // const [toggleCheckBox, setToggleCheckBox] = useState(false)
  return (
    <CheckBox marginBottom={5} check={isActive} onChange={() => { change(id) }} need>
      <Text style={styles.sourceLabel}>
        {name}
        {
          desc ? <Text style={styles.sourceDesc} color={theme['c-500']} size={13}>  {desc}</Text> : null
        }
        {
          statusLabel ? <Text style={styles.sourceStatus} size={13}>  {statusLabel}</Text> : null
        }
      </Text>
    </CheckBox>
  )
}

export default memo(() => {
  const t = useI18n()
  const list = useMemo(() => apiSourceList.map(s => ({
    // @ts-expect-error
    name: t(`setting_basic_source_${s.id}`) || s.name,
    id: s.id,
  })), [t])
  const setApiSourceId = useCallback((id: string) => {
    setApiSource(id)
  }, [])
  const userApiListRaw = useUserApiList()
  const apiStatus = useStatus()
  const apiSourceSetting = useSettingValue('common.apiSource')
  const backups = useSettingValue('common.apiSourceBackups')
  const statuses = useApiStatuses()
  const toggleBackup = (id: string) => {
    setUserApiBackups(backups.includes(id) ? backups.filter(value => value !== id) : [...backups, id])
  }
  const moveBackup = (id: string, delta: number) => {
    const index = backups.indexOf(id)
    const nextIndex = index + delta
    if (index < 0 || nextIndex < 0 || nextIndex >= backups.length) return
    const next = [...backups]
    ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
    setUserApiBackups(next)
  }
  const userApiList = useMemo(() => {
    const getApiStatus = (id: string) => {
      const current = statuses[id] ?? apiStatus
      let status
      if (current.status) status = t('setting_basic_source_status_success')
      else if (current.message == 'initing') status = t('setting_basic_source_status_initing')
      else status = t('setting_basic_source_status_failed')

      return status
    }
    return userApiListRaw.map(api => {
      const statusLabel = api.id == apiSourceSetting || backups.includes(api.id) ? `[${getApiStatus(api.id)}]` : ''
      return {
        id: api.id,
        name: api.name,
        label: `${api.name}${statusLabel}`,
        desc: [/^\d/.test(api.version) ? `v${api.version}` : api.version].filter(Boolean).join(', '),
        statusLabel,
        // status: apiStatus.status,
        // message: apiStatus.message,
        // disabled: false,
      }
    })
  }, [userApiListRaw, apiStatus, apiSourceSetting, backups, statuses, t])

  const modalRef = useRef<UserApiEditModalType>(null)
  const handleShow = () => {
    modalRef.current?.show()
  }

  return (
    <SubTitle title={t('setting_basic_source')}>
      <View style={styles.list}>
        {
          list.map(({ id, name }) => <Item name={name} id={id} key={id} change={setApiSourceId} />)
        }
        {
          userApiList.map(({ id, name, desc, statusLabel }) => (
            <View key={id}>
              <Item name={name} desc={desc} statusLabel={statusLabel} id={id} change={setApiSourceId} />
              {id !== apiSourceSetting ? (
                <View style={styles.backupRow}>
                  <CheckBox check={backups.includes(id)} onChange={() => { toggleBackup(id) }} label={`${t('setting_basic_source_backup')}${backups.includes(id) ? ` ${backups.indexOf(id) + 1}` : ''}`} />
                  {backups.includes(id) ? (
                    <>
                      <Button onPress={() => { moveBackup(id, -1) }}>{t('setting_basic_source_backup_up')}</Button>
                      <Button onPress={() => { moveBackup(id, 1) }}>{t('setting_basic_source_backup_down')}</Button>
                    </>
                  ) : null}
                </View>
              ) : null}
            </View>
          ))
        }
      </View>
      <Text size={12}>{t('setting_basic_source_backup_order')}</Text>
      <View style={styles.btn}>
        <Button onPress={handleShow}>{t('setting_basic_source_user_api_btn')}</Button>
      </View>
      <UserApiEditModal ref={modalRef} />
    </SubTitle>
  )
})

const styles = createStyle({
  list: {
    flexGrow: 0,
    flexShrink: 1,
    // flexDirection: 'row',
    // flexWrap: 'wrap',
  },
  backupRow: {
    paddingLeft: 20,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  btn: {
    marginTop: 10,
    flexDirection: 'row',
  },
  sourceLabel: {

  },
  sourceDesc: {

  },
  sourceStatus: {

  },
})
