-- Add extra proposal images. The existing option image remains the cover.
-- No existing customer, option or image record is updated or deleted.
CREATE TABLE IF NOT EXISTS gyvft_gift_option_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id uuid NOT NULL REFERENCES gyvft_gift_options(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 2 AND 6),
  image_data bytea NOT NULL CHECK (octet_length(image_data) BETWEEN 12 AND 327680),
  image_type text NOT NULL CHECK (image_type IN ('image/png','image/jpeg','image/webp')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (option_id, position)
);
ALTER TABLE gyvft_gift_option_images ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gyvft_gift_option_images FROM anon, authenticated;
