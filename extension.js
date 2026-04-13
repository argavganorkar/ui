/* ═══════════════════════════════════════════════════════
   Insight Extractor — WGSN Overlay — extension.js
   Progressive keyword extraction simulation
   ═══════════════════════════════════════════════════════ */

'use strict';

// ── Keywords to reveal progressively ─────────────────────
const KEYWORDS = [
    'Wellness-led design',
    'Nostalgic craft',
    'Durability',
    'Sensory appeal',
    'Personalisation',
    'Escapism',
];

// Staggered reveal timing (ms between each chip)
const CHIP_DELAY_START = 900;   // delay before first chip
const CHIP_INTERVAL = 620;   // gap between chips

// ── DOM refs ──────────────────────────────────────────────
const chipsArea = document.getElementById('chips-area');
const kwBadge = document.getElementById('kw-badge');
const analyzingPill = document.getElementById('analyzing-pill');
const btnMoodboard = document.getElementById('btn-moodboard');
const footerHint = document.getElementById('footer-hint');
const ctaLabel = document.getElementById('cta-label');
const insightCard = document.getElementById('insight-card');
const addKwWrap = document.getElementById('add-kw-wrap');
const addKwInput = document.getElementById('add-kw-input');
const btnRefresh = document.getElementById('btn-refresh');
const btnSettings = document.getElementById('btn-settings');

// ── State ─────────────────────────────────────────────────
let activeKeywords = [];

// ── Helpers ───────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function bumpBadge() {
    kwBadge.classList.remove('bump');
    void kwBadge.offsetWidth; // reflow
    kwBadge.classList.add('bump');
    setTimeout(() => kwBadge.classList.remove('bump'), 300);
}

function updateBadge() {
    kwBadge.textContent = activeKeywords.length;
    bumpBadge();
}

// ── Build a chip element ───────────────────────────────────
function makeChip(text, delayIndex = 0) {
    const chip = document.createElement('span');
    chip.className = 'ext-chip';
    chip.style.animationDelay = `${delayIndex * 40}ms`;

    const label = document.createElement('span');
    label.textContent = text;

    const rmBtn = document.createElement('button');
    rmBtn.className = 'ext-chip-remove';
    rmBtn.title = 'Remove';
    rmBtn.innerHTML = '&times;';
    rmBtn.addEventListener('click', () => removeChip(text, chip));

    chip.appendChild(label);
    chip.appendChild(rmBtn);
    return chip;
}

function removeChip(text, chipEl) {
    activeKeywords = activeKeywords.filter(k => k !== text);
    chipEl.style.transition = 'transform .15s ease, opacity .15s ease';
    chipEl.style.transform = 'scale(0.6)';
    chipEl.style.opacity = '0';
    setTimeout(() => chipEl.remove(), 160);
    updateBadge();
    checkMoodboardState();
}

// ── CTA state ─────────────────────────────────────────────
function checkMoodboardState() {
    if (activeKeywords.length > 0) {
        btnMoodboard.disabled = false;
        footerHint.textContent = `${activeKeywords.length} keyword${activeKeywords.length !== 1 ? 's' : ''} ready — click to generate`;
        footerHint.style.color = '#6366f1';
    } else {
        btnMoodboard.disabled = true;
        footerHint.textContent = 'Extract keywords first to unlock';
        footerHint.style.color = '';
    }
}

// ── Progressive extraction sequence ───────────────────────
async function runExtraction() {
    await sleep(CHIP_DELAY_START);

    for (let i = 0; i < KEYWORDS.length; i++) {
        const kw = KEYWORDS[i];
        activeKeywords.push(kw);

        const chip = makeChip(kw, 0);
        chipsArea.appendChild(chip);
        updateBadge();
        checkMoodboardState();

        await sleep(CHIP_INTERVAL);
    }

    // All chips done
    analyzingPill.classList.add('done');

    // Show add-keyword input
    await sleep(200);
    addKwWrap.style.display = '';

    // Reveal AI insight card
    await sleep(350);
    insightCard.style.opacity = '1';
    insightCard.style.transform = 'translateY(0)';
}

// ── Add keyword on Enter ───────────────────────────────────
addKwInput.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const val = addKwInput.value.trim();
    if (!val || activeKeywords.includes(val)) {
        addKwInput.value = '';
        return;
    }
    activeKeywords.push(val);
    const chip = makeChip(val, 0);
    chipsArea.appendChild(chip);
    addKwInput.value = '';
    updateBadge();
    checkMoodboardState();
});

// ── Generate Moodboard ────────────────────────────────────
btnMoodboard.addEventListener('click', () => {
    if (btnMoodboard.disabled) return;

    const orig = ctaLabel.textContent;
    ctaLabel.textContent = '✨  Opening Moodboard…';
    btnMoodboard.disabled = true;

    setTimeout(() => {
        ctaLabel.textContent = orig;
        btnMoodboard.disabled = false;
    }, 2000);
});

// ── Refresh ───────────────────────────────────────────────
btnRefresh.addEventListener('click', async () => {
    btnRefresh.classList.add('spinning');

    // Reset everything
    activeKeywords = [];
    chipsArea.innerHTML = '';
    analyzingPill.classList.remove('done');
    addKwWrap.style.display = 'none';
    insightCard.style.opacity = '0';
    insightCard.style.transform = 'translateY(8px)';
    updateBadge();
    checkMoodboardState();
    footerHint.textContent = 'Extracting insights…';
    footerHint.style.color = '';

    await sleep(700);
    btnRefresh.classList.remove('spinning');

    // Re-run
    runExtraction();
});

// ── Settings spin ─────────────────────────────────────────
btnSettings.addEventListener('click', () => {
    btnSettings.classList.add('spinning');
    setTimeout(() => btnSettings.classList.remove('spinning'), 650);
});

// ── Init ──────────────────────────────────────────────────
checkMoodboardState();
runExtraction();
