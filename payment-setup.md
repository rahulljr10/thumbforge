# ThumbForge Payment Setup

## Locked Plans

### Starter

- `$29/month`
- 6 delivery credits
- One credit equals one finished thumbnail concept
- Up to 6 unused monthly credits roll over while active
- Additional credits cost `$3 each`

### Pro

- `$69/month`
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

- Members can buy any quantity from 1 to 100 credits at `$3 each`
- Top-ups do not change the subscription renewal date
- Monthly credits are consumed before purchased credits
- Purchased credits remain available while membership stays active
- Revisions and directions that clearly miss the agreed brief do not use credits
- Automatic top-ups should be optional and disabled by default when added later

## Checkout Products Needed

Create four checkout products or price objects:

1. ThumbForge Starter — `$29/month`
2. ThumbForge Pro — `$69/month`
3. ThumbForge Credit Top-Up — `$3/credit`, quantity adjustable
4. ThumbForge Custom — manually invoiced

Set successful Starter and Pro payments to redirect to `intake.html` with the plan query parameter.

## Manual Credit Ledger

Track customer email, plan, renewal date, monthly credits, rollover credits,
purchased credits, delivered concepts, revisions, and active briefs in Airtable,
Notion, or Google Sheets until the member dashboard is built.
