-- Ensure chunks are cascade-deleted when their parent document is deleted.
-- The application-level DELETE handler already deletes chunks first,
-- but this FK constraint ensures correctness for direct DB deletes too.
ALTER TABLE chunks
  DROP CONSTRAINT IF EXISTS chunks_document_id_fkey,
  ADD CONSTRAINT chunks_document_id_fkey
    FOREIGN KEY (document_id)
    REFERENCES documents(id)
    ON DELETE CASCADE;
