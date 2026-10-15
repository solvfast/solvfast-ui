/**
 * binaDropdown.js — shared Bina-overlay helpers
 *
 * Provides the primary dropdown (My Workspace › | Dark Mode | Logout),
 * the workspace flyout panel, and the custom sidebar header — injected
 * into any same-origin iframe as parent-document overlays.
 *
 * Used by: AccountsScreen, SenaiyScreen
 */

// Official app logos (shown BARE — no colored chip) for the workspace switcher
// flyout. These are the SAME assets the My Workspace home screen uses, so the two
// surfaces are identical.
import myWorkLogo from '../../assets/applogos/my-work.svg';
import myWorkspaceLogo from '../../assets/applogos/my-workspace.svg';
import mySquadsLogo from '../../assets/applogos/my-squads.png';
import servefastLogo from '../../assets/applogos/servefast.png';
import sadaLogo from '../../assets/applogos/sada.svg';
import rasdLogo from '../../assets/applogos/rasd.svg';
import saqrBiLogo from '../../sear_studio/assets/source-logos/saqr-bi.png';
// Strategic Management (Saqr suite) uses the illustrated SOURCE-APP logos (same art as
// Saqr BI's source apps) in the switcher — NOT the My Workspace home SVGs.
import marsadLogo from '../../sear_studio/assets/source-logos/marsad.png';
import mizanLogo from '../../sear_studio/assets/source-logos/mizan.png';
import boslahLogo from '../../sear_studio/assets/source-logos/boslah.png';
import hawkamaLogo from '../../sear_studio/assets/source-logos/hawkama.png';
import experienceLogo from '../../assets/applogos/experience-center.svg';
// Knowledge Hub uses the illustrated logos in the switcher only (not the home screen).
import senaiypediaLogo from '../../sear_studio/assets/source-logos/senaiypedia.png';
import senaiyLogo from '../../assets/applogos/senaiy.svg';
import orgStructureLogo from '../../sear_studio/assets/source-logos/org-structure-icon.png';
import portalLogo from '../../sear_studio/assets/source-logos/customer-icon.png';
import searStudioLogo from '../../assets/applogos/sear-studio.svg';
import sewarLogo from '../../assets/applogos/sewar.svg';
import launchfastLogo from '../../assets/launchfast-logo.svg';
import dealfastLogo from '../../assets/dealfast-logo.svg';
import consultationfastLogo from '../../assets/consultationfast-logo.svg';

// ─── Constants ────────────────────────────────────────────────────────────────

export const DROPDOWN_W = 216; // px — fixed width of the primary dropdown

// ─── SVG glyph paths — match WorkspaceScreen.jsx exactly ─────────────────────

export const G = {
  orgChart:
    `<rect x="9" y="2" width="6" height="4" rx="1"/>
     <rect x="1" y="16" width="6" height="4" rx="1"/>
     <rect x="9" y="16" width="6" height="4" rx="1"/>
     <rect x="17" y="16" width="6" height="4" rx="1"/>
     <line x1="12" y1="6" x2="12" y2="11"/>
     <line x1="4" y1="16" x2="4" y2="11"/>
     <line x1="12" y1="16" x2="12" y2="11"/>
     <line x1="20" y1="16" x2="20" y2="11"/>
     <line x1="4" y1="11" x2="20" y2="11"/>`,
  robot:
    `<rect x="7" y="8" width="10" height="9" rx="2"/>
     <circle cx="9.5" cy="11.5" r="1.2" fill="white"/>
     <circle cx="14.5" cy="11.5" r="1.2" fill="white"/>
     <path d="M10 15 Q12 17 14 15"/>
     <line x1="12" y1="8" x2="12" y2="5"/>
     <circle cx="12" cy="4" r="1.5" fill="white"/>
     <line x1="7" y1="12" x2="5" y2="12"/>
     <line x1="17" y1="12" x2="19" y2="12"/>`,
  eagle:
    `<path d="M12 3 L5 9 L3 17 L7.5 14.5 L12 21 L16.5 14.5 L21 17 L19 9 Z"/>
     <circle cx="12" cy="9.5" r="2" fill="white"/>`,
  buildingBlocks:
    `<rect x="2" y="13" width="8" height="8" rx="1.5"/>
     <rect x="11" y="13" width="8" height="8" rx="1.5"/>
     <rect x="6.5" y="5" width="8" height="8" rx="1.5"/>`,
  gear:
    `<circle cx="12" cy="12" r="3"/>
     <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06
              a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09
              A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83
              l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09
              A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83
              l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09
              a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83
              l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09
              a1.65 1.65 0 0 0-1.51 1z"/>`,
  rocket:
    `<path d="M12 2C12 2 7 7 7 13h10C17 7 12 2 12 2z"/>
     <path d="M7 13c-2 0-4 2.5-4 4h18c0-1.5-2-4-4-4"/>
     <line x1="12" y1="13" x2="12" y2="21"/>
     <line x1="9.5" y1="18.5" x2="12" y2="21"/>
     <line x1="14.5" y1="18.5" x2="12" y2="21"/>
     <circle cx="12" cy="8" r="1.5" fill="white"/>`,
  handshake:
    `<path d="M9 11L7 9H3l3 7h4l2-1"/>
     <path d="M15 11l2-2h4l-3 7h-4l-2-1"/>
     <path d="M9 11l3 3 3-3"/>
     <line x1="12" y1="14" x2="12" y2="18"/>`,
  lightbulb:
    `<path d="M9 21h6M10 17h4M12 3a6 6 0 0 1 6 6c0 2.5-1.5 4.5-3 5.5V17H9v-2.5C7.5 13.5 6 11.5 6 9a6 6 0 0 1 6-6z"/>`,
  moon:
    `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`,
  sun:
    `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/>
     <line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
     <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/>
     <line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
     <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`,
  home:
    `<path d="M3 9.5 12 3l9 6.5"/><path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10"/>`,
  grid:
    `<rect x="1" y="1" width="6" height="6" rx="1"/>
     <rect x="9" y="1" width="6" height="6" rx="1"/>
     <rect x="1" y="9" width="6" height="6" rx="1"/>
     <rect x="9" y="9" width="6" height="6" rx="1"/>`,
  logout:
    `<path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M10 11l3-3-3-3M13 8H6"/>`,
  clipboard:
    `<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><polyline points="9 12 11 14 15 10"/>`,
  headset:
    `<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>`,
  soundWaves:
    `<path d="M12 5a7 7 0 0 1 7 7"/><path d="M12 5a7 7 0 0 0-7 7"/><path d="M12 9a3 3 0 0 1 3 3"/><path d="M12 9a3 3 0 0 0-3 3"/><circle cx="12" cy="12" r="1" fill="white" stroke="none"/>`,
  layers:
    `<rect x="2" y="16" width="20" height="3" rx="1"/><rect x="2" y="10.5" width="20" height="3" rx="1"/><rect x="2" y="5" width="20" height="3" rx="1"/>`,
  magnifierList:
    `<circle cx="10" cy="10" r="7"/><line x1="15.5" y1="15.5" x2="21" y2="21"/><line x1="7" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="11" y2="12"/>`,
  scale:
    `<line x1="12" y1="3" x2="12" y2="20"/><path d="M5 20h14"/><path d="M5 9l-3 6h6z"/><path d="M19 9l-3 6h6z"/><line x1="5" y1="9" x2="19" y2="9"/>`,
  openBook:
    `<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>`,
  bookBookmark:
    `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><polyline points="12 6 14 8 12 10 10 8 12 6"/>`,
  compass:
    `<circle cx="12" cy="12" r="9"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>`,
  users:
    `<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5"/><path d="M16.5 4.2a3.2 3.2 0 0 1 0 6.1"/><path d="M21.5 20c0-2.6-1.6-4.5-4-5.2"/>`,
};

// ─── Workspace sections — mirrors WorkspaceScreen.jsx exactly ─────────────────

export const WORKSPACE_SECTIONS = [
  {
    title: 'My Work',
    items: [
      { name: 'My Work', url: '/client-s-ia/my_work', logo: myWorkLogo },
    ],
  },
  {
    title: 'Packages',
    groups: [
      {
        label: 'Industry Package',
        items: [
          { name: 'ServeFast', url: '/client-s-ia/workspace/packages/servefast', logo: servefastLogo },
        ],
      },
      {
        label: 'Complementary',
        items: [
          { name: 'Sada', url: '/client-s-ia/workspace/packages/sada', logo: sadaLogo },
          { name: 'Rasd', url: '/client-s-ia/workspace/packages/rasd', logo: rasdLogo },
        ],
      },
    ],
  },
  {
    title: 'Strategic Management',
    items: [
      { name: 'Saqr BI', url: '/client-s-ia/workspace/knowledge/saqr_bi',  logo: saqrBiLogo },
      { name: 'Marsad',  url: '/client-s-ia/workspace/knowledge/marsad',   logo: marsadLogo },
      { name: 'Mizan',   url: '/client-s-ia/workspace/knowledge/mizan',    logo: mizanLogo },
      { name: 'Boslah',  url: '/client-s-ia/workspace/knowledge/bosla',    logo: boslahLogo },
      { name: 'Hawkama', url: '/client-s-ia/workspace/knowledge/hawkama',  logo: hawkamaLogo },
    ],
  },
  {
    title: 'Customer Experience',
    items: [
      { name: 'Experience Center', url: '/client-s-ia/workspace/knowledge/experience_center', logo: experienceLogo },
    ],
  },
  {
    // Part 2 §2.1 — Playbooks moved into Sear Studio (BUILD), so it is no longer a
    // standalone Knowledge Hub app in the switcher.
    title: 'Knowledge Hub',
    items: [
      { name: 'Senaiy-Pedia', url: '/client-s-ia/workspace/knowledge/senaiypedia', logo: senaiypediaLogo },
    ],
  },
  {
    title: 'AI Operations',
    items: [
      { name: 'Senaiy Agentic System', url: '/client-s-ia/workspace/build/senaiy', logo: senaiyLogo },
    ],
  },
  {
    title: 'Administration',
    items: [
      { name: 'Organization Structure',         url: '/client-s-ia/workspace/build/organization_structure',        logo: orgStructureLogo },
      { name: 'Customer Portal Configuration',  url: '/client-s-ia/workspace/build/customer_portal_configuration', logo: portalLogo },
    ],
  },
  {
    title: 'Build',
    items: [
      { name: 'Sear Studio',       url: '/client-s-ia/workspace/build/sear_studio', logo: searStudioLogo },
      { name: 'Sewar App Builder', url: '/client-s-ia/workspace/build/sewar',       logo: sewarLogo },
    ],
  },
  {
    title: 'Squad Packages',
    items: [
      { name: 'Product Development Squad',  url: '/client-s-ia/workspace/squads/launchfast',       logo: launchfastLogo },
      { name: 'Digital Consultation Squad', url: '/client-s-ia/workspace/squads/consultationfast', logo: consultationfastLogo },
      { name: 'Business Development Squad',  url: '/client-s-ia/workspace/squads/dealfast',         logo: dealfastLogo },
    ],
  },
];

// ─── DOM helpers ──────────────────────────────────────────────────────────────

export function el(doc, tag, css, html) {
  const e = doc.createElement(tag);
  if (css)  e.style.cssText = css;
  if (html) e.innerHTML = html;
  return e;
}

export function divider(doc) {
  return el(doc, 'div', 'height:1px;background:#E5E7EB;margin:4px 0;');
}

// vb: viewBox size — use 16 for icons designed in 16×16 space (grid, arrows, logout),
//                     24 for icons in 24×24 space (moon and all WorkspaceScreen glyphs)
export function svgIcon(doc, inner, size = 14, color = '#9CA3AF', vb = 24) {
  const wrap = doc.createElement('span');
  wrap.style.cssText = 'display:flex;align-items:center;flex-shrink:0;';
  wrap.innerHTML =
    `<svg width="${size}" height="${size}" viewBox="0 0 ${vb} ${vb}"
          fill="none" stroke="${color}" stroke-width="1.5"
          stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  return wrap;
}

// Gradient tile matching WorkspaceScreen's IconTile
export function gradientTile(doc, svgInner) {
  const tile = el(doc, 'div',
    'width:26px;height:26px;border-radius:6px;flex-shrink:0;' +
    'display:flex;align-items:center;justify-content:center;padding:4px;' +
    'background:linear-gradient(135deg,#FE4E18,#512195);'
  );
  tile.innerHTML =
    `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.75"
          stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%">
       ${svgInner}
     </svg>`;
  return tile;
}

// Single app row in the flyout: icon + label, clickable
export function appRow(doc, item, currentApp) {
  const isCurrent = item.name === currentApp;
  const row = el(doc, 'button',
    'display:flex;align-items:center;gap:10px;width:100%;padding:7px 14px;' +
    'background:transparent;border:none;cursor:pointer;border-radius:6px;' +
    'transition:background 0.1s;font-family:Alexandria,sans-serif;'
  );

  // Official app logo, shown BARE (no colored chip behind it).
  const icon = el(doc, 'img', 'width:26px;height:26px;object-fit:contain;flex-shrink:0;');
  icon.src = item.logo;
  icon.alt = '';

  const label = el(doc, 'span',
    'font-size:13px;font-family:Alexandria,sans-serif;text-align:left;' +
    (isCurrent ? 'color:#512195;font-weight:600;' : 'color:#111827;font-weight:400;')
  );
  label.textContent = item.name;

  row.appendChild(icon);
  row.appendChild(label);
  row.addEventListener('mouseenter', () => { row.style.background = '#F5F0FF'; });
  row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });
  // window = parent window in this closure → navigates the parent
  row.addEventListener('click', e => { e.stopPropagation(); window.location.href = item.url; });
  return row;
}

// ─── Flyout panel ─────────────────────────────────────────────────────────────

export function buildFlyout(parentDoc, currentApp) {
  const flyout = el(parentDoc, 'div',
    'display:none;position:fixed;z-index:2147483647;' +
    'background:#fff;border:1px solid #E5E7EB;' +
    'border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.18);' +
    'min-width:240px;max-width:290px;padding:6px 0;' +
    'max-height:82vh;overflow-y:auto;font-family:Alexandria,sans-serif;' +
    'direction:ltr;text-align:left;'  // force LTR — parent may be RTL (Arabic default)
  );
  flyout.id = '_bina_flyout';

  function sectionHeader(title) {
    const h = el(parentDoc, 'div',
      'font-size:10px;font-weight:700;color:#512195;text-transform:uppercase;' +
      'letter-spacing:0.09em;padding:10px 14px 4px;'
    );
    h.textContent = title;
    return h;
  }

  function subGroupHeader(label) {
    const h = el(parentDoc, 'div',
      'font-size:10px;font-weight:500;color:#9CA3AF;text-transform:uppercase;' +
      'letter-spacing:0.07em;padding:8px 14px 2px;'
    );
    h.textContent = label;
    return h;
  }

  // No "My Workspace" header row here — the LEFT dropdown's "My Workspace ›" row is the
  // trigger/destination for the workspace home; this RIGHT panel is purely the app list.
  WORKSPACE_SECTIONS.forEach((sec, i) => {
    if (i > 0) flyout.appendChild(divider(parentDoc));
    flyout.appendChild(sectionHeader(sec.title));

    if (sec.groups) {
      sec.groups.forEach((grp, gi) => {
        if (gi > 0) flyout.appendChild(el(parentDoc, 'div', 'height:1px;background:#F3F4F6;margin:2px 0;'));
        flyout.appendChild(subGroupHeader(grp.label));
        grp.items.forEach(item => flyout.appendChild(appRow(parentDoc, item, currentApp)));
      });
    } else {
      sec.items.forEach(item => flyout.appendChild(appRow(parentDoc, item, currentApp)));
    }
  });

  return flyout;
}

// ─── Primary dropdown ─────────────────────────────────────────────────────────
// iframeDoc is used only for sidebar-right positioning of the flyout.

function getSidebarRight(iframeDoc) {
  if (!iframeDoc) return 288;
  const aside = iframeDoc.querySelector('aside');
  if (aside) return aside.getBoundingClientRect().right;
  const nav = iframeDoc.querySelector('nav');
  const parent = nav && nav.parentElement;
  if (parent) return parent.getBoundingClientRect().right;
  return 288;
}

export function buildDropdown(parentDoc, flyout, iframeDoc, opts = {}) {
  // Plan 0071 — the red bottom action is configurable. Default = "My Workspace"
  // → the workspace; Accounts & Contracts passes a "Logout" → landing page.
  const logoutText = opts.logoutLabel || 'Back to My Workspace';
  const logoutHref = opts.logoutHref || '/client-s-ia/workspace';
  const logoutColor = opts.logoutColor || '#EF4444';      // Flame Orange (#fe4e18) for real Log out
  const logoutHoverBg = opts.logoutHoverBg || '#FEF2F2';
  const clearSession = !!opts.clearSession;               // true → clears the signed-in flag (real logout)
  const wrap = el(parentDoc, 'div',
    `display:none;position:fixed;z-index:2147483647;` +
    `background:#fff;border:1px solid #E5E7EB;` +
    `border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.14);` +
    `width:${DROPDOWN_W}px;padding:6px 0;font-family:Alexandria,sans-serif;` +
    `direction:ltr;text-align:left;`  // force LTR — parent may be RTL (Arabic default)
  );
  wrap.id = '_bina_dropdown';

  // ── 1. My Workspace › ─────────────────────────────────────────────────
  const wsRow = el(parentDoc, 'div',
    'display:flex;align-items:center;justify-content:space-between;' +
    'padding:8px 14px;cursor:pointer;border-radius:6px;transition:background 0.1s;'
  );
  const wsLeft = el(parentDoc, 'div', 'display:flex;align-items:center;gap:8px;');
  const wsIcon = el(parentDoc, 'img', 'width:22px;height:22px;object-fit:contain;flex-shrink:0;');
  wsIcon.src = myWorkspaceLogo; wsIcon.alt = '';
  wsLeft.appendChild(wsIcon);
  const wsLabel = el(parentDoc, 'span', 'font-size:13px;color:#111827;font-family:Alexandria,sans-serif;');
  wsLabel.textContent = 'My Workspace';
  wsLeft.appendChild(wsLabel);
  wsRow.appendChild(wsLeft);
  wsRow.appendChild(svgIcon(parentDoc, `<polyline points="6,4 10,8 6,12"/>`, 12, '#9CA3AF', 16));
  wrap.appendChild(wsRow);

  // Flyout show/hide
  let hideTimer;
  function showFlyout() {
    clearTimeout(hideTimer);
    const sidebarRight = getSidebarRight(iframeDoc);
    const rowRect = wsRow.getBoundingClientRect();
    flyout.style.top     = rowRect.top + 'px';
    flyout.style.left    = (sidebarRight + 8) + 'px';
    flyout.style.display = 'block';
  }
  function scheduleFlyoutHide() {
    hideTimer = setTimeout(() => { flyout.style.display = 'none'; }, 150);
  }
  wsRow.addEventListener('mouseenter', () => { wsRow.style.background = '#F5F0FF'; showFlyout(); });
  wsRow.addEventListener('mouseleave', () => { wsRow.style.background = 'transparent'; scheduleFlyoutHide(); });
  // Click → go to the full My Workspace home (hover/expand opens the app fly-out).
  wsRow.addEventListener('click', e => { e.stopPropagation(); window.location.href = '/client-s-ia/workspace'; });
  flyout.addEventListener('mouseenter', () => { clearTimeout(hideTimer); });
  flyout.addEventListener('mouseleave', scheduleFlyoutHide);

  // ── 1b. My Squads (new destination) ───────────────────────────────────
  const sqRow = el(parentDoc, 'div',
    'display:flex;align-items:center;gap:8px;padding:8px 14px;cursor:pointer;' +
    'border-radius:6px;transition:background 0.1s;'
  );
  const sqIcon = el(parentDoc, 'div',
    'width:22px;height:22px;border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;'
  );
  sqIcon.innerHTML =
    `<img src="${mySquadsLogo}" alt="" style="width:22px;height:22px;object-fit:contain;" />`;
  sqRow.appendChild(sqIcon);
  const sqLabel = el(parentDoc, 'span', 'font-size:13px;color:#111827;font-family:Alexandria,sans-serif;');
  sqLabel.textContent = 'My Squads';
  sqRow.appendChild(sqLabel);
  sqRow.addEventListener('mouseenter', () => { sqRow.style.background = '#F5F0FF'; });
  sqRow.addEventListener('mouseleave', () => { sqRow.style.background = 'transparent'; });
  sqRow.addEventListener('click', e => { e.stopPropagation(); window.location.href = '/client-s-ia/workspace/squads'; });
  wrap.appendChild(sqRow);

  // ── 2. Theme toggle — label + icon reflect the CURRENT theme ──────────
  //     light → "Dark Mode" + moon · dark → "Light Mode" + sun.
  const darkRow = el(parentDoc, 'div',
    'display:flex;align-items:center;gap:8px;padding:8px 14px;cursor:pointer;' +
    'border-radius:6px;transition:background 0.1s;'
  );
  const darkIcon = el(parentDoc, 'span', 'display:flex;align-items:center;flex-shrink:0;');
  const darkLabel = el(parentDoc, 'span', 'font-size:13px;color:#111827;font-family:Alexandria,sans-serif;');
  darkRow.appendChild(darkIcon);
  darkRow.appendChild(darkLabel);
  // The visible surface is the embedded portal (iframeDoc). Reflect ITS theme —
  // not the parent app's — so the row reads "Dark Mode" while the portal is light.
  const isDarkNow = () => {
    try { if (iframeDoc) return iframeDoc.documentElement.classList.contains('dark'); } catch (_) { /* ignore */ }
    return document.documentElement.classList.contains('dark');
  };
  const renderThemeRow = () => {
    const dark = isDarkNow();
    darkIcon.innerHTML =
      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF"
            stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${dark ? G.sun : G.moon}</svg>`;
    darkLabel.textContent = dark ? 'Light Mode' : 'Dark Mode';
  };
  renderThemeRow();
  darkRow.addEventListener('mouseenter', () => { darkRow.style.background = '#F5F5F5'; });
  darkRow.addEventListener('mouseleave', () => { darkRow.style.background = 'transparent'; });
  darkRow.addEventListener('click', e => {
    e.stopPropagation();
    // The visible surface is the embedded portal — an iframe with its OWN <html> + theme
    // state. Toggling only the parent app (bina:toggle-dark) flips nothing the user sees,
    // so drive the portal's own theme toggle button too. Parent is flipped as well to keep
    // both surfaces in sync when navigating out of the portal.
    window.dispatchEvent(new CustomEvent('bina:toggle-dark'));
    try {
      const hdr = iframeDoc && iframeDoc.querySelector('header');
      const grp = hdr && hdr.lastElementChild;          // right-side action group
      const btns = grp && grp.querySelectorAll('button');
      if (btns && btns.length) btns[btns.length - 1].click();  // theme toggle = last button
    } catch (_) { /* ignore */ }
    setTimeout(renderThemeRow, 60);  // re-read after the theme class is applied
  });
  wrap.appendChild(darkRow);

  // ── 3. Home → landing page ────────────────────────────────────────────
  const homeRow = el(parentDoc, 'div',
    'display:flex;align-items:center;gap:8px;padding:8px 14px;cursor:pointer;' +
    'border-radius:6px;transition:background 0.1s;'
  );
  homeRow.appendChild(svgIcon(parentDoc, G.home, 14, '#9CA3AF', 24));
  const homeLabel = el(parentDoc, 'span', 'font-size:13px;color:#111827;font-family:Alexandria,sans-serif;');
  homeLabel.textContent = 'Home';
  homeRow.appendChild(homeLabel);
  homeRow.addEventListener('mouseenter', () => { homeRow.style.background = '#F5F5F5'; });
  homeRow.addEventListener('mouseleave', () => { homeRow.style.background = 'transparent'; });
  homeRow.addEventListener('click', e => { e.stopPropagation(); window.location.href = '/client-s-ia'; });
  wrap.appendChild(homeRow);

  // ── 4. Separator + Logout ─────────────────────────────────────────────
  wrap.appendChild(divider(parentDoc));
  const logoutBtn = el(parentDoc, 'button',
    'display:flex;align-items:center;gap:8px;width:100%;padding:8px 14px;' +
    `font-size:13px;color:${logoutColor};background:transparent;border:none;cursor:pointer;` +
    'border-radius:6px;transition:background 0.1s;font-family:Alexandria,sans-serif;'
  );
  logoutBtn.appendChild(svgIcon(parentDoc, G.logout, 14, logoutColor, 16));
  const logoutLabel = el(parentDoc, 'span');
  logoutLabel.textContent = logoutText;
  logoutBtn.appendChild(logoutLabel);
  logoutBtn.addEventListener('mouseenter', () => { logoutBtn.style.background = logoutHoverBg; });
  logoutBtn.addEventListener('mouseleave', () => { logoutBtn.style.background = 'transparent'; });
  logoutBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (clearSession) { try { localStorage.removeItem('bina_signed_in'); } catch (_) { /* ignore */ } }
    window.location.href = logoutHref;
  });
  wrap.appendChild(logoutBtn);

  return wrap;
}

// ─── Custom sidebar header (goes inside the iframe) ───────────────────────────

export function buildBinaHeader(iframeDoc, logoUrl, appName, dropdown, flyout) {
  // Explicit theme-agnostic hairline so the logo section is always divided from
  // the nav (matches Sear Studio's `border-b`), regardless of the embedded
  // portal's own --border value (which can resolve near-invisible).
  // Fixed 64px tall (box-border, border included) so it exactly matches the portal's own
  // logo header (h-16) + content top bar (~64px) — keeps the sidebar/content divider lines aligned.
  const header = el(iframeDoc, 'div', 'flex-shrink:0;box-sizing:border-box;height:64px;border-bottom:1px solid rgba(127,127,127,0.22);');
  header.id = '_bina_header';

  const row = el(iframeDoc, 'div', 'display:flex;align-items:center;gap:10px;padding:0 12px;height:100%;box-sizing:border-box;');

  const img = el(iframeDoc, 'img',
    'width:36px;height:36px;border-radius:8px;object-fit:contain;flex-shrink:0;cursor:pointer;'
  );
  img.src = logoUrl;
  img.alt = 'Rihlat Travel';

  const col = el(iframeDoc, 'div', 'flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;cursor:pointer;');

  // Clicking the logo / name (not the chevron) returns to the landing / home page.
  const goHome = () => { window.location.href = '/client-s-ia'; };
  img.addEventListener('click', goHome);
  col.addEventListener('click', goHome);
  const name = el(iframeDoc, 'span',
    'font-size:14px;font-weight:700;color:var(--foreground,#111827);' +
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:Alexandria,sans-serif;'
  );
  name.textContent = 'Rihlat Travel';

  // Pill colors are theme-aware via injected CSS so they react to the portal's `.dark`
  // class — violet on a light tint in light mode, brightened violet (#9B7FD4) in dark.
  if (!iframeDoc.getElementById('_bina_pill_style')) {
    const ps = iframeDoc.createElement('style');
    ps.id = '_bina_pill_style';
    ps.textContent =
      '#_bina_header ._bina_app_pill{background:rgba(81,33,149,0.10);color:#512195;}' +
      '.dark #_bina_header ._bina_app_pill{background:rgba(155,127,212,0.20);color:#9B7FD4;}';
    (iframeDoc.head || iframeDoc.documentElement).appendChild(ps);
  }
  const pill = el(iframeDoc, 'span',
    'display:inline-block;font-size:10px;font-weight:400;' +
    'padding:1px 9px;border-radius:999px;width:fit-content;line-height:18px;font-family:Alexandria,sans-serif;'
  );
  pill.className = '_bina_app_pill';
  pill.textContent = appName;

  col.appendChild(name);
  col.appendChild(pill);

  // Chevron button — toggles the primary dropdown
  const btn = el(iframeDoc, 'button',
    'border:1px solid var(--border,#E5E7EB);border-radius:6px;width:28px;height:28px;' +
    'display:flex;align-items:center;justify-content:center;background:transparent;' +
    'cursor:pointer;flex-shrink:0;color:var(--muted-foreground,#6B7280);transition:all 0.15s;',
    `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
       <polyline points="4,6 8,10 12,6"/>
     </svg>`
  );
  btn.id = '_bina_menu_btn';
  btn.addEventListener('mouseenter', () => { btn.style.borderColor = '#512195'; btn.style.color = '#512195'; });
  btn.addEventListener('mouseleave', () => {
    btn.style.borderColor = 'var(--border,#E5E7EB)';
    btn.style.color       = 'var(--muted-foreground,#6B7280)';
  });

  btn.addEventListener('click', e => {
    e.stopPropagation(); // prevent iframeDoc click→closeAll from firing
    const isOpen = dropdown.style.display !== 'none';
    flyout.style.display = 'none';
    if (isOpen) {
      dropdown.style.display = 'none';
    } else {
      const sidebarRight = getSidebarRight(iframeDoc);
      const hRect        = header.getBoundingClientRect(); // iframe coords === parent coords (fixed inset-0)
      dropdown.style.top  = (hRect.bottom + 6) + 'px';
      dropdown.style.left = (sidebarRight - DROPDOWN_W - 4) + 'px'; // right-aligned to sidebar
      dropdown.style.display = 'block';
    }
  });

  row.appendChild(img);
  row.appendChild(col);
  row.appendChild(btn);
  header.appendChild(row);
  return header;
}

// ─── Overlay mount helper ─────────────────────────────────────────────────────
// Mounts dropdown+flyout in the parent document (above the iframe) and
// registers the close-on-outside-click listeners for both documents.

export function mountOverlays(parentDoc, iframeDoc, flyout, dropdown) {
  parentDoc.body.appendChild(flyout);
  parentDoc.body.appendChild(dropdown);

  // Clicks inside the overlays must not close them
  dropdown.addEventListener('click', e => e.stopPropagation());
  flyout.addEventListener('click', e => e.stopPropagation());

  const closeAll = () => {
    dropdown.style.display = 'none';
    flyout.style.display   = 'none';
  };
  iframeDoc.addEventListener('click', closeAll);
  parentDoc.addEventListener('click', closeAll);
}

// ─── Cleanup helper ───────────────────────────────────────────────────────────

export function cleanupOverlays() {
  ['_bina_dropdown', '_bina_flyout'].forEach(id => {
    const node = document.getElementById(id);
    if (node) node.remove();
  });
}
