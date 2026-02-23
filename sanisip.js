// ══════════════════════════════════════
//  SaniSip — sanisip.js
//  Firebase: testing-496d5-default-rtdb
// ══════════════════════════════════════

// ── Firebase URLs ──
const WATER_URL  = 'https://testing-496d5-default-rtdb.asia-southeast1.firebasedatabase.app/WaterData.json';
const FILTER_URL = 'https://testing-496d5-default-rtdb.asia-southeast1.firebasedatabase.app/FilterData.json';

const FILTER_LIFE_DAYS = 90;

// ══ SCREEN ROUTING ══
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

// ══ HELPERS ══
function clamp(v, a, b) {
    return Math.min(Math.max(v, a), b);
}

function todayString() {
    return new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

function setButtonLoading(btnId, loading, label) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled   = loading;
    btn.innerHTML  = loading
        ? '<i class="fa-solid fa-spinner fa-spin"></i> Please wait…'
        : label;
}

// ══ STATUS CLASSIFIERS ══
function tdsInfo(v, status) {
    if (status === 'UNSAFE') return { tag: 'UNSAFE', tc: 't-warn',    bc: 'b-warn'    };
    if (v <= 200)            return { tag: 'Low',    tc: 't-neutral', bc: 'b-neutral' };
    return                          { tag: 'Safe',   tc: 't-safe',    bc: 'b-safe'    };
}

function phInfo(v, status) {
    if (status === 'UNSAFE')         return { tag: 'UNSAFE',  tc: 't-warn',    bc: 'b-warn'    };
    if (v >= 6.5 && v <= 7.5)       return { tag: 'Ideal',   tc: 't-safe',    bc: 'b-safe'    };
    return                                  { tag: 'Neutral', tc: 't-neutral', bc: 'b-neutral' };
}

function turbInfo(v, status) {
    if (status === 'UNSAFE') return { tag: 'Turbid', tc: 't-warn',    bc: 'b-warn'    };
    if (v > 0.5)             return { tag: 'Slight', tc: 't-neutral', bc: 'b-neutral' };
    return                          { tag: 'Clear',  tc: 't-safe',    bc: 'b-safe'    };
}

// ══ DOM HELPERS ══
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

// ══ CONNECTION STATUS ══
function setConnectionStatus(isOnline) {
    const dot   = document.querySelector('.live-dot');
    const badge = document.querySelector('.live');
    if (!dot || !badge) return;

    if (isOnline) {
        dot.style.background        = '';
        badge.style.color           = '';
        badge.lastChild.textContent = ' LIVE';
    } else {
        dot.style.background        = '#ef4444';
        badge.style.color           = '#ef4444';
        badge.lastChild.textContent = ' OFFLINE';
    }
}

// ══ DASHBOARD ══
const state   = { tds: 0, ph: 0, turb: 0 };
const tdsHist = [];

function updateDash(data) {
    const ti = tdsInfo(state.tds,  data.TDS_Status);
    const pi = phInfo(state.ph,    data.pH_Status);
    const ri = turbInfo(state.turb, data.Turbidity_Status);

    const tdsVal  = document.getElementById('tds-val');
    const phVal   = document.getElementById('ph-val');
    const turbVal = document.getElementById('turb-val');

    if (tdsVal)  tdsVal.innerHTML  = state.tds.toFixed(2)  + ' <small>ppm</small>';
    if (phVal)   phVal.textContent = state.ph.toFixed(2);
    if (turbVal) turbVal.innerHTML = state.turb.toFixed(2) + ' <small>NTU</small>';

    setTag('tds-tag',  ti); setBar('tds-bar',  ti, (state.tds  / 1000) * 100);
    setTag('ph-tag',   pi); setBar('ph-bar',   pi, (state.ph   / 14)   * 100);
    setTag('turb-tag', ri); setBar('turb-bar', ri, (state.turb / 10)   * 100);

    const unsafe     = data.Drink_Status === 'NOT SAFE TO DRINK' ||
                       ti.tag === 'UNSAFE' || pi.tag === 'UNSAFE' || ri.tag === 'Turbid';
    const banner     = document.getElementById('banner');
    const bannerText = document.getElementById('banner-text');
    const bannerIcon = banner?.querySelector('.banner-icon');

    if (banner && bannerText && bannerIcon) {
        if (unsafe) {
            banner.className       = 'banner unsafe';
            bannerText.textContent = 'NOT SAFE TO DRINK';
            bannerIcon.innerHTML   = '<i class="fa-solid fa-circle-xmark"></i>';
        } else {
            banner.className       = 'banner safe';
            bannerText.textContent = 'SAFE TO DRINK';
            bannerIcon.innerHTML   = '<i class="fa-solid fa-circle-check"></i>';
        }
    }
}

// ══ TREND CHART ══
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

// ══ FETCH WATER DATA ══
async function tick() {
    try {
        const res = await fetch(WATER_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        state.tds  = parseFloat(data.TDS)      || 0;
        state.ph   = parseFloat(data.pH)        || 0;
        state.turb = parseFloat(data.Turbidity) || 0;

        updateDash(data);
        updateChart();
        setConnectionStatus(true);

    } catch (err) {
        console.warn('WaterData fetch failed:', err.message);
        setConnectionStatus(false);
    }
}

// ══ FILTER ALERT — READ ══
async function initFilterAlert() {
    try {
        const res = await fetch(FILTER_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data       = await res.json();
        const startDate  = data.StartDate       || null;
        const daysUsed   = parseInt(data.FilterDaysUsed) || 0;
        const daysLeft   = Math.max(FILTER_LIFE_DAYS - daysUsed, 0);
        const pct        = Math.min(Math.round((daysUsed / FILTER_LIFE_DAYS) * 100), 100);
        const isExpired  = daysLeft === 0;
        const isWarning  = daysLeft <= 10 && !isExpired;

        // Days Used
        const faDays = document.getElementById('fa-days');
        if (faDays) faDays.textContent = `${daysUsed} / ${FILTER_LIFE_DAYS} days`;

        // Start Date
        const faStatus = document.getElementById('fa-status');
        if (faStatus) faStatus.textContent = formatDate(startDate);

        // Filter Health badge
        const faHealth = document.getElementById('fa-health');
        if (faHealth) {
            if (isExpired) {
                faHealth.className   = 'fa-badge t-warn';
                faHealth.textContent = 'Replace Now';
            } else if (isWarning) {
                faHealth.className   = 'fa-badge t-warn';
                faHealth.textContent = `${daysLeft}d left`;
            } else {
                faHealth.className   = 'fa-badge t-safe';
                faHealth.textContent = 'Good';
            }
        }

        // Lifespan bar
        const filterBar = document.getElementById('filter-bar');
        const filterPct = document.getElementById('filter-pct');
        if (filterBar) {
            filterBar.style.width = pct + '%';
            if (isExpired)      filterBar.style.background = '#ef4444';
            else if (isWarning) filterBar.style.background = 'linear-gradient(90deg,#f59e0b,#ef4444)';
            else                filterBar.style.background = '';  // use CSS default
        }
        if (filterPct) filterPct.textContent = pct + '%';

        // Alert banner
        const alertBanner = document.getElementById('filter-alert-banner');
        if (alertBanner) {
            const fabIcon = alertBanner.querySelector('.fab-icon');
            const fabText = alertBanner.querySelector('.fab-text');
            if (isExpired) {
                alertBanner.className     = 'filter-alert-banner alert-danger';
                alertBanner.style.display = 'flex';
                fabIcon.innerHTML         = '<i class="fa-solid fa-triangle-exclamation"></i>';
                fabText.textContent       = 'Filter expired! Replace immediately.';
            } else if (isWarning) {
                alertBanner.className     = 'filter-alert-banner alert-warn';
                alertBanner.style.display = 'flex';
                fabIcon.innerHTML         = '<i class="fa-solid fa-bell"></i>';
                fabText.textContent       = `Filter expiring in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Replace soon.`;
            } else {
                alertBanner.style.display = 'none';
            }
        }

    } catch (err) {
        console.warn('FilterData fetch failed:', err.message);
    }
}

// ══ DATE PICKER ══
function openDatePicker() {
    const input = document.getElementById('date-input');
    if (input) input.value = todayString(); // default to today
    document.getElementById('datepicker-overlay').classList.add('active');
}

function closeDatePicker() {
    document.getElementById('datepicker-overlay').classList.remove('active');
    // restore button
    const btn = document.getElementById('date-confirm-btn');
    if (btn) {
        btn.disabled   = false;
        btn.innerHTML  = '<i class="fa-solid fa-check"></i> Confirm';
    }
}

// ══ SET START DATE ══
// Reads chosen date from the datepicker input, writes to Firebase
async function handleSetStartDate() {
    const input   = document.getElementById('date-input');
    const chosen  = input?.value; // "YYYY-MM-DD"

    if (!chosen) {
        alert('Please select a date first.');
        return;
    }

    const btn = document.getElementById('date-confirm-btn');
    if (btn) {
        btn.disabled  = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';
    }

    try {
        const payload = JSON.stringify({
            StartDate:      chosen,
            FilterDaysUsed: 0
        });

        const res = await fetch(FILTER_URL, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    payload
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        closeDatePicker();
        await initFilterAlert(); // refresh UI immediately

    } catch (err) {
        console.warn('Set start date failed:', err.message);
        alert('Failed to save. Check Firebase rules allow writes to FilterData.');
        if (btn) {
            btn.disabled  = false;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Confirm';
        }
    }
}

// ══ RESET DAYS USED ══
// Only resets FilterDaysUsed back to 0, keeps StartDate
async function handleResetDays() {
    const btnId   = 'btn-reset-days';
    const iconHtml = '<i class="fa-solid fa-rotate-right"></i> Reset Days';

    const confirmed = confirm('Reset filter days used to 0?\n\nMake sure you have physically replaced the filter first.');
    if (!confirmed) return;

    setButtonLoading(btnId, true);

    try {
        // PATCH only FilterDaysUsed — keep StartDate intact
        const res = await fetch(FILTER_URL, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ FilterDaysUsed: 0 })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        await initFilterAlert(); // refresh UI

    } catch (err) {
        console.warn('Reset days failed:', err.message);
        alert('Failed to reset days. Check Firebase rules allow writes to FilterData.');
    } finally {
        setButtonLoading(btnId, false);
        document.getElementById(btnId).innerHTML = iconHtml;
        document.getElementById(btnId).disabled  = false;
    }
}

// ══ BOOT ══
document.addEventListener('DOMContentLoaded', () => {
    initFilterAlert();
    setInterval(initFilterAlert, 60 * 60 * 1000); // refresh filter every hour

    tick();
    setInterval(tick, 5000); // matches Arduino delay(5000)
});