// ELKEN TENANT PLUGIN — single export point

export { ELKEN_BOT_ID, ELKEN_TENANT_ID, ELKEN_LOCATIONS, ELKEN_FACILITIES } from './config'
export { handleElkenBookingFlow } from './booking/state-machine'
export type { ElkenBookingState, ElkenBookingStep, ElkenLang } from './booking/types'
