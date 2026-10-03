
interface InitState {
  list: LX.UserApi.UserApiInfo[]
  status: {
    status: boolean
    message?: string
  }
  apis: Record<string, LX.UserApi.UserApiRuntimeSources>
  qualityLists: Record<string, LX.QualityList>
  statuses: Record<string, { status: boolean, message?: string }>
}
const state: InitState = {
  list: [],
  status: {
    status: false,
    message: 'initing',
  },
  apis: {},
  qualityLists: {},
  statuses: {},
}


export {
  state,
}
