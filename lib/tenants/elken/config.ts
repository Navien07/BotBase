// ELKEN TENANT PLUGIN — do not import outside lib/tenants/elken/

export const ELKEN_BOT_ID = '21794953-b13f-4e5f-984a-1536c453461d' as const
export const ELKEN_TENANT_ID = '9bd271da-955b-41bb-aadc-b9733ae5c585' as const

export const ELKEN_LOCATIONS = {
  okr: {
    id: 'okr',
    name: 'GenQi Old Klang Road',
    phone: '012-2208396',
    email: 'genqigex@gmail.com',
    hours: { open: '10:00', close: '22:00', days: 'daily' },
    closedOn: ['cny', 'raya', 'deepavali', 'christmas'],
  },
  subang: {
    id: 'subang',
    name: 'GenQi Subang',
    phone: '012-2206215',
    email: 'genqics@gmail.com',
    hours: { open: '10:00', close: '18:30', days: 'weekdays' },
    closedOn: ['weekends', 'public_holidays'],
  },
} as const

export const ELKEN_FACILITIES = {
  bed_female: {
    id: 'bed_female',
    label: { en: 'Female Bed', bm: 'Katil Wanita', zh: '女性床位' },
    locations: ['okr', 'subang'] as const,
    duration: 90,
    lastBooking: { okr: '20:00', subang: '16:45' },
    capacity: { okr: 5, subang: 5 },
    besAvailable: true,
    besUnits: { okr: 5, subang: 4 },
  },
  bed_male: {
    id: 'bed_male',
    label: { en: 'Male Bed', bm: 'Katil Lelaki', zh: '男性床位' },
    locations: ['okr', 'subang'] as const,
    duration: 90,
    lastBooking: { okr: '20:00', subang: '16:45' },
    capacity: { okr: 2, subang: 2 },
    besAvailable: false,
  },
  bed_unisex: {
    id: 'bed_unisex',
    label: { en: 'Unisex Bed', bm: 'Katil Uniseks', zh: '混合床位' },
    locations: ['subang'] as const,
    duration: 90,
    lastBooking: { subang: '16:45' },
    capacity: { subang: 2 },
    besAvailable: false,
    genderPolicy: 'one_gender_at_a_time',
  },
  inhaler: {
    id: 'inhaler',
    label: { en: 'Inhaler', bm: 'Inhaler', zh: '吸入器' },
    locations: ['okr', 'subang'] as const,
    durations: [30, 60] as const,
    lastBooking: {
      okr: { '60min': '20:30', '30min': '21:00' },
      subang: { '60min': '15:15', '30min': '15:45' },
    },
    capacity: { okr: 8, subang: 5 },
    besAvailable: false,
  },
  room_small: {
    id: 'room_small',
    label: { en: 'Meeting Room', bm: 'Bilik Mesyuarat', zh: '小型会议室' },
    locations: ['okr'] as const,
    capacity: { okr: 8 },
    memberOnly: true,
    equipment: ['tv', 'projector'] as const,
  },
  room_large: {
    id: 'room_large',
    label: { en: 'Meeting Hall', bm: 'Dewan Mesyuarat', zh: '大型会议厅' },
    locations: ['okr'] as const,
    capacity: { okr: 50 },
    memberOnly: true,
    equipment: ['tv', 'projector', 'full_seating'] as const,
  },
} as const

export type ElkenLocation = keyof typeof ELKEN_LOCATIONS
export type ElkenFacilityId = keyof typeof ELKEN_FACILITIES

// Import ElkenLang from types to avoid duplication
import type { ElkenLang } from './booking/types'

/** Map pipeline-detected language codes to Elken's three supported languages */
export function toElkenLang(lang: string | null | undefined): ElkenLang {
  if (lang === 'zh' || lang === 'zh-CN' || lang === 'zh-TW' || lang === 'zh-HK') return 'zh'
  if (lang === 'bm' || lang === 'ms' || lang === 'my' || lang === 'malay') return 'bm'
  return 'en'
}
