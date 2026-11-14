# GYVFT customer portal — user manual

This guide covers **My GYVFT**, the customer portal, and the secret-protected database setup page. Features become available after this pull request is deployed and setup is completed. Aarla OS syncing, automatic payment verification and Shopify order creation are separate integrations.

## For customers

### Create your account

1. Open GYVFT and choose **My GYVFT** in the header.
2. Choose **Create account**.
3. Enter the **same email address used for your enquiry** and a password of at least 12 characters.
4. Check your email for the verification code, enter it, and choose **Verify email**.
5. Your customer space opens with enquiries and projects associated with that verified email.

Submitting an enquiry does not automatically create a password. Create your account once; use **Sign in** for later visits. An organisation’s email domain does not grant access to other people’s projects.

### Sign in and recover your password

Open **My GYVFT**, enter your email and password, and choose **Sign in to My GYVFT**. To recover access, choose **Forgot password?**, enter your email, and request a recovery code. Enter the code from your email, then set a new password of at least 12 characters.

Use **Sign out** on the overview page when finished, especially on a shared device.

### Find your enquiry or project

The overview displays your enquiries and confirmed projects. Open a story card to see:

- Your brief and any organisation label.
- The current stage and the next action.
- The target date, when your team has supplied one.
- Published milestone updates and conversations.
- Proposal or design approval requests.
- Pricing, verified payments and payment instructions, when available.
- A Shopify order reference, if one has been supplied.

Choose **Start a new story** to submit another enquiry. New enquiries appear when customer storage is configured and capture succeeds. Earlier enquiries may need the team to link or import them.

If nothing appears, check that you signed in with the email used on the enquiry. If you used a different address, contact GYVFT using the original contact channel to arrange access. Creating an account does not import enquiries from another email.

### Understand the progress stages

| Stage                    | Meaning                                               |
| ------------------------ | ----------------------------------------------------- |
| Enquiry received         | Your request has been received.                       |
| Understanding your story | The team is clarifying the occasion and requirements. |
| Curation in progress     | The gifting direction is being prepared.              |
| Proposal shared          | A proposal is available for discussion or approval.   |
| Awaiting advance         | The required advance has not yet been verified.       |
| Design in progress       | Design and personalisation work is underway.          |
| Awaiting design approval | Your decision on a design is needed.                  |
| Production               | Your approved work is being produced.                 |
| Quality check & packing  | The order is being checked and packed.                |
| Dispatched               | The order has been sent.                              |
| Delivered                | Delivery has been recorded.                           |
| Completed                | The project has been closed.                          |

The current stage and next action reflect updates published by the team. Refresh the page to load new updates. The stage list describes the planned journey; a customer action does not automatically move the project to the next stage.

### Send a message

Open the relevant project, find **Conversations**, enter your message, and choose **Send message**. Messages can contain up to 4,000 characters. A confirmation appears after saving, and the message joins that project’s conversation.

Messages are saved in GYVFT. External forwarding and email notifications are not connected in this release. If a message is urgent, use your existing contact channel as well. If a request fails, refresh and check the conversation before resending.

### Approve a proposal or design

When a request is published, **For your approval** shows its title, version and description.

1. Read the details for that version.
2. Select **Approve this version** or **Request changes**.
3. Add comments. Comments are required when requesting changes.
4. Choose **Send decision**.

The decision is recorded in the timeline. A submitted decision cannot be edited in this portal; send a message if you need to correct it. Approval applies only to the displayed version. Revised proposals or designs require a new request, and superseded versions cannot receive new decisions.

### Pay the advance or balance

**Every order requires a 50% advance. The remaining balance is due before dispatch.**

The payment panel shows the agreed total, the 50% advance, verified payments and the remaining balance. Before pricing is agreed, it explains that a quote will follow. Pending payment references do not reduce the verified balance.

**Razorpay:** if a payment link has been provided, choose **Pay securely with Razorpay**. Complete payment on Razorpay. A successful checkout does not automatically update this portal in the current release; the payment integration or team must supply the verified receipt.

**Direct UPI / GPay:** if a UPI ID is shown:

1. Open GPay or another UPI app and enter the displayed business UPI ID.
2. Check the recipient and amount before paying.
3. Return to the project and enter the amount actually paid and your UPI transaction reference.
4. Choose **Submit payment reference**.

Your submission appears as **Awaiting verification** until receipt is checked. A reference is not proof of receipt. Never share your UPI PIN or banking password in the portal. If a payment cannot be verified, contact the team with the transaction details before paying again.

## For the GYVFT owner

### Deploy and complete setup

1. Review the pull request and its Vercel preview, then merge when ready. Confirm that the production deployment succeeds.
2. Confirm the deployed environment has `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the supported legacy anon key). Supabase Auth keys alone do not supply a SQL connection. Credentials already configured in Vercel do not need to be entered in the migration page.
3. Set a separate random `SETUP_SECRET` of at least 11 characters in Vercel and redeploy. This secret is not an application login password.
4. Open `/setup`, enter the same secret and choose **Start setup**. No Studio owner account is needed.
5. In Supabase, enable customer email/password signup and require email confirmation. Ensure customer registrations are not automatically granted Studio profiles or staff roles.
6. Configure Supabase’s **Confirm signup** and **Reset password** email templates to display `{{ .Token }}`. This portal accepts email codes directly on its login page. Configure production email delivery and an appropriate password policy.
7. Set `NEXT_PUBLIC_APP_URL` to the production GYVFT origin so enquiry emails link to the correct site.
8. Test customer registration, email verification, login, recovery and enquiry visibility. Confirm a second customer cannot access the first customer’s project URL.

The `/setup` page works before app users or the migration tracking table exist. It does not create staff users or sample data. The Studio owner migration page remains an optional tool for deployments that use staff accounts.

### Run database setup in your browser

1. Open `/setup` on the GYVFT deployment you want to update.
2. Check that `DATABASE_URL` and `SETUP_SECRET` show as configured.
3. Enter the secret you configured in Vercel and choose **Start setup**.
4. Watch the live check → apply → save steps. The active migration and elapsed time are shown; do not click again.
5. Wait for **Your database is ready**. Expand migration history to see applied updates.
6. If setup stops, share the diagnostic code and migration filename shown. The secret remains in the form for retrying but is cleared after success and is never persisted in browser storage.

Setup uses the deployment’s `DATABASE_URL`. It accepts only the setup secret, with no customer or staff login dependency. It executes SQL packaged with the deployment, skips applied migrations and prevents concurrent runs with a database lock. Failed database transactions roll back the pending batch. The CLI command `npm run db:migrate` uses the same runner and history.

| Result                               | What to do                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| Database up to date                  | No migration action is needed.                                                  |
| Invalid setup secret                 | Use the secret configured for this deployment’s Vercel environment.             |
| Setup disabled                       | Set a separate `SETUP_SECRET` with at least 11 characters and redeploy.         |
| DATABASE_URL missing                 | Add the database connection string to the same Vercel environment and redeploy. |
| Another migration run is in progress | Wait, then check migration status again.                                        |
| Completion could not be confirmed    | Check status before retrying and inspect deployment logs.                       |

The secret is not saved in browser storage and must be supplied for each request. Remove `SETUP_SECRET` in Vercel and redeploy when setup access is no longer needed. Do not paste it into chat or customer messages.

### What is connected in this release

| Capability                   | Current behavior                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| New public enquiries         | Mirrored to customer storage after successful lead email delivery, when the database is configured. Existing Aarla OS forwarding remains in place.                       |
| Customer access              | Restricted to the exact verified enquiry email. Multiple organisation contacts need a future membership workflow.                                                        |
| Customer messages            | Saved in GYVFT; external delivery and team reply tooling are future work.                                                                                                |
| Milestones and stage updates | Display customer-visible records; publishing/sync from Aarla OS is not connected yet.                                                                                    |
| Proposal/design approvals    | Customer decisions are saved against versioned requests. Creating requests and processing decisions on the team side are future integration work.                        |
| Payments                     | Shows supplied Razorpay links/UPI IDs and records pending UPI references. Does not create links, verify receipts, issue refunds or automatically update verified totals. |
| Shopify                      | Displays a supplied order reference. Does not create orders or sync fulfilment yet.                                                                                      |

Use `docs/CUSTOMER-PORTAL.md` for database fields, setup details and the integration boundary for Aarla OS. No customer progress, team replies or verified payment values should be invented to fill missing integration data.
