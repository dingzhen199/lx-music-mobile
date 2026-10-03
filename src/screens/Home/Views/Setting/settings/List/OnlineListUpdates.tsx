import { memo, useEffect, useState } from 'react'
import { View } from 'react-native'
import { useMyList, useListFetching } from '@/store/list/hook'
import { getListUpdateInfo, setListAutoUpdate } from '@/utils/data'
import syncSourceList from '@/core/syncSourceList'
import { toast } from '@/utils/tools'
import { useI18n } from '@/lang'
import Text from '@/components/common/Text'
import CheckBox from '@/components/common/CheckBox'
import Button from '../../components/Button'
import SubTitle from '../../components/SubTitle'

const Item = ({ list }: { list: LX.List.UserListInfo }) => {
  const t = useI18n()
  const fetching = useListFetching(list.id)
  const [info, setInfo] = useState<LX.List.ListUpdateInfo[string]>()
  const reload = () => {
    void getListUpdateInfo().then(value => { setInfo(value[list.id] ? { ...value[list.id] } : undefined) }).catch(console.warn)
  }
  useEffect(reload, [list.id, fetching])
  const toggle = (enabled: boolean) => {
    void setListAutoUpdate(list.id, enabled).then(reload).catch((error: Error) => { toast(error.message, 'long') })
  }
  const update = () => {
    void syncSourceList(list).catch(() => {}).finally(reload)
  }
  return (
    <View style={{ marginBottom: 12 }}>
      <Text>{list.name} ({list.source})</Text>
      <CheckBox check={info?.isAutoUpdate !== false} onChange={toggle} label={t('list_auto_update')} />
      <Text size={12}>{info?.updateTime ? new Date(info.updateTime).toLocaleString() : t('list_update_never')}</Text>
      {info?.updateError ? <Text size={12}>{t('list_update_error', { name: list.name })}: {info.updateError}</Text> : null}
      <Button disabled={fetching} onPress={update}>{t('list_sync')}</Button>
    </View>
  )
}

export default memo(() => {
  const t = useI18n()
  const lists = useMyList().filter((list): list is LX.List.UserListInfo => 'sourceListId' in list && !!list.source && !!list.sourceListId)
  if (!lists.length) return null
  return (
    <SubTitle title={t('list_update_manage')}>
      {lists.map(list => <Item list={list} key={list.id} />)}
    </SubTitle>
  )
})
