// DR. AIMAN TENANT PLUGIN — media trigger configuration.
// This file owns DR_AIMAN_BOT_ID. lib/tenants/registry.ts imports from here.
// Do not import from registry.ts — that would create a circular dependency.

export const DR_AIMAN_BOT_ID = '2c7d3166-ff9d-4ce2-985c-4f7125c9b9af' as const

export const TRIGGER_VALUES = ['skeptical', 'confirmed'] as const
export type TriggerValue = typeof TRIGGER_VALUES[number]

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
