-- Structured customer request preferences; not a quotation or payment amount.
ALTER TABLE customer_projects ADD COLUMN IF NOT EXISTS gift_brief jsonb;

-- Fill only the three explicitly requested fictional fixtures, never real requests.
UPDATE customer_projects AS p
SET gift_brief = jsonb_build_object(
  'recipient_type', 'group',
  'recipients', jsonb_build_array(jsonb_build_object(
    'name', demo.label, 'description', demo.description,
    'likes', demo.likes, 'dislikes', 'Disposable plastic and impersonal branding (fictional sample preferences)'
  )),
  'group_size', demo.quantity,
  'occasion_description', demo.occasion,
  'gift_message', demo.message,
  'budget_basis', 'per_recipient', 'budget_amount', demo.budget,
  'currency', 'INR', 'delivery_date', to_char(COALESCE(p.target_date, current_date + 30), 'YYYY-MM-DD')
), target_date = COALESCE(p.target_date, current_date + 30)
FROM (VALUES
  ('d3e00000-0000-4000-8000-000000000001'::uuid, 'gyvft-demo-v1-received', 'Family celebration guests', '40 friends and family gathering in Chennai. Fictional recipient group.', 'Useful keepsakes, warm personal notes', 40, 'A family celebration in Chennai (DEMO)', 'Thank you for sharing our celebration.', 750),
  ('d3e00000-0000-4000-8000-000000000002'::uuid, 'gyvft-demo-v1-review', 'New team members', '80 colleagues joining a team, with delivery to one office. Fictional recipient group.', 'Practical everyday items, personalised welcome notes', 80, 'New employee welcome (DEMO)', 'You belong here. We are happy to have you.', 1500),
  ('d3e00000-0000-4000-8000-000000000003'::uuid, 'gyvft-demo-v1-accepted', 'Anniversary guests', '100 guests receiving an anniversary keepsake. Fictional recipient group.', 'Meaningful mementos and thoughtful presentation', 100, 'An anniversary celebration (DEMO)', 'Thank you for being part of our journey.', 1000)
) AS demo(id, submission_key, label, description, likes, quantity, occasion, message, budget)
WHERE p.id = demo.id AND p.submission_key = demo.submission_key
  AND p.customer_email = 'aarla@aarla.in' AND p.gift_brief IS NULL;
