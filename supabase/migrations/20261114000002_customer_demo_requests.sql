-- Explicitly requested pre-launch samples for the owner's verified customer email.
-- No Auth users, staff roles, emails, payments or business CRM records are created.
INSERT INTO public.customer_projects
  (id, submission_key, customer_email, title, brief, kind, stage, next_action, created_at)
VALUES
  ('d3e00000-0000-4000-8000-000000000001', 'gyvft-demo-v1-received', 'aarla@aarla.in',
   'DEMO — Family celebration keepsakes',
   'Sample request: thoughtful return gifts for 40 guests at a family celebration in Chennai. We would like useful keepsakes with a personal note. This is fictional test data.',
   'enquiry', 0, 'Your sample enquiry has been received. The GYVFT team will review the requirements.', now()),
  ('d3e00000-0000-4000-8000-000000000002', 'gyvft-demo-v1-review', 'aarla@aarla.in',
   'DEMO — Team welcome gifts',
   'Sample request: welcome gifts for 80 new team members, with room for a personalised note and delivery to one office. This is fictional test data.',
   'enquiry', 1, 'We are understanding the audience, quantity and preferred gifting direction for this sample request.', now() - interval '1 day'),
  ('d3e00000-0000-4000-8000-000000000003', 'gyvft-demo-v1-accepted', 'aarla@aarla.in',
   'DEMO — Anniversary gifting: quote accepted',
   'Sample request: 100 anniversary keepsakes. The fictional quote has been accepted; the next stage would be a 50% advance. This sample does not represent a real order or payment.',
   'enquiry', 4, 'Demo only: quote accepted and awaiting the advance. No payment is requested through this sample.', now() - interval '3 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customer_project_events (id, project_id, title, body, created_at)
SELECT
  'd3e00000-0000-4000-8000-000000000102'::uuid, id,
  'DEMO — Requirements review started',
  'The sample request is being reviewed for audience, quantity and personalisation.',
  created_at + interval '2 hours'
FROM public.customer_projects
WHERE id = 'd3e00000-0000-4000-8000-000000000002'::uuid
  AND customer_email = 'aarla@aarla.in'
  AND submission_key = 'gyvft-demo-v1-review'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customer_project_events (id, project_id, title, body, created_at)
SELECT
  'd3e00000-0000-4000-8000-000000000103'::uuid, id,
  'DEMO — Quote accepted',
  'The fictional proposal has been accepted. The sample now shows the awaiting-advance status.',
  created_at + interval '2 days'
FROM public.customer_projects
WHERE id = 'd3e00000-0000-4000-8000-000000000003'::uuid
  AND customer_email = 'aarla@aarla.in'
  AND submission_key = 'gyvft-demo-v1-accepted'
ON CONFLICT (id) DO NOTHING;

-- Link only these public, fictional fixture rows if the matching app account
-- already exists. Real historical enquiries are never claimed by email alone.
UPDATE public.customer_projects p
SET customer_account_id = a.id
FROM public.gyvft_customer_accounts a
WHERE p.customer_account_id IS NULL
  AND p.customer_email = a.email
  AND a.email = 'aarla@aarla.in'
  AND p.submission_key IN ('gyvft-demo-v1-received','gyvft-demo-v1-review','gyvft-demo-v1-accepted')
  AND p.id IN ('d3e00000-0000-4000-8000-000000000001'::uuid,'d3e00000-0000-4000-8000-000000000002'::uuid,'d3e00000-0000-4000-8000-000000000003'::uuid);
