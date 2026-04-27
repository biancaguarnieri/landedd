// va/nav.js — Shared sidebar navigation for Landedd VA
// Include in each VA page before </body>
// Requires: <aside id="va-nav"></aside> and <div class="va-main"> in each page

(function () {
  'use strict';

  var PATH = window.location.pathname;

  function isActive(href) {
    if (!href) return false;
    var a = href.replace(/index\.html$/, '').replace(/\/$/, '') || '/';
    var b = PATH.replace(/index\.html$/, '').replace(/\/$/, '') || '/';
    return b === a || b.endsWith(a);
  }

  var NAV = [
    {
      group: 'Free',
      items: [
        { label: 'JOA Classifier', icon: '🔍', href: '/va/', status: 'live', desc: 'Detect your hiring tier' }
      ]
    },
    {
      group: 'Launching May 9',
      items: [
        { label: 'VA Fit Scanner', icon: '📊', href: null, status: 'coming', desc: 'Resume vs. role scoring' },
        { label: 'Resume Tailor', icon: '✏️', href: null, status: 'coming', desc: 'Tier-compliant rewrite' },
        { label: 'Questionnaire Strategy', icon: '📝', href: null, status: 'coming', desc: 'Maximize your rating' },
        { label: 'Premium Package', icon: '📦', href: null, status: 'coming', desc: 'Full application, built for you' }
      ]
    },
    {
      group: 'Resources',
      items: [
        { label: 'Application Roadmap', icon: '🗺️', href: '/va/roadmap.html', status: 'live', desc: 'Your step-by-step guide' }
      ]
    }
  ];

  function buildHTML() {
    var html = '<div class="vn-logo-wrap">'
      + '<a class="vn-logo" href="/va/">'
      + '<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" width="26" height="26">'
      + '<circle cx="20" cy="20" r="20" fill="#2d6a4f"/>'
      + '<path d="M20,5 C20,5 25,10 25,17 L25,26 L20,29 L15,26 L15,17 C15,10 20,5 20,5 Z" fill="#fff"/>'
      + '<circle cx="20" cy="15" r="3" fill="#2d6a4f"/>'
      + '<path d="M15,23 L8,32 L15,29 Z" fill="#d8f3dc"/>'
      + '<path d="M25,23 L32,32 L25,29 Z" fill="#d8f3dc"/>'
      + '<path d="M17,29 Q20,35 23,29" fill="#74c69d"/>'
      + '</svg>'
      + '<div class="vn-logo-text"><span class="vn-logo-name">Landedd</span><span class="vn-logo-badge">VA</span></div>'
      + '</a>'
      + '<button class="vn-close" onclick="vnClose()" aria-label="Close">×</button>'
      + '</div><nav class="vn-nav">';

    NAV.forEach(function (section) {
      html += '<div class="vn-section"><div class="vn-section-label">' + section.group + '</div>';
      section.items.forEach(function (item) {
        var active = isActive(item.href);
        if (item.status === 'coming') {
          html += '<div class="vn-item vn-item--coming" title="Launching May 9">'
            + '<span class="vn-icon">' + item.icon + '</span>'
            + '<div class="vn-content"><span class="vn-label">' + item.label + '</span><span class="vn-desc">' + item.desc + '</span></div>'
            + '<span class="vn-lock">🔒</span></div>';
        } else {
          html += '<a class="vn-item' + (active ? ' vn-item--active' : '') + '" href="' + item.href + '">'
            + '<span class="vn-icon">' + item.icon + '</span>'
            + '<div class="vn-content"><span class="vn-label">' + item.label + '</span><span class="vn-desc">' + item.desc + '</span></div>'
            + '</a>';
        }
      });
      html += '</div>';
    });

    html += '</nav><div class="vn-footer">'
      + '<a class="vn-footer-cta" href="/va/#pricing">View pricing</a>'
      + '<a class="vn-footer-link" href="https://www.landedd.com">landedd.com ↗</a>'
      + '<p class="vn-footer-copy">© 2026 Landedd<br>Not affiliated with the U.S. Dept. of Veterans Affairs</p>'
      + '</div>';

    return html;
  }

  var CSS = [
    ':root{--vnw:224px}',
    'body.has-sidebar{display:flex;min-height:100vh}',
    '#va-nav{width:var(--vnw);flex-shrink:0;height:100vh;position:sticky;top:0;overflow-y:auto;background:#fff;border-right:1px solid #e2e6ed;display:flex;flex-direction:column;z-index:100;transition:transform .25s cubic-bezier(.4,0,.2,1)}',
    '.va-main{flex:1;min-width:0;overflow-x:hidden}',
    /* hamburger */
    '.vn-hamburger{display:none;position:fixed;top:14px;left:14px;z-index:400;width:36px;height:36px;border-radius:8px;border:1px solid #e2e6ed;background:#fff;font-size:1rem;cursor:pointer;align-items:center;justify-content:center;box-shadow:0 1px 6px rgba(0,0,0,.1)}',
    '.vn-overlay{display:none;position:fixed;inset:0;z-index:99;background:rgba(15,25,35,.4);backdrop-filter:blur(2px)}',
    /* logo */
    '.vn-logo-wrap{display:flex;align-items:center;justify-content:space-between;padding:18px 14px 14px;border-bottom:1px solid #e2e6ed}',
    '.vn-logo{display:flex;align-items:center;gap:9px;text-decoration:none}',
    '.vn-logo-text{display:flex;align-items:center;gap:5px}',
    '.vn-logo-name{font-size:.9rem;font-weight:700;color:#0f1923;letter-spacing:-.2px}',
    '.vn-logo-badge{font-size:.5rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;background:#2d6a4f;color:#fff;border-radius:4px;padding:2px 5px}',
    '.vn-close{display:none;background:#f8f9fb;border:none;border-radius:50%;width:24px;height:24px;font-size:14px;cursor:pointer;color:#7a8a99;align-items:center;justify-content:center}',
    /* nav */
    '.vn-nav{flex:1;padding:8px 0;overflow-y:auto}',
    '.vn-section{padding:8px 0 4px}',
    '.vn-section+.vn-section{border-top:1px solid #e2e6ed}',
    '.vn-section-label{font-size:.57rem;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:#7a8a99;padding:5px 14px 3px}',
    '.vn-item{display:flex;align-items:center;gap:9px;padding:7px 8px 7px 10px;text-decoration:none;color:#0f1923;border-radius:8px;margin:1px 8px;transition:background .15s}',
    '.vn-item:not(.vn-item--coming):not(.vn-item--active):hover{background:#f0faf4}',
    '.vn-item--active{background:#f0faf4}',
    '.vn-item--active .vn-label{color:#2d6a4f;font-weight:700}',
    '.vn-item--coming{opacity:.45;cursor:not-allowed}',
    '.vn-icon{font-size:.88rem;flex-shrink:0;width:20px;text-align:center}',
    '.vn-content{flex:1;min-width:0}',
    '.vn-label{display:block;font-size:.76rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.vn-desc{display:block;font-size:.64rem;color:#7a8a99;margin-top:1px}',
    '.vn-lock{font-size:.68rem;flex-shrink:0}',
    /* footer */
    '.vn-footer{padding:12px 14px;border-top:1px solid #e2e6ed}',
    '.vn-footer-cta{display:block;width:100%;padding:8px;background:#2d6a4f;color:#fff;border-radius:8px;font-size:.74rem;font-weight:700;text-align:center;text-decoration:none;margin-bottom:7px;transition:background .2s}',
    '.vn-footer-cta:hover{background:#40916c}',
    '.vn-footer-link{display:block;font-size:.7rem;color:#7a8a99;text-decoration:none;text-align:center;padding:3px 0}',
    '.vn-footer-link:hover{color:#2d6a4f}',
    '.vn-footer-copy{font-size:.59rem;color:#b0bec5;text-align:center;margin-top:8px;line-height:1.5}',
    /* mobile */
    '@media(max-width:768px){',
    ':root{--vnw:264px}',
    'body.has-sidebar{display:block}',
    '#va-nav{position:fixed;top:0;left:0;height:100vh;transform:translateX(-100%);z-index:200;box-shadow:4px 0 24px rgba(0,0,0,.14)}',
    '#va-nav.open{transform:translateX(0)}',
    '.vn-hamburger{display:flex}',
    '.vn-close{display:flex}',
    '.vn-overlay.show{display:block}',
    'nav:first-of-type{padding-left:56px!important}',
    '}'
  ].join('');

  function init() {
    var el = document.getElementById('va-nav');
    if (!el) return;

    el.innerHTML = buildHTML();

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    document.body.classList.add('has-sidebar');

    var overlay = document.createElement('div');
    overlay.className = 'vn-overlay';
    overlay.id = 'vnOverlay';
    overlay.onclick = window.vnClose;
    document.body.appendChild(overlay);

    var ham = document.createElement('button');
    ham.className = 'vn-hamburger';
    ham.innerHTML = '&#9776;';
    ham.setAttribute('aria-label', 'Open menu');
    ham.onclick = window.vnOpen;
    document.body.appendChild(ham);
  }

  window.vnOpen = function () {
    var nav = document.getElementById('va-nav');
    var ov = document.getElementById('vnOverlay');
    if (nav) nav.classList.add('open');
    if (ov) ov.classList.add('show');
  };

  window.vnClose = function () {
    var nav = document.getElementById('va-nav');
    var ov = document.getElementById('vnOverlay');
    if (nav) nav.classList.remove('open');
    if (ov) ov.classList.remove('show');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
