# Account-first customer website

23 November 2026. The owner requested a customer-facing website mock-up, supplied two films, clarified that the first describes the problem and the second the solution, then asked to redo the website to make account creation easy. This branch is a working homepage and registration-entry candidate for review. A preview deployment does not mean the existing production homepage has changed.

## Customer path

The owner approved the clearer hero wording: **You know them. Give something that feels like them.** Section transitions now follow that thought: save the person’s details and dates, share a brief when ready, choose from Aarla’s possibilities, see what that becomes, and optionally bring more people into Circles. Account-creation buttons use a consistent invitation; the store saving remains a supporting benefit.

The main invitation is **Create my GYVFT**, linking directly to `/account/login?mode=signup`. The form opens in registration mode with email and password, without assuming an existing enquiry. Normal sign-in, recovery and reset-token precedence are preserved. The copy introduces people, occasions, saved ideas and Aarla’s curated gift choices. Circles remain optional. A submitted public brief now offers an account invitation using the same email; the existing seven-step brief is retained.

The homepage progresses through an emotional introduction, an interactive Gifts/Occasions/Circles example, Aarla’s curation process, existing gift stories, personal/community/team context, the separate Aarla shopping benefit, FAQs and account creation. Portfolio examples link to their existing story pages. Fictional workspace content is explicitly labelled as an example. The page does not promise instant AI options, automated occasion reminders, complete B2B billing or GST support.

Header navigation emphasises the product, process, gift stories, team gifting, sign-in and registration. Existing brief, discovery, upload, partnership and brand routes remain available through the footer. The mobile menu is a disclosure with Escape/close behaviour. The privacy banner is shorter; consent storage and optional-tag behaviour remain unchanged. Public links reuse the existing progress indicator outside document flow.

## Films and assets

- Problem film: [GYVFT — Your Story Film](https://drive.google.com/file/d/1QH-fy3S12JQq4ImBJkIJvrsky9FIUgch/view), 65 seconds. The original 20 MB MP4 was copied and compressed to a 1280px H.264/AAC review delivery of approximately 5.1 MB, with fast-start metadata. Original Drive content is unchanged. On-screen text is present; a separate first-film caption track/transcript has not been verified.
- Solution film: [GYVFT — For You, Your People & Your Organisation](https://docs.google.com/videos/d/1QoGE-DeP817FJ1AayzLX4dHAY4pb3yqYUI1W-DW-7jU/play), approximately 86 seconds. Google’s MP4 export is approximately 3.2 MB. Its English caption stream was extracted to WebVTT without changing the spoken content.
- The owner plans a more visual replacement for the solution film. Before final public sign-off, align its closing invitation with **Create your GYVFT account**, rather than requiring Circle creation. Its current narration also mentions priority access to out-of-stock items and extending benefits to invitees; these are not verified product capabilities and must be clarified/corrected in the replacement. Do not turn those narration claims into website copy.
- Three existing portfolio images are resized WebP copies, approximately 500 KB combined. Their original files are preserved. Product-preview images reuse existing Aarla source assets; the cards describe example directions, not an actual published quote.

Media is served as static files under `/website-review/`, with no external iframe/CSP exceptions or additional function-side filesystem reads. Video elements mount only after the visitor chooses to watch; closing the dialog unmounts playback. Native controls, inline mobile playback, named Radix dialogs, source links, and the available solution captions are retained. Nothing downloads a film on initial render. Replacing the solution film only requires updating its static media, poster and captions (or the film configuration).

## Verification and boundaries

The production build, TypeScript and focused signup/authentication/asset checks pass. Unit interaction checks exercise keyboard tab navigation, gift choice feedback, dialog names, deferred media mounting and film close/unmount. The browser suite was updated for the direct signup path, new email label, product preview, mobile navigation and the two films; it has not run in this turn.

Managed Sites guidance prohibits a browser-control fallback when `cua_repl.js` is unavailable. No supported browser QA tool is available in this session, so desktop/mobile visual layout, native video playback and complete browser signup remain unverified here. Unit DOM tests are not a visual browser pass. Review the preview at desktop and 390px/320px mobile widths, open/close both films, use the mobile menu, and follow registration before signing off the public redesign.

No migration, database reset, customer-data edit, account creation, email, Shopify coupon/order mutation or deployment-history deletion accompanies this change. Images and videos are static deployment assets; local Next dependency traces must not include the MP4 files. Existing backend registration and recovery commands are unchanged.
