# ThumbForge Payment Setup

## Locked Founder Offer

- Price: `$29/month`
- Allowance: `6 delivery credits/month`
- One credit: one finished thumbnail concept
- Typical usage: two concepts for each of three videos
- Included: one revision per video brief
- Rollover: up to six unused credits while the subscription remains active
- Failed drafts and concepts that clearly miss the agreed brief do not use credits

This is a premium reviewed service. Do not compare the six credits directly with
bulk-generation tools where every unreviewed output consumes a credit.

## Checkout

Use a subscription-capable global checkout rather than a one-time Razorpay link.
Before taking live payments, connect one of:

- Paddle
- Lemon Squeezy
- Razorpay Subscriptions, if international cards and recurring payments are
  supported for the account

Configure:

1. Product: `ThumbForge Founder Plan`
2. Billing interval: monthly
3. Price: `$29`
4. Success URL: the deployed `intake.html`
5. Cancellation: customer self-service
6. Failed-payment emails: enabled

Replace the `href` and `data-payment-link` values on the pricing button in
`index.html` with the hosted checkout URL.

## Manual Credit Ledger

Use Airtable, Notion, or Google Sheets until there is enough demand for a member
dashboard. Track:

- Customer name and membership email
- Billing date and subscription status
- Credits granted
- Credits used
- Credits rolled over
- Video brief link
- Concepts delivered
- Revision status

Only deduct credits after a concept has been delivered.

## Order Flow

1. Customer subscribes for `$29/month`.
2. Checkout redirects to `intake.html`.
3. Customer submits a brief and chooses one, two, or three concepts.
4. Verify the membership email and available credits.
5. Produce and quality-check the concepts.
6. Deliver the files and deduct delivered credits.
7. Record feedback and any YouTube Test & Compare result.
