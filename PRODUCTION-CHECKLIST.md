# ThumbForge Production Checklist

## Required Before Customer Accounts

- Create the Supabase project.
- Apply `supabase/migrations/001_production_schema.sql`.
- Add the public Supabase URL and anonymous key to `config.js`.
- Configure the GitHub Pages and localhost Auth redirect URLs.
- Create and promote the owner account to `admin`.
- Test signup, email verification, sign in and password reset.
- Test a brief with a private source file.
- Upload concepts in `admin.html`.
- Test selection, credit deduction, revision and download.

## Required Before Accepting Payments

- Choose the merchant of record or payment provider.
- Verify the legal operator name, business address and support email.
- Add checkout and webhook functions.
- Grant plan credits only after a verified payment event.
- Add subscription renewal, cancellation and failed-payment handling.
- Add country and tax handling based on checkout evidence, not self-selection.
- Replace pricing buttons with real checkout sessions.
- Add transactional delivery and billing email.
- Review Terms, Privacy and Refund Policy with the final operator details.

## Required Before Ads

- Connect a custom domain.
- Add privacy-respecting analytics and conversion events.
- Add uptime/error monitoring.
- Add rate limits and abuse controls.
- Test desktop and mobile purchase-to-delivery flow.
- Confirm support response ownership and production capacity.
