/* ═══════════════════════════════════════════════════════
   Insight Extractor — Loading State JS
   Ghost chips that appear progressively, then loop
   ═══════════════════════════════════════════════════════ */

'use strict';

// Keyword labels and their approximate pixel widths for ghost chips
const GHOST_KEYWORDS = [
    { label: 'Wellness-led design', w: 136 },
    { label: 'Nostalgic craft', w: 108 },
    { label: 'Durability', w: 80 },
    { label: 'Sensory appeal', w: 102 },
    { label: 'Personalisation', w: 110 },
    { label: 'Escapism', w: 72 },
];

const CHIP_DELAY_FIRST = 1100;   // wait before first chip appears
const CHIP_INTERVAL = 750;    // gap between chips

const container = document.getElementById('ghost-chips');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function spawnGhostChips() {
    await sleep(CHIP_DELAY_FIRST);

    for (let i = 0; i < GHOST_KEYWORDS.length; i++) {
        const { w } = GHOST_KEYWORDS[i];
        const chip = document.createElement('span');
        chip.className = 'ghost-chip';
        chip.style.width = `${w}px`;
        chip.style.animationDelay = `0s, ${(i * 0.18).toFixed(2)}s`; // fade-in delay, then shimmer stagger
        container.appendChild(chip);
        await sleep(CHIP_INTERVAL);
    }
}

spawnGhostChips();
