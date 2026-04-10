// Environment variable mocks for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
process.env.VOYAGE_API_KEY = 'test-voyage-key'
process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64) // 32-byte hex for tests
process.env.CRON_SECRET = 'test-cron-secret'
process.env.WEBHOOK_SECRET = 'test-webhook-secret'
process.env.NEXT_PUBLIC_APP_URL = 'https://app.botbase.ai'
process.env.NEXT_PUBLIC_WIDGET_URL = 'https://widget.botbase.ai'
