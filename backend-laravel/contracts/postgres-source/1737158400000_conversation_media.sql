-- Up Migration
CREATE TABLE media_objects (
 id uuid PRIMARY KEY,
 owner_id uuid NOT NULL REFERENCES users(id),
 conversation_id uuid NOT NULL REFERENCES conversations(id),
 purpose text NOT NULL CHECK (purpose IN ('image','voice')),
 status text NOT NULL CHECK (status IN ('pending','ready','expired','quarantined')),
 declared_type text NOT NULL,
 detected_type text,
 byte_size integer,
 storage_key text NOT NULL UNIQUE,
 voice_duration_ms integer,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE media_bytes (
 media_id uuid PRIMARY KEY REFERENCES media_objects(id) ON DELETE CASCADE,
 content bytea NOT NULL
);
CREATE TABLE media_access_grants (
 id uuid PRIMARY KEY,
 media_id uuid NOT NULL REFERENCES media_objects(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id),
 token_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL
);
ALTER TABLE messages ADD COLUMN kind text NOT NULL DEFAULT 'text' CHECK (kind IN ('text','image','voice','system'));
ALTER TABLE messages ADD COLUMN client_request_id uuid;
ALTER TABLE messages ADD COLUMN media_id uuid REFERENCES media_objects(id);
ALTER TABLE messages ADD COLUMN position bigint GENERATED ALWAYS AS IDENTITY;
CREATE UNIQUE INDEX messages_client_request ON messages (conversation_id, author_id, client_request_id) WHERE client_request_id IS NOT NULL;
CREATE TABLE message_receipts (
 message_id uuid NOT NULL REFERENCES messages(id),
 user_id uuid NOT NULL REFERENCES users(id),
 delivered_at timestamptz,
 read_at timestamptz,
 PRIMARY KEY (message_id, user_id)
);
-- Down Migration
DROP TABLE message_receipts;
DROP INDEX messages_client_request;
ALTER TABLE messages DROP COLUMN position;
ALTER TABLE messages DROP COLUMN media_id;
ALTER TABLE messages DROP COLUMN client_request_id;
ALTER TABLE messages DROP COLUMN kind;
DROP TABLE media_access_grants;
DROP TABLE media_bytes;
DROP TABLE media_objects;
