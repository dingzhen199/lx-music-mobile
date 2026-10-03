import actions from '@/store/player/action'
export const addTempPlayList = (items: LX.Player.TempPlayListItem[]) => { actions.addTempPlayList(items) }
export const removeTempPlayList = (index: number) => { actions.removeTempPlayList(index) }
