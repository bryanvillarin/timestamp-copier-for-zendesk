# Zendesk Timestamp Copier

A Tampermonkey userscript that rewrites Zendesk conversation timestamps to a consistent, copyable format.

## Features

- **Rewrites** conversation timestamps to `YYYY-MM-DD HH:mm TZ` format inline
- **Copies** to clipboard on click with visual flash feedback
- **Detects** your Zendesk time zone via API, with a fallback chain and appropriate warning banners
- **Shows** browser local time in the hover tooltip while suppressing Zendesk's native tooltip
- **Skips** list view columns (SLA, Updated, Requested) and single-ticket SLA so they keep their default relative times
- **Re-rewrites** timestamps when Zendesk's relative-time ticker reverts them
- **Corrects** a Zendesk bug where `datetime` attributes store local time mislabeled as UTC

## Requirements

- [Tampermonkey](https://www.tampermonkey.net/) browser extension
- Access to a Zendesk Agent Workspace instance

## Installation

1. Install the [Tampermonkey](https://www.tampermonkey.net/) extension for your browser.
2. Click [`zendesk-timestamp-copier.user.js`](https://raw.githubusercontent.com/bryanvillarin/timestamp-copier-for-zendesk/main/zendesk-timestamp-copier.user.js).
3. Navigate to your Zendesk Agent Workspace — the script activates automatically.

## Usage

### Viewing timestamps
All conversation timestamps are automatically rewritten to `YYYY-MM-DD HH:mm TZ` on page load. Hovering over a timestamp shows the equivalent time in your browser's local time zone.

### Copying a timestamp
Click any conversation timestamp to copy it to your clipboard. A brief `✓ Copied!` flash confirms the copy.

### Time zone detection
The script detects your time zone in this order:

| Priority | Source | Notes |
|---|---|---|
| 1 | Zendesk API (`/api/v2/users/me.json`) | Always tried first |
| 2 | Manual override (Tampermonkey menu) | Used if API fails |
| 3 | Browser local time zone | Used if override not set |
| 4 | Disabled | Script deactivates if all sources fail |

### Manual time zone override
If the API is unavailable and your browser time zone doesn't match your Zendesk profile setting:

1. Check your Zendesk time zone: **Profile → Time zone**
2. Click the **Tampermonkey icon** in your browser toolbar
3. Click **"Set time zone override"**
4. Enter your IANA time zone (e.g. `America/New_York`, `Europe/London`)
5. Reload the page

The override is automatically cleared when the API becomes available again.

## Warning banners

| Banner | Meaning |
|---|---|
| 🟡 Yellow | API unavailable — using browser time zone. Try reloading or set a manual override. |
| 🔴 Red | Could not determine any time zone — timestamp rewriting is disabled. Set a manual override. |

Click any banner to dismiss it.

## Known issues

- **Garden tooltip flash on click** — Zendesk's native tooltip briefly appears when clicking a timestamp. Cosmetic only; clipboard content is correct.
- **Banner overlaps sidebar** — The warning banner may slightly overlap the right sidebar in error states. Dismissible with one click.

## Version history

| Version | Summary |
|---|---|
| v1.0 | Click-to-copy timestamps, inline rewriting |
| v1.1 | MutationObserver for dynamically loaded timestamps |
| v1.2 | Fixed observer clobbering flash animation |
| v1.3 | Performance: rAF debounce, scoped addedNodes, disconnect/observe cycle |
| v1.4 | Zendesk API time zone detection |
| v1.5 | Fallback chain with warning banners |
| v1.6 | Red banner on total failure |
| v1.7 | Manual time zone override via Tampermonkey menu |
| v1.8 | API always takes priority, auto-clears stale override |
| v1.9 | Browser local time in hover tooltip |
| v2.0 | Suppresses Zendesk's native Garden tooltip |
| v2.1 | CSS body-class approach for more reliable tooltip suppression |
| v2.2 | Skips list view `<td>` timestamps |
| v2.3 | Delayed mouseout suppression prevents Garden tooltip flash on cursor exit |
| v2.4 | Centralized `shouldSkip()`, skips single-ticket SLA |
| v2.5 | Fixed overly broad `shouldSkip()` accidentally skipping conversation timestamps |
| v2.6 | Watches `aria-label` changes to catch Zendesk's relative-time ticker |
| v2.7.1 | Corrects Zendesk bug where `datetime` stores local time mislabeled as UTC |

## Contributing

Found a bug? Have an idea?

- Open an issue on GitHub
- Reach out: [bryanvillarin.link/contact](https://bryanvillarin.link/contact/)

## License

MIT License — see the script header for details.

---

* **Bryan Villarin**  
* [bryanvillarin.link](https://bryanvillarin.link) · [allnarfedup.blog](https://allnarfedup.blog)