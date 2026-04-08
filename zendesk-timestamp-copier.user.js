// ==UserScript==
// @name         Zendesk Timestamp Copier
// @namespace    https://bryanvillarin.link
// @version      2.7.1
// @description  Click any Zendesk conversation timestamp to copy as YYYY-MM-DD HH:mm TZ. Also rewrites all visible timestamps to that format. Respects the Zendesk user's time zone setting. Tooltip shows browser local time.
// @match        https://*.zendesk.com/agent/*
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
  'use strict';

  const STYLE_ID = 'ztc-toast-style';
  const TZ_STORAGE_KEY = 'ztc_tz_override';

  const OBSERVER_CONFIG = {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-label'],
  };

  // --- Manual override menu command ---

  GM_registerMenuCommand('Set time zone override', () => {
    const current = GM_getValue(TZ_STORAGE_KEY, '');
    const input = prompt(
      'Enter the time zone from your Zendesk profile (e.g. "America/New_York", "Europe/London").\n\n' +
      'This should match: Zendesk → Profile → Time zone.\n\n' +
      'Leave blank to clear the override and use auto-detection.\n\n' +
      'Current override:',
      current
    );

    if (input === null) return;

    const trimmed = input.trim();

    if (trimmed === '') {
      GM_setValue(TZ_STORAGE_KEY, '');
      alert('Override cleared. Reload the page to use auto-detection.');
      return;
    }

    if (!isValidTimeZone(trimmed)) {
      alert(`"${trimmed}" is not a recognized time zone. No changes made.`);
      return;
    }

    GM_setValue(TZ_STORAGE_KEY, trimmed);
    alert(`Time zone override set to "${trimmed}". Reload the page to apply.`);
  });

  // --- Correct Zendesk's datetime offset bug ---

  function correctDatetime(iso) {
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  }

  // --- Time zone–aware formatter ---

  function buildFormatter(iana) {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: iana,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'short',
    });

    return function formatTime(iso) {
      const d = correctDatetime(iso);
      const parts = Object.fromEntries(
        dtf.formatToParts(d).map(({ type, value }) => [type, value])
      );
      return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${parts.timeZoneName}`;
    };
  }

  function isValidTimeZone(tz) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }

  async function resolveTimeZone() {
    const override = GM_getValue(TZ_STORAGE_KEY, '');

    // 1. Zendesk API (always tried first)
    try {
      const res = await fetch('/api/v2/users/me.json');
      if (res.ok) {
        const data = await res.json();
        const tz = data?.user?.iana_time_zone;
        if (tz && isValidTimeZone(tz)) {
          if (override) {
            GM_setValue(TZ_STORAGE_KEY, '');
            console.log(`[Zendesk Timestamp Copier] API recovered. Cleared stale override (was "${override}").`);
          }
          return { tz, source: 'zendesk' };
        }
      }
    } catch {
      // fall through
    }

    // 2. API failed — use override if available
    if (override && isValidTimeZone(override)) {
      return { tz: override, source: 'override' };
    }

    // 3. Browser fallback
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (localTz && isValidTimeZone(localTz)) {
      return { tz: localTz, source: 'browser' };
    }

    // 4. Nothing worked
    return { tz: null, source: 'none' };
  }

  // --- Warning banner ---

  function showWarning(tz) {
    const banner = document.createElement('div');
    banner.textContent = tz
      ? `⚠️ Zendesk Timestamp Copier: Could not read your Zendesk time zone. Using browser time zone (${tz}). Try reloading. If this persists, use the Tampermonkey menu to set a manual time zone override.`
      : `⚠️ Zendesk Timestamp Copier: Could not determine any time zone. Timestamp rewriting is disabled. Use the Tampermonkey menu to set a manual time zone override.`;
    Object.assign(banner.style, {
      position: 'fixed',
      bottom: '12px',
      right: '12px',
      zIndex: '999999',
      padding: '8px 14px',
      background: tz ? '#fff3cd' : '#f8d7da',
      color: tz ? '#856404' : '#721c24',
      border: `1px solid ${tz ? '#ffc107' : '#f5c6cb'}`,
      borderRadius: '6px',
      fontSize: '13px',
      maxWidth: '420px',
      boxShadow: '0 2px 8px rgba(0,0,0,.15)',
      cursor: 'pointer',
    });
    banner.title = 'Click to dismiss';
    banner.addEventListener('click', () => banner.remove());
    document.body.appendChild(banner);
  }

  // --- Skip check for non-conversation timestamps ---

  function shouldSkip(el) {
    if (el.closest('td')) return true;
    if (el.closest('[data-test-id="sla-policy-metric"]')) return true;
    return false;
  }

  // --- Rewrite timestamps ---

  function rewriteTime(el, formatTime, formatTimeLocal) {
    if (el.dataset.ztcFlashing) return;
    if (shouldSkip(el)) return;
    const dt = el.getAttribute('datetime');
    const formatted = formatTime(dt);
    if (el.textContent === formatted) return;
    el.textContent = formatted;
    if (formatTimeLocal) {
      el.title = formatTimeLocal(dt);
    }
  }

  function collectTimeElements(mutations) {
    const targets = new Set();
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        if (mutation.target.matches('time[datetime]')) {
          targets.add(mutation.target);
        }
      } else if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.matches('time[datetime]')) targets.add(node);
          const nested = node.querySelectorAll?.('time[datetime]');
          if (nested) for (const t of nested) targets.add(t);
        }
      }
    }
    return [...targets];
  }

  // --- Flash feedback ---

  function flash(el, msg) {
    el.dataset.ztcFlashing = '1';
    const orig = el.textContent;
    el.textContent = msg;
    el.style.color = '#1f73b7';
    el.style.fontWeight = '600';
    setTimeout(() => {
      el.textContent = orig;
      el.style.removeProperty('color');
      el.style.removeProperty('font-weight');
      delete el.dataset.ztcFlashing;
    }, 800);
  }

  // --- Style injection + suppress Zendesk's Garden tooltip on <time> ---

  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      'time[datetime] { cursor: pointer !important; }',
      'body.ztc-hovering-time [data-garden-id="tooltip.tooltip"] { display: none !important; }',
    ].join('\n');
    document.head.appendChild(s);
  }

  let hoverTimeout = null;

  document.addEventListener('mouseover', (e) => {
    if (e.target.closest('time[datetime]')) {
      clearTimeout(hoverTimeout);
      document.body.classList.add('ztc-hovering-time');
    }
  }, true);

  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('time[datetime]')) {
      hoverTimeout = setTimeout(() => {
        document.body.classList.remove('ztc-hovering-time');
      }, 500);
    }
  }, true);

  // --- Init ---

  resolveTimeZone().then(({ tz, source }) => {
    if (source === 'none') {
      showWarning(null);
      return;
    }

    if (source === 'browser') {
      showWarning(tz);
    }

    const formatTime = buildFormatter(tz);
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const formatTimeLocal = (browserTz && browserTz !== tz)
      ? buildFormatter(browserTz)
      : null;

    // Observer (debounced + scoped)
    let pendingMutations = [];
    let rafId = null;

    function processBatch() {
      rafId = null;
      const timeElements = collectTimeElements(pendingMutations);
      pendingMutations = [];
      if (timeElements.length === 0) return;

      observer.disconnect();
      for (const el of timeElements) {
        rewriteTime(el, formatTime, formatTimeLocal);
      }
      observer.observe(document.body, OBSERVER_CONFIG);
    }

    const observer = new MutationObserver((mutations) => {
      pendingMutations.push(...mutations);
      if (rafId === null) {
        rafId = requestAnimationFrame(processBatch);
      }
    });

    observer.observe(document.body, OBSERVER_CONFIG);

    // Initial pass
    document.querySelectorAll('time[datetime]').forEach((el) => {
      rewriteTime(el, formatTime, formatTimeLocal);
    });

    // Click handler
    document.addEventListener('click', (e) => {
      const timeEl = e.target.closest('time[datetime]');
      if (!timeEl) return;
      if (shouldSkip(timeEl)) return;

      const formatted = formatTime(timeEl.getAttribute('datetime'));
      GM_setClipboard(formatted, 'text');

      flash(timeEl, '✓ Copied!');
      e.preventDefault();
      e.stopPropagation();
    }, true);
  });
})();