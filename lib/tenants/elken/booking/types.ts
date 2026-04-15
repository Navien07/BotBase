// ELKEN TENANT PLUGIN — do not import outside lib/tenants/elken/

export type ElkenBookingStep =
  | 'location'
  | 'facility'
  | 'datetime_and_details'
  | 'member_id'
  | 'bes_device'
  | 'trial_type'
  | 'confirmed'

export type ElkenLang = 'en' | 'bm' | 'zh'
export type ElkenTrialType = 'back' | 'foot'
export type ElkenDuration = '30min' | '60min' | '90min'

export interface ElkenBookingState {
  step: ElkenBookingStep
  location?: 'okr' | 'subang'
  facility?: string
  preferred_datetime?: string
  customer_name?: string
  contact?: string
  is_member?: boolean
  member_id?: string
  bes_device?: boolean
  trial_type?: ElkenTrialType
  duration?: ElkenDuration
  lang: ElkenLang
  created_at: number   // TTL: expire after 30 minutes
  bot_id: string
}
