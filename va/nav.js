// va/nav.js — Shared sidebar navigation for Landedd VA
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
        { label: 'JOA Classifier', icon: '🔍', href: '/va/', status: 'live' }
      ]
    },
    {
      group: 'May 9',
      items: [
        { label: 'VA Fit Scanner', icon: '📊', href: null, status: 'coming' },
        { label: 'Resume Tailor', icon: '✏️', href: null, status: 'coming' },
        { label: 'Questionnaire', icon: '📝', href: null, status: 'coming' },
        { label: 'Premium Package', icon: '📦', href: null, status: 'coming' }
      ]
    },
    {
      group: 'Resources',
      items: [
        { label: 'App. Roadmap', icon: '🗺️', href: '/va/roadmap.html', status: 'live' }
      ]
    }
  ];

  function buildHTML() {
    var html = ''
      + '<div class="vn-logo-wrap">'
      +   '<a class="vn-logo" href="/va/">'
      +     '<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" width="24" height="24">'
      +       '<circle cx="20" cy="20" r="20" fill="#2d6a4f"/>'
      +       '<path d="M20,5 C20,5 25,10 25,17 L25,26 L20,29 L15,26 L15,17 C15,10 20,5 20,5 Z" fill="#fff"/>'
      +       '<circle cx="20" cy="15" r="3" fill="#2d6a4f"/>'
      +       '<path d="M15,23 L8,32 L15,29 Z" fill="#d8f3dc"/>'
      +       '<path d="M25,23 L32,32 L25,29 Z" fill="#d8f3dc"/>'
      +       '<path d="M17,29 Q20,35 23,29" fill="#74c69d"/>'
      +     '</svg>'
      +     '<div class="vn-brand"><span class="vn-name">Landedd</span><span class="vn-badge">VA</span></div>'
      +   '</a>'
      +   '<button class="vn-x" onclick="vnClose()" aria-label="Close">&#x2715;</button>'
      + '</div>'
      + '<nav class="vn-nav">';

    NAV.forEach(function (section) {
      html += '<div class="vn-group">'
            + '<div class="vn-group-label">' + section.group + '</div>';

      section.items.forEach(function (item) {
        var active = isActive(item.href);
        if (item.status === 'coming') {
          html += '<div class="vn-item vn-coming">'
                + '<span class="vn-ic">' + item.icon + '</span>'
                + '<span class="vn-lbl">' + item.label + '</span>'
                + '<span class="vn-padlock">&#128274;</span>'
                + '</div>';
        } else {
          html += '<a class="vn-item' + (active ? ' vn-active' : '') + '" href="' + item.href + '">'
                + '<span class="vn-ic">' + item.icon + '</span>'
                + '<span class="vn-lbl">' + item.label + '</span>'
                + '</a>';
        }
      });

      html += '</div>';
    });

    html += '</nav>'
          + '<div class="vn-foot">'
          +   '<a class="vn-cta" href="/va/#pricing">View pricing</a>'
          +   '<a class="vn-ext" href="https://www.landedd.com">landedd.com &#x2197;</a>'
          +   '<p class="vn-copy">&#169; 2026 Landedd &middot; Not affiliated with the VA</p>'
          + '</div>';

    return html;
  }

  var CSS = ''
    + ':root{--vnw:210px}'
    + 'body.has-sidebar{display:flex;min-height:100vh}'
    + '#va-nav{width:var(--vnw);flex-shrink:0;height:100vh;position:sticky;top:0;overflow:hidden;background:#fff;border-right:1px solid #e2e6ed;display:flex;flex-direction:column;z-index:100;transition:transform .25s cubic-bezier(.4,0,.2,1)}'
    + '.va-main{flex:1;min-width:0;overflow-x:hidden}'
    + '.vn-ham{display:none;position:fixed;top:14px;left:14px;z-index:400;width:34px;height:34px;border-radius:8px;border:1px solid #e2e6ed;background:#fff;font-size:.95rem;cursor:pointer;align-items:center;justify-content:center;box-shadow:0 1px 6px rgba(0,0,0,.09)}'
    + '.vn-overlay{display:none;position:fixed;inset:0;z-index:99;background:rgba(15,25,35,.4)}'
    + '.vn-logo-wrap{display:flex;align-items:center;justify-content:space-between;padding:16px 14px 14px;border-bottom:1px solid #e2e6ed;flex-shrink:0}'
    + '.vn-logo{display:flex;align-items:center;gap:8px;text-decoration:none;min-width:0;overflow:hidden}'
    + '.vn-brand{display:flex;align-items:center;gap:5px;min-width:0;overflow:hidden}'
    + '.vn-name{font-size:.88rem;font-weight:700;color:#0f1923;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.vn-badge{font-size:.48rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;background:#2d6a4f;color:#fff;border-radius:4px;padding:2px 5px;flex-shrink:0}'
    + '.vn-x{display:none;background:#f8f9fb;border:none;border-radius:50%;width:22px;height:22px;font-size:13px;cursor:pointer;color:#7a8a99;align-items:center;justify-content:center;flex-shrink:0}'
    + '.vn-nav{flex:1;padding:6px 0;overflow-y:auto;overflow-x:hidden}'
    + '.vn-group{padding:10px 0 6px}'
    + '.vn-group+.vn-group{border-top:1px solid #e2e6ed}'
    + '.vn-group-label{font-size:.56rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#7a8a99;padding:4px 14px 5px;white-space:nowrap}'
    + '.vn-item{display:flex;align-items:center;gap:8px;padding:7px 14px;text-decoration:none;color:#0f1923;border-radius:8px;margin:1px 6px;transition:background .15s;overflow:hidden}'
    + '.vn-item:not(.vn-coming):not(.vn-active):hover{background:#f0faf4}'
    + '.vn-active{background:#f0faf4}'
    + '.vn-active .vn-lbl{color:#2d6a4f;font-weight:700}'
    + '.vn-coming{opacity:.42;cursor:default}'
    + '.vn-ic{font-size:.82rem;flex-shrink:0;width:18px;text-align:center;line-height:1}'
    + '.vn-lbl{font-size:.76rem;font-weight:600;color:inherit;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.vn-padlock{font-size:.62rem;flex-shrink:0;opacity:.6}'
    + '.vn-foot{padding:12px 14px;border-top:1px solid #e2e6ed;flex-shrink:0}'
    + '.vn-cta{display:block;width:100%;padding:8px;background:#2d6a4f;color:#fff;border-radius:8px;font-size:.74rem;font-weight:700;text-align:center;text-decoration:none;margin-bottom:8px;transition:background .2s}'
    + '.vn-cta:hover{background:#40916c}'
    + '.vn-ext{display:block;font-size:.69rem;color:#7a8a99;text-decoration:none;text-align:center;padding:2px 0}'
    + '.vn-ext:hover{color:#2d6a4f}'
    + '.vn-copy{font-size:.57rem;color:#b0bec5;text-align:center;margin-top:7px;line-height:1.45}'
    + '@media(max-width:768px){'
    +   ':root{--vnw:240px}'
    +   'body.has-sidebar{display:block}'
    +   '#va-nav{position:fixed;top:0;left:0;height:100vh;transform:translateX(-100%);z-index:200;box-shadow:4px 0 20px rgba(0,0,0,.14)}'
    +   '#va-nav.vn-open{transform:translateX(0)}'
    +   '.vn-ham{display:flex}'
    +   '.vn-x{display:flex}'
    +   '.vn-overlay.vn-show{display:block}'
    +   'nav:first-of-type{padding-left:54px!important}'
    + '}';

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
    ham.className = 'vn-ham';
    ham.innerHTML = '&#9776;';
    ham.setAttribute('aria-label', 'Open menu');
    ham.onclick = window.vnOpen;
    document.body.appendChild(ham);
  }

  window.vnOpen = function () {
    var n = document.getElementById('va-nav');
    var o = document.getElementById('vnOverlay');
    if (n) n.classList.add('vn-open');
    if (o) o.classList.add('vn-show');
  };

  window.vnClose = function () {
    var n = document.getElementById('va-nav');
    var o = document.getElementById('vnOverlay');
    if (n) n.classList.remove('vn-open');
    if (o) o.classList.remove('vn-show');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
