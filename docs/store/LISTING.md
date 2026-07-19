# Chrome Web Store — submission pack (Awwdits v1.1.2)

Everything the Developer Dashboard will ask for, ready to paste. First-time listing.

---

## 0. Before you start (one-time)

1. **Developer account** — sign in at
   <https://chrome.google.com/webstore/devconsole> and pay the **$5 one-time**
   registration fee. Use an account you're happy to have as the long-term owner
   (a group/publisher account is safer than a personal one you might lose).
2. **Host the privacy policy** — the store needs a public URL. Easiest: push the
   repo's `PRIVACY.md` to `main`, then use its GitHub URL:
   `https://github.com/overlyhonest/awwdits/blob/main/PRIVACY.md`
   (Or enable GitHub Pages for a rendered page.)
3. **Package** — upload `awwdits-v1.1.2.zip` (already built, at the repo root).

---

## 1. Package

- **File:** `awwdits-v1.1.2.zip`
- Manifest V3, version `1.1.2`. Contains no remote code; all JS is bundled and readable
  (not obfuscated), which is what the reviewers want.

---

## 2. Store listing tab

**Item name**
```
Awwdits — Design Review
```
_(≤45 chars. Defaults from the manifest name "Awwdits"; the suffix is allowed and aids
discovery. Keep it if you like, or just "Awwdits".)_

**Summary** (short description, ≤132 chars — this is 118)
```
Review any live page: comment on elements, tweak the CSS, and hand it off to a developer or an LLM as structured text.
```

**Category:** `Developer Tools`

**Language:** `English`

**Detailed description**
```
Awwdits turns "the padding is off here" into something a developer — or a coding agent — can act on directly.

Open it on any live web page with Alt+Shift+A. Hold Cmd/Ctrl and click an element to inspect it, add Shift to leave a comment, or tweak its CSS and watch every change tracked as a before/after pair. Hold X and click two elements to measure the gap between them, the way Chrome's inspector does.

Then hand it off. Copy your review as structured text and paste it into a ticket, a pull request, or an LLM. Each note leads with what's needed to FIND the element — its React component and source file (Button → button.tsx:8), a text snippet, and a stable hook (data-testid / id / aria-label). Each edit RESOLVES to source: a token-backed value follows its var() chain down to the exact file and line you'd edit, instead of a leaf pixel that appears nowhere in the code.

Inspect any visual too — an <img>, a CSS background, an inline <svg>, a <canvas>, or a <video>. The panel shows a preview plus dimensions, and for hosted assets, its file size and a one-click download.

Everything degrades gracefully: no design tokens, no framework, or plain HTML falls back to the class selector and a plain before/after.

Private by design: your comments and edits are saved locally in your browser, keyed by page URL, and never leave your device. No accounts, no analytics, no servers.

Shortcuts
- Alt+Shift+A — toggle Awwdits
- Cmd/Ctrl + click — inspect
- Cmd/Ctrl + Shift + click — comment
- Hold X — measure
- Escape — deselect

Open source (GPL v3): https://github.com/overlyhonest/awwdits
```

**Screenshots** (upload in this order — first is the tile hero, all 1280×800):
- `docs/store/screenshots/01-inspect.png`
- `docs/store/screenshots/02-comment.png`
- `docs/store/screenshots/03-edit.png`
- `docs/store/screenshots/04-handoff.png`

**Store icon:** 128×128 — `public/icons/icon-128.png` (also inside the zip).

**Promo tiles (optional):** small 440×280, marquee 1400×560. None made yet — skip for launch, add later if you want featured placement.

---

## 3. Privacy tab

**Single purpose**
```
Awwdits is a design-review tool. It lets you inspect, annotate, and edit elements on any web page you choose, then export that review as structured text for a developer or an LLM. It performs this one function and nothing else.
```

**Permission justifications**

| Permission | Justification to paste |
|---|---|
| `activeTab` | Injects the review interface into the specific tab the user activates Awwdits on (via the toolbar icon or Alt+Shift+A). No background access to other tabs. |
| `scripting` | Injects the content script and review overlay into the active tab when the user opens Awwdits. |
| `storage` | Saves the user's comments, CSS edits, and toolbar position locally (chrome.storage.local), keyed by page URL, so a review survives a reload. This data never leaves the device. |
| Host permission `<all_urls>` | Awwdits is a general-purpose review tool that must work on whatever page the user chooses to review; it does not target specific sites and runs its overlay only when the user activates it. It is also used to fetch an inspected image/asset's bytes from the page's own origin to show file size and enable one-click download. |

**Remote code:** select **"No, I am not using remote code."** (All code ships in the package.)

**Data usage** — check the boxes on the three required certifications:
- ☑ I do not sell or transfer user data to third parties, outside of the approved use cases.
- ☑ I do not use or transfer user data for purposes unrelated to my item's single purpose.
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Data collection disclosure:** Awwdits stores review data **locally only** and transmits
nothing to the developer or any third party, so **no data-collection categories apply** —
leave them unchecked. (The only network request fetches an asset from the page's own origin
and stays in the browser; it is not collection.)

**Privacy policy URL**
```
https://github.com/overlyhonest/awwdits/blob/main/PRIVACY.md
```

---

## 4. Distribution

- **Visibility:** Public (or Unlisted if you want to soft-launch and share a direct link first).
- **Regions:** All regions.
- **Pricing:** Free.

---

## 5. Submit

1. Save each tab (a green check appears when a tab is complete).
2. Click **Submit for review**.
3. Review typically takes anywhere from a few hours to a few business days for a
   first submission. You'll get an email on approval or if changes are requested.

## After approval

- Update the README's Install section (it currently says "Not on the Chrome Web Store
  yet") with the store link.
- For future releases, bump the version, `npm run build`, re-zip, and upload the new
  zip — the listing copy carries over. (Consider the API/CLI route once you're doing
  this often.)
