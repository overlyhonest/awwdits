# Privacy Policy — Awwdits

_Last updated: 19 July 2026_

Awwdits is a browser extension for design review. This policy explains, plainly,
what data it touches and where that data goes. The short version: **Awwdits keeps
everything on your device and sends nothing to us or to anyone else.**

## What Awwdits stores

When you use Awwdits, it saves the following on your own computer using the
browser's local extension storage (`chrome.storage.local`):

- **Comments and CSS edits** you make during a review, keyed by the page's URL, so
  a review survives a page reload.
- **Toolbar position** and similar interface preferences.

This data stays in your browser profile. It is not uploaded, synced to a server,
or shared. Removing the extension, or clearing its storage, deletes it.

## What Awwdits does *not* do

- It does **not** collect, transmit, or sell any personal information.
- It does **not** use analytics, telemetry, tracking, advertising, or fingerprinting.
- It does **not** send your comments, edits, or browsing activity to us or any third party.
- It contains **no remote code**; all of its code ships inside the published package.
- There is **no backend server** operated by Awwdits.

## Network requests

Awwdits makes network requests in exactly one situation: when you inspect an image
or other asset on a page, it may fetch that asset **from the page's own origin** to
show its file size and to let you download it with one click. This request goes to
the same website you are already viewing — never to Awwdits — and the result stays
in your browser.

## Permissions

- **`activeTab` / `scripting`** — inject the review interface into the tab you
  explicitly open Awwdits on.
- **`storage`** — save your review locally, as described above.
- **Access to all sites (`<all_urls>`)** — Awwdits is a general-purpose tool that
  works on whatever page you choose to review; it runs its interface only when you
  activate it and does not target or monitor specific sites in the background.

## Handing off a review

When you copy a review to hand to a developer or paste into an LLM, Awwdits places
that text on your clipboard. What you then do with it — paste it into a ticket, a
pull request, or a chat — is entirely up to you and outside Awwdits's control.

## Children

Awwdits is a developer tool and is not directed at children.

## Changes to this policy

If this policy changes, the updated version will be published at this URL with a new
"last updated" date.

## Contact

Questions about privacy? Open an issue at
<https://github.com/overlyhonest/awwdits/issues>.
