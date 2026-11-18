# First-time GYVFT flow review

Review artifact: https://www.gyvft.com/design-review.html — Revision 4, 18 November 2026. This is a fictional-data prototype, not a live payment or Shopify integration. Automated checks do not establish that customers understand the flow; the sessions below have not been run yet.

## Confirmed commercial policy

50% advance after quote approval; the remaining 50% is due before dispatch. For the ₹13,300 sample: ₹6,650 now and ₹6,650 before dispatch. Uploaded proof is pending until bank verification. No changes to the gift or artwork once production starts.

## Customer session

Use a first-time participant. Start with **Try choosing an option**. Give tasks without explaining the controls:

1. “Choose a gift for these recipients. You can use Aarla’s option or adapt it.”
2. “Show me what you have chosen. What has been approved, and what still needs Aarla’s confirmation?”
3. Open the sample quote. “What will you receive, what is the total, and what would you pay now and later?”
4. Approve the sample quote and submit fictional payment proof. “Has Aarla received your money? What should you do next?”
5. Open Delivery. “Where would you check the current status and expected delivery?”

Observe before intervening. Record wrong turns, hesitation, misunderstandings and any help needed. Do not request real payments or personal financial screenshots.

## Operations session

Switch to Operations and ask:

1. “Which request would you work on next, and why? Who is it waiting on, and when is it due?”
2. “Complete the next sample task. What changed for the customer?”
3. “What must happen before production starts? Can the customer change the gift afterward?”

## Evidence for sign-off

Record task completion, whether help was needed, the participant’s own explanation of the commitment and any mismatch with the screen. The customer should identify the exact approved gift/version, ₹6,650 advance, ₹6,650 balance before dispatch, pending versus verified proof and the delivery status without prompting. The operator should identify the next task and explain its customer-visible result. Resolve observed blockers in the mock-up before application development.


## Development acceptance criteria

These three items are fixed and browser-verified in the Revision 4 prototype. Carry them into application development and verify them against the real backend before release.

- **Mobile controls:** effective touch targets are at least 44 × 44 px, including icon actions, rating stars, form fields, summaries and checkbox/radio labels. Check customer and Operations screens at 320, 390 and 760 px without clipping or horizontal overflow; also check touch devices at wider widths.
- **Dialog names:** each dialog has a programmatic name matching its visible heading, using `aria-labelledby` or the equivalent component API. Check the accessibility tree, keyboard navigation, Escape and focus return to the opener.
- **Individual photo permissions:** upload and feature two permitted photos; withdraw public permission for just one. That photo must disappear from public reads/previews while its private copy remains. The second photo must retain its own permission and publication state. Refresh and verify persisted state, reject another customer's permission changes, and ensure Operations cannot feature a withdrawn photo. Re-consent must not automatically republish it.

Prototype evidence: all 52 previews checked at 320/390/760 px for effective control size and overflow; dialog names resolved from headings; two-photo withdrawal, retained private copies, unaffected second photo, re-consent and the quick Make private action checked. Real persistence, ownership enforcement and public cache/media access remain application acceptance checks.

Run the prototype regression check after installing dependencies and Playwright Chromium:

```bash
node scripts/check-design-review.mjs
```

For a system Chromium installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path. This check exercises the standalone prototype without sending payments, orders or publications.
