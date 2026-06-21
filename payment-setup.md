# MakeViralThumb Payment Setup

## Locked Plans

### Starter

- List price `$39/month`
- `$29/month`
- Launch discount: 26%
- 6 delivery credits
- One credit equals one finished thumbnail concept
- Up to 6 unused monthly credits roll over while active
- Additional credits cost `$3 each`

### Pro

- List price `$99/month`
- `$69/month`
- Launch discount: 30%
- 24 delivery credits
- Designed for roughly 12 videos with two concepts per video
- Priority 24-hour delivery target
- Two active briefs at a time
- Up to 12 unused monthly credits roll over while active
- Additional credits cost `$3 each`

### Custom

Quote after reviewing channel count, monthly volume, turnaround, and workflow.
Respond with a recommendation within 24 hours.

## Top-Up Rules

- Every new account receives one free concept before checkout
- The free concept is limited to one account and does not require a card
- Members can buy any quantity from 1 to 100 credits at `$3 each`
- Top-ups do not change the subscription renewal date
- Monthly credits are consumed before purchased credits
- Purchased credits remain available while membership stays active
- Revisions and directions that clearly miss the agreed brief do not use credits
- Automatic top-ups should be optional and disabled by default when added later

## Checkout Products Needed

Create four checkout products or price objects:

1. MakeViralThumb Starter - `$29/month`
2. MakeViralThumb Pro - `$69/month`
3. MakeViralThumb Credit Top-Up - `$3/credit`, quantity adjustable
4. MakeViralThumb Custom - manually invoiced

Set successful Starter and Pro payments to redirect to `dashboard.html?view=brief`.

## Current Credit Ledger

The Supabase `profiles` and `credit_transactions` tables are the source of truth
for plan, renewal, monthly credits, rollover, top-ups, trial use, and delivery
deductions. Payment webhooks must update those tables only after a verified
provider event.
