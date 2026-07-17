# Bundled fonts

Latin subsets, fetched from Google Fonts and vendored so they load from the extension
rather than the network. Loading them from `fonts.googleapis.com` meant the host page's
CSP governed the request — strict-CSP sites (GitHub and friends) blocked it and the UI
silently fell back to Arial — and it sent a request to Google from every page reviewed.

| File | Family | Weights |
|---|---|---|
| `special-gothic-expanded-one-latin.woff2` | Special Gothic Expanded One | 400 |
| `special-gothic-latin.woff2` | Special Gothic | 400 |
| `jetbrains-mono-latin.woff2` | JetBrains Mono | 400–700 (variable) |

JetBrains Mono is a variable font: one file serves every weight awwdits uses.

Latin subset only: awwdits' own chrome is English. Page-derived text renders in the
panel and falls back through the stack normally.

Both families are licensed under the SIL Open Font License 1.1 — see `OFL.txt`.
