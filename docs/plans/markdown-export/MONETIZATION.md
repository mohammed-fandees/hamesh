# Should the Markdown export be paid? — side study

Status: **for the owner's decision.** Recommendation at the end.

## What we start from

- Personal notes have **no account**. They live on the device; the store build never talks to a
  server about them. That promise is the first line of the privacy policy and the store listing.
- The only paid product is **Teams** (plans, a free plan by default, manual payment through the
  server). An entitlement exists only for someone signed in to Teams.
- The owner wants **reach** more than revenue right now.

## The options

### A. Everything free

- Getting your own data out is a trust feature. Charging for it reads as lock-in, and reviewers
  say so in store reviews.
- Every exported file can carry a small "Exported from Hamesh" line with a link (see C1). Files
  in Obsidian vaults and Notion workspaces get shared, published (Obsidian Publish, Notion public
  pages) and screenshotted. That line travels with them.
- Cost: no revenue from it.

### B. Free core, paid extras

Free: page, folder and full export, in both flavors, with the table and the notes.
Paid: the visual layer — mind maps, timelines, Canvas, the Base/CSV database.

- Problem 1: **the visual layer is the reason to share an export.** Paywalling it removes the very
  thing that would spread Hamesh.
- Problem 2: **a paid personal feature needs a way to know who paid.** Two routes:
  1. Sign in to Teams for an entitlement. This puts a server and a Google sign-in in front of a
     personal feature, which changes what the store build is (MAJOR, a new privacy disclosure).
  2. An **offline licence key**: the server signs `{plan, expires}` with a private key, the
     extension checks it with a public key built in. No network call, no account, nothing about
     notes leaves the device. Keys can be shared, which at Hamesh's size is an acceptable loss.
- Verdict: possible with route 2, but it spends effort to slow growth.

### C. Pay by sharing

1. **Attribution line (chosen).** One line at the end of each file, always there. Honest,
   visible, and the only form of "sharing" that needs no tracking. The owner chose to make it
   mandatory (2026-11-20). The trade-off: someone who doesn't want it can delete one line by
   hand, so it costs them a few seconds and costs us nothing. It stays a quiet footer, never a
   banner or a line inside the notes.
2. **Referral unlock** ("3 friends install → Pro"). Needs a referral id carried from a landing
   page into the extension and counted on a server. Chrome Web Store has no install referrer, so
   it means a tracking cookie or a code the friend types. Easy to game, and it brings tracking
   into a product sold on not tracking. **Not recommended.**
3. **"Share to unlock"** (post on X / LinkedIn). Can't be verified, so it's an honour system dressed
   up as a gate. Rewarding reviews or ratings is against Chrome Web Store policy, so it must never
   touch ratings. **Not recommended.**
4. **A "share this page" link** (a public, read-only page of one page's notes, hosted by Hamesh).
   The strongest growth loop of all: every shared link is a landing page. But it sends a note to
   a server, so it's an explicit, per-page opt-in feature of its own, with its own privacy
   section. **Good next feature, not part of this one.**

### D. Paid through Teams

Teams is already the paid product. What a team needs that a person doesn't:

- **Team digest export**: a team folder or page as Markdown, with each shared note's comment
  thread, who wrote what, and resolved/open state.
- **Decision log**: notes tagged as decisions, as one table.
- Scheduled export later (weekly digest to a folder the team picks).

This needs no new payment path, no licence keys, and nothing changes for personal notes.

## Recommendation

1. **Personal export: free, all of it**, with the attribution line in every file (C1).
2. **Team digest export: in Teams plans** (D), as the next Teams release after this one. It needs
   comments, which this release leaves out anyway.
3. **Measure before charging.** With usage counts already opt-in (2.2), count exports by flavor
   and scope. If the visual layer turns out to be what people use most, revisit B with offline
   keys.
4. **Next growth feature: the opt-in public "share this page" link** (C4), designed on its own.

## What to tell people

Store listing line: "Take your notes to Obsidian or Notion, with a map of each page and a
timeline of each video." Free, and say so. "Free" next to "export" is a reason to install.
