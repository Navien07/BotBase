-- Run AFTER 00001_extensions_schema.sql
-- Migration: Indexes

CREATE INDEX idx_chunks_bot_id ON chunks(bot_id);
CREATE INDEX idx_chunks_embedding ON chunks USING hnsw(embedding vector_cosine_ops);
CREATE INDEX idx_faqs_bot_id ON faqs(bot_id);
CREATE INDEX idx_products_bot_id ON products(bot_id);
CREATE INDEX idx_conversations_bot_id ON conversations(bot_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_bot_id ON messages(bot_id);
CREATE INDEX idx_contacts_bot_id ON contacts(bot_id);
CREATE INDEX idx_contacts_external_id ON contacts(bot_id, external_id);
CREATE INDEX idx_contacts_lead_stage ON contacts(bot_id, lead_stage);
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);
CREATE INDEX idx_bookings_bot_id ON bookings(bot_id);
CREATE INDEX idx_bookings_start_time ON bookings(bot_id, start_time);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_followup_queue_next ON followup_queue(bot_id, status, next_attempt_at);
CREATE INDEX idx_broadcasts_bot_id ON broadcast_campaigns(bot_id);
