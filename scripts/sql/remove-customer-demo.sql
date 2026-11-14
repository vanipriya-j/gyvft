-- Optional cleanup: delete only the three explicitly seeded GYVFT sample requests.
-- Related sample timeline/message rows cascade through their project foreign key.
-- Keep migration history, so subsequent setup runs do not re-create the samples.
DELETE FROM public.customer_projects
WHERE customer_email = 'aarla@aarla.in'
  AND submission_key IN (
    'gyvft-demo-v1-received', 'gyvft-demo-v1-review', 'gyvft-demo-v1-accepted'
  )
  AND id IN (
    'd3e00000-0000-4000-8000-000000000001'::uuid,
    'd3e00000-0000-4000-8000-000000000002'::uuid,
    'd3e00000-0000-4000-8000-000000000003'::uuid
  );
