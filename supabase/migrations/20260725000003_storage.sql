-- Storage bucket configuration for opportunity briefs.
-- On hosted Supabase this can also be created via Dashboard; this migration
-- is safe when storage schema exists and is a no-op otherwise.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'opportunity-briefs',
      'opportunity-briefs',
      FALSE,
      10485760,
      ARRAY[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/png',
        'image/jpeg',
        'image/webp'
      ]
    )
    ON CONFLICT (id) DO UPDATE
    SET public = FALSE,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

    -- Deny public/anon object reads; signed URLs are issued by service role only.
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'opportunity_briefs_no_public_read'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY opportunity_briefs_no_public_read
        ON storage.objects
        FOR SELECT
        TO anon
        USING (FALSE)
      $policy$;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'opportunity_briefs_authenticated_no_direct_read'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY opportunity_briefs_authenticated_no_direct_read
        ON storage.objects
        FOR SELECT
        TO authenticated
        USING (FALSE)
      $policy$;
    END IF;
  END IF;
END $$;
