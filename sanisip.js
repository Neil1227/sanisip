// ══════════════════════════════════════
//  SaniSip — sanisip.js
//  Data source: Firebase Realtime DB
// ══════════════════════════════════════

// ── Firebase Config ──
const FIREBASE_URL =
    'https://watermonitoringsystem-2d931-default-rtdb.asia-southeast1.firebasedatabase.app/WaterData.json';

// ── Screen routing ──
const screens = ['dashboard', 'filter', 'about'];
const btabs   = ['bt-dashboard', 'bt-filter', 'bt-about'];

function switchScreen(id, navTabEl, botIdx) {
    screens.forEach(s => document.getElementById('s-' + s).classList.remove('active'));
    document.getElementById('s-' + id).classList.add('active');

    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    if (navTabEl) {
        navTabEl.classList.add('active');
    } else {
        const idx = screens.indexOf(id);
        document.querySelectorAll('.nav-tab')[idx]?.classList.add('active');
    }

    btabs.forEach(b => document.getElementById(b).classList.remove('active'));
    const bi = botIdx !== undefined ? botIdx : screens.indexOf(id);
    if (btabs[bi]) document.getElementById(btabs[bi]).classList.add('active');
}

// ── Helpers ──
function clamp(v, a, b) {
    return Math.min(Math.max(v, a), b);
}

// ── Status classifiers ──
// Matches your Arduino thresholds exactly:
//   pH      safe: 6–8
//   TDS     safe: 100–550 ppm
//   Turb    safe: ≤ 0.5 NTU

function tdsInfo(v) {
    if (v < 100 || v > 550) return { tag: 'UNSAFE',  tc: 't-warn',    bc: 'b-warn'    };
    if (v <= 200)            return { tag: 'Low',     tc: 't-neutral', bc: 'b-neutral' };
    return                          { tag: 'Safe',    tc: 't-safe',    bc: 'b-safe'    };
}

function phInfo(v) {
    if (v < 6 || v > 8)       return { tag: 'UNSAFE',  tc: 't-warn',    bc: 'b-warn'    };
    if (v >= 6.5 && v <= 7.5) return { tag: 'Ideal',   tc: 't-safe',    bc: 'b-safe'    };
    return                            { tag: 'Neutral', tc: 't-neutral', bc: 'b-neutral' };
}

function turbInfo(v) {
    if (v > 1)   return { tag: 'Turbid', tc: 't-warn',    bc: 'b-warn'    };
    if (v > 0.5) return { tag: 'Slight', tc: 't-neutral', bc: 'b-neutral' };
    return              { tag: 'Clear',  tc: 't-safe',    bc: 'b-safe'    };
}

// ── DOM helpers ──
function setTag(elId, info) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.className   = 'm-tag ' + info.tc;
    el.textContent = info.tag;
}

function setBar(elId, info, pct) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.className   = 'm-bar ' + info.bc;
    el.style.width = clamp(pct, 1, 100) + '%';
}

// ── Live / Offline indicator ──
function setConnectionStatus(isOnline) {
    const dot   = document.querySelector('.live-dot');
    const badge = document.querySelector('.live');
    if (!dot || !badge) return;

    if (isOnline) {
        dot.style.background = '';
        badge.style.color    = '';
        badge.lastChild.textContent = ' LIVE';
    } else {
        dot.style.background = '#ef4444';
        badge.style.color    = '#ef4444';
        badge.lastChild.textContent = ' OFFLINE';
    }
}

// ── Dashboard update ──
const state   = { tds: 0, ph: 0, turb: 0 };
const tdsHist = [];

function updateDash() {
    const ti = tdsInfo(state.tds);
    const pi = phInfo(state.ph);
    const ri = turbInfo(state.turb);

    const tdsVal  = document.getElementById('tds-val');
    const phVal   = document.getElementById('ph-val');
    const turbVal = document.getElementById('turb-val');

    if (tdsVal)  tdsVal.innerHTML  = state.tds.toFixed(2)  + ' <small>ppm</small>';
    if (phVal)   phVal.textContent = state.ph.toFixed(2);
    if (turbVal) turbVal.innerHTML = state.turb.toFixed(2) + ' <small>NTU</small>';

    // Scales: TDS 0-1000ppm | pH 0-14 | Turbidity 0-10 NTU
    setTag('tds-tag',  ti); setBar('tds-bar',  ti, (state.tds  / 1000) * 100);
    setTag('ph-tag',   pi); setBar('ph-bar',   pi, (state.ph   / 14)   * 100);
    setTag('turb-tag', ri); setBar('turb-bar', ri, (state.turb / 10)   * 100);

    const unsafe = ti.tag === 'UNSAFE' || pi.tag === 'UNSAFE' || ri.tag === 'Turbid';
    const banner     = document.getElementById('banner');
    const bannerText = document.getElementById('banner-text');
    const bannerIcon = banner?.querySelector('.banner-icon');

    if (banner && bannerText && bannerIcon) {
        if (unsafe) {
            banner.className       = 'banner unsafe';
            bannerText.textContent = 'NOT SAFE TO DRINK';
            bannerIcon.textContent = '⚠️';
        } else {
            banner.className       = 'banner safe';
            bannerText.textContent = 'SAFE TO DRINK';
            bannerIcon.textContent = '✅';
        }
    }
}

// ── Trend chart ──
function updateChart() {
    tdsHist.push(state.tds);
    if (tdsHist.length > 10) tdsHist.shift();

    const W = 300, H = 56, p = 4;
    const mn = Math.min(...tdsHist) - 10;
    const mx = Math.max(...tdsHist) + 10;

    const pts = tdsHist.map((v, i) => {
        const x = p + (i / (tdsHist.length - 1 || 1)) * (W - p * 2);
        const y = H - p - ((v - mn) / (mx - mn || 1)) * (H - p * 2);
        return `${x},${y}`;
    }).join(' ');

    document.getElementById('trend-line')?.setAttribute('points', pts);
}

// ── Fetch from Firebase ──
async function tick() {
    try {
        const res = await fetch(FIREBASE_URL);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        // Firebase keys from your Arduino:
        // { pH, pH_Status, TDS, TDS_Status, Turbidity, Turbidity_Status }
        const data = await res.json();

        state.tds  = parseFloat(data.TDS)       || 0;
        state.ph   = parseFloat(data.pH)         || 0;
        state.turb = parseFloat(data.Turbidity)  || 0;

        updateDash();
        updateChart();
        setConnectionStatus(true);

    } catch (err) {
        console.warn('Firebase fetch failed:', err.message);
        setConnectionStatus(false);
    }
}

// ── Filter alert ──
function initFilterAlert() {
    const filterDaysUsed  = 42;
    const filterTotal     = 90;
    const filterRemaining = filterTotal - filterDaysUsed;
    const filterPct       = Math.round((filterDaysUsed / filterTotal) * 100);

    const faDays      = document.getElementById('fa-days');
    const faRemaining = document.getElementById('fa-remaining');
    const filterBar   = document.getElementById('filter-bar');
    const filterPctEl = document.getElementById('filter-pct');
    const faSt        = document.getElementById('fa-status');

    if (faDays)      faDays.textContent      = filterDaysUsed + ' days';
    if (faRemaining) faRemaining.textContent = filterRemaining + ' days';
    if (filterBar)   filterBar.style.width   = filterPct + '%';
    if (filterPctEl) filterPctEl.textContent = filterPct + '%';

    if (faSt) {
        if (filterRemaining < 10) {
            faSt.className   = 'fa-badge t-warn';
            faSt.textContent = 'Replace Soon';
        } else {
            faSt.className   = 'fa-badge t-safe';
            faSt.textContent = 'Good';
        }
    }
}

// ── Boot ──
document.addEventListener('DOMContentLoaded', () => {
    initFilterAlert();
    tick();                   // fetch immediately on load
    setInterval(tick, 5000);  // poll every 5s — matches Arduino delay(5000)
});
