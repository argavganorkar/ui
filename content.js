(function() {
  const ROOT_ID = 'insight-extractor-root';
  
  // ── Robust Re-injection Handling ──
  // If the extension reloads, the old content script becomes a "zombie" (broken chrome APIs).
  // We detect if an old panel exists and remove it to ensure the fresh script takes over correctly.
  const existingRoot = document.getElementById(ROOT_ID);
  if (existingRoot) {
    existingRoot.remove();
  }

  // Prevent multiple active initializations from the same script instance
  if (window.__INSIGHT_EXTRACTOR_INITIALIZING) return;
  window.__INSIGHT_EXTRACTOR_INITIALIZING = true;
  let isPanelInjected = false;
  let isPanelVisible = false;
  let rootEl = null;

  // ── Communication ──
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggle_panel') {
      if (!isPanelInjected) {
        injectPanel();
      } else {
        toggleVisibility();
      }
    }
  });

  async function injectPanel() {
    if (document.getElementById(ROOT_ID)) {
      rootEl = document.getElementById(ROOT_ID);
      isPanelInjected = true;
      toggleVisibility();
      return;
    }
    
    rootEl = document.createElement('div');
    rootEl.id = ROOT_ID;
    document.body.appendChild(rootEl);

    try {
      const url = chrome.runtime.getURL('panel.html');
      const response = await fetch(url);
      const htmlText = await response.text();
      
      rootEl.innerHTML = htmlText;
      
      // Fix image paths
      rootEl.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src');
        if (src && !src.startsWith('http')) {
          img.src = chrome.runtime.getURL(src);
        }
      });

      isPanelInjected = true;
      isPanelVisible = true;
      
      initializeExtensionApp();
    } catch (err) {
      console.error("Insight Extractor Error: Could not load panel HTML", err);
    }
  }

  function toggleVisibility() {
    if (!rootEl) return;
    const panel = rootEl.querySelector('.ext-panel');
    if (panel) {
      if (isPanelVisible) {
        panel.style.display = 'none';
        rootEl.style.display = 'none';
      } else {
        panel.style.display = 'flex';
        rootEl.style.display = 'block';
      }
    }
    isPanelVisible = !isPanelVisible;
  }

  // ── Application Logic ──
  function initializeExtensionApp() {
    const $ = (id) => rootEl.querySelector('#' + id);
    const safeAddListener = (id, event, cb) => {
      const el = $(id);
      if (el) el.addEventListener(event, cb);
    };

    const KEYWORDS = ['Wellness-led design', 'Nostalgic craft', 'Durability', 'Sensory appeal', 'Personalisation', 'Escapism'];
    const HL_KEYWORDS = ['Sensory appeal', 'Durability', 'Nostalgic craft', 'Escapism'];

    let state = 'step1';
    let activeKW = [];
    let extractionTimer = null;

    const s1 = $('screen-1'), s2 = $('screen-2'), s3a = $('screen-3a'), s3b = $('screen-3b'), 
          s4 = $('screen-4'), s5 = $('screen-5'), s6 = $('screen-6'), s7 = $('screen-7'), s8 = $('screen-8');

    const pip1 = $('pip-1'), pip2 = $('pip-2'), pip3 = $('pip-3');
    const ctaBtn = $('cta-btn'), ctaLabel = $('cta-label'), footer = $('ext-footer');

    let bubbleSystem = null;

    function updatePips(step) {
      const pips = [pip1, pip2, pip3];
      pips.forEach(p => { if(p) p.className = 'step-pip'; });
      if (step === 'step1' && pip1) { pip1.className = 'step-pip active'; }
      else if (step === 'step2' && pip1 && pip2) { pip1.className = 'step-pip done'; pip2.className = 'step-pip active'; }
      else if (['step3a', 'step3b'].includes(step) && pip1 && pip2 && pip3) {
        pip1.className = 'step-pip done'; pip2.className = 'step-pip done'; pip3.className = 'step-pip active';
      } else if (pip1 && pip2 && pip3) {
        pip1.className = 'step-pip done'; pip2.className = 'step-pip done'; pip3.className = 'step-pip done';
      }
    }

    function go(next) {
      [s1, s2, s3a, s3b, s5, s6, s7, s8].forEach(s => { if(s) s.classList.add('hidden'); });
      const map = { step1: s1, step2: s2, step3a: s3a, step3b: s3b, step5: s5, step6: s6, step7: s7, step8: s8 };
      const sc = map[next];
      if (sc) sc.classList.remove('hidden');
      state = next;
      updatePips(next);
      setupCTAForState(next);

      // Keep it in the interface: Always show footer for now as it contains "Refine & Continue"
      if (footer) footer.style.display = '';
    }

    // Initialize at step 1
    go('step1');

    safeAddListener('card-analyze', 'click', () => { go('step3a'); startAnalysis(); });
    safeAddListener('card-highlight', 'click', () => { go('step3b'); startHighlightMode(); });

    function makeChip(text, containerId, badgeId) {
      const container = $(containerId);
      if (!container) return;
      const chip = document.createElement('span');
      chip.className = 'kw-chip';
      const lbl = document.createElement('span');
      lbl.textContent = text;
      const rm = document.createElement('button');
      rm.className = 'kw-chip-x';
      rm.innerHTML = '&times;';
      rm.onclick = () => {
        chip.style.transition = 'transform .15s,opacity .15s';
        chip.style.transform = 'scale(0.6)'; chip.style.opacity = '0';
        setTimeout(() => chip.remove(), 160);
        activeKW = activeKW.filter(k => k !== text);
        updateBadge(badgeId);
        checkCTA();
      };
      chip.appendChild(lbl); chip.appendChild(rm);
      container.appendChild(chip);
      activeKW.push(text);
      updateBadge(badgeId);
      checkCTA();
    }

    function updateBadge(id) {
      const el = $(id);
      if (el) el.textContent = activeKW.length;
    }

    function checkCTA() {
      if (!ctaBtn || !ctaLabel) return;
      if (['step3a', 'step3b'].includes(state)) {
        if (activeKW.length > 0) {
          ctaBtn.disabled = false;
          ctaLabel.textContent = `Refine & Continue (${activeKW.length})`;
        } else {
          ctaBtn.disabled = true;
          ctaLabel.textContent = 'Refine & Continue';
        }
      }
    }

    function startAnalysis() {
      activeKW = [];
      checkCTA();
      if(ctaBtn) ctaBtn.disabled = true;
      const chips3a = $('kw-chips-3a');
      if (chips3a) chips3a.innerHTML = '';
      const insight = $('insight-3a'); if(insight) insight.classList.remove('visible');
      const addKw = $('add-kw-3a'); if(addKw) addKw.style.display = 'none';
      updateBadge('kw-badge-3a');
      const lbl = $('analyzing-label'); if(lbl) lbl.textContent = 'Analyzing current report…';
      const sub = $('analyzing-sub'); if(sub) sub.textContent = 'Reading trends and extracting keywords';

      let i = 0;
      const reveal = () => {
        if (state !== 'step3a') return;
        if (i < KEYWORDS.length) {
          makeChip(KEYWORDS[i], 'kw-chips-3a', 'kw-badge-3a');
          i++;
          extractionTimer = setTimeout(reveal, 680);
        } else {
          if(lbl) lbl.textContent = 'Extraction complete';
          if(sub) sub.textContent = `${KEYWORDS.length} keywords identified`;
          if(addKw) addKw.style.display = '';
          setTimeout(() => { if(insight) insight.classList.add('visible'); }, 300);
        }
      };
      extractionTimer = setTimeout(reveal, 1100);
    }

    safeAddListener('add-kw-3a', 'keydown', e => {
      if (e.key !== 'Enter') return;
      const v = e.target.value.trim();
      if (!v || activeKW.includes(v)) { e.target.value = ''; return; }
      makeChip(v, 'kw-chips-3a', 'kw-badge-3a');
      e.target.value = '';
    });

    safeAddListener('back-3a', 'click', () => {
      clearTimeout(extractionTimer);
      activeKW = [];
      checkCTA();
      go('step2');
    });

    let hlTriggered = false;
    function startHighlightMode() {
      activeKW = [];
      checkCTA();
      if(ctaBtn) ctaBtn.disabled = true;
      hlTriggered = false;
      const chips3b = $('kw-chips-3b'); if(chips3b) chips3b.innerHTML = '';
      updateBadge('kw-badge-3b');
      const card = $('hl-kw-card'); if(card) card.style.display = 'none';
      const insight = $('insight-3b'); if(insight) insight.classList.remove('visible');
      const pill = $('wait-pill'); if(pill) pill.classList.remove('detected');
      const ring = $('wait-ring'); if(ring) ring.classList.remove('done');
      const lbl = $('wait-label'); if(lbl) lbl.textContent = 'Waiting for selection…';

      const layer = $('text-layer'); if(layer) layer.classList.add('active');
      const hint = $('hl-hint'); if(hint) hint.classList.add('visible');
    }

    function onTextSelected() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || state !== 'step3b' || hlTriggered) return;
      const txt = sel.toString().trim();
      if (txt.length < 3) return;

      hlTriggered = true;
      const layer = $('text-layer'); if(layer) layer.classList.remove('active');
      const hint = $('hl-hint'); if(hint) hint.classList.remove('visible');

      const ring = $('wait-ring'); if(ring) ring.classList.add('done');
      const lbl = $('wait-label'); if(lbl) lbl.textContent = 'Selection detected!';
      const pill = $('wait-pill'); if(pill) pill.classList.add('detected');
      const card = $('hl-kw-card'); if(card) card.style.display = '';

      let i = 0;
      const reveal = () => {
        if (state !== 'step3b') return;
        if (i < HL_KEYWORDS.length) {
          makeChip(HL_KEYWORDS[i], 'kw-chips-3b', 'kw-badge-3b');
          i++;
          setTimeout(reveal, 600);
        } else {
          const insight = $('insight-3b'); if(insight) setTimeout(() => insight.classList.add('visible'), 350);
        }
      };
      setTimeout(reveal, 500);
    }

    document.addEventListener('mouseup', onTextSelected);

    safeAddListener('back-3b', 'click', () => {
      const layer = $('text-layer'); if(layer) layer.classList.remove('active');
      const hint = $('hl-hint'); if(hint) hint.classList.remove('visible');
      activeKW = [];
      checkCTA();
      go('step2');
    });

    // ── Wave Canvas ──
    (function () {
      const canvas = $('wave-canvas-el');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const CLOUDS = [
        { nx: 0.18, ny: 1.30, rxR: 0.78, ryR: 0.52, rgb: [108, 0, 16], rise: 0.026, driftP: 19000, driftA: 0.09, ph: 0.0 },
        { nx: 0.58, ny: 1.55, rxR: 0.72, ryR: 0.50, rgb: [152, 0, 62], rise: 0.021, driftP: 24000, driftA: 0.11, ph: 1.2 },
        { nx: 0.80, ny: 1.12, rxR: 0.68, ryR: 0.47, rgb: [86, 0, 142], rise: 0.029, driftP: 17000, driftA: 0.08, ph: 2.4 },
        { nx: 0.32, ny: 1.72, rxR: 0.62, ryR: 0.55, rgb: [28, 0, 150], rise: 0.024, driftP: 21000, driftA: 0.09, ph: 3.6 }
      ];
      const yStates = CLOUDS.map(c => c.ny);
      let lastTs = null, animId = null;

      function resize() {
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.offsetWidth, h = canvas.offsetHeight;
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
          canvas.width = w * dpr; canvas.height = h * dpr;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        return { W: w, H: h };
      }

      function frame(ts) {
        const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.08) : 0;
        lastTs = ts;
        const { W, H } = resize();
        ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'screen';
        CLOUDS.forEach((c, i) => {
          yStates[i] -= c.rise * dt;
          if (yStates[i] < -0.7) yStates[i] = 1.65;
          const driftRad = (ts / c.driftP) * Math.PI * 2 + c.ph;
          const cx = (c.nx + Math.sin(driftRad) * c.driftA) * W;
          const cy = yStates[i] * H;
          const rx = c.rxR * W; const ry = c.ryR * H * 0.60;
          ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx);
          const [r, g, b] = c.rgb;
          const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
          gr.addColorStop(0, `rgba(${r},${g},${b},0.90)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fillStyle = gr; ctx.fill(); ctx.restore();
        });
        ctx.globalCompositeOperation = 'source-over';
        animId = requestAnimationFrame(frame);
      }
      animId = requestAnimationFrame(frame);
      window._waveStop = () => { cancelAnimationFrame(animId); lastTs = null; };
    })();

    safeAddListener('btn-refresh', 'click', () => {
      clearTimeout(extractionTimer);
      const layer = $('text-layer'); if(layer) layer.classList.remove('active');
      const hint = $('hl-hint'); if(hint) hint.classList.remove('visible');
      hlTriggered = false; activeKW = []; checkCTA();
      go('step1');
    });

    function setupCTAForState(st) {
      if (!ctaBtn || !ctaLabel) return;
      if (st === 'step1') {
        ctaBtn.disabled = false; ctaLabel.textContent = 'Get Started';
      } else if (st === 'step2') {
        ctaBtn.disabled = true; ctaLabel.textContent = 'Continue';
      } else if (['step3a', 'step3b'].includes(st)) {
        // Text is handled by checkCTA based on extraction progress
        checkCTA();
      }
    }

    safeAddListener('cta-btn', 'click', () => {
      if (!ctaBtn || ctaBtn.disabled) return;
      
      // Check for context invalidation
      if (!chrome.runtime?.id) {
        alert("Extension context invalidated. Please refresh the page to continue.");
        return;
      }

      if (state === 'step1') {
        go('step2');
      } else if (state === 'step3a' || state === 'step3b') {
        // Visual loading state on the button itself before opening
        ctaBtn.disabled = true;
        const originalText = ctaLabel.textContent;
        ctaLabel.textContent = 'Opening Workspace...';

        try {
          chrome.storage.local.set({ extractedKeywords: activeKW }, () => {
            if (chrome.runtime.lastError) {
              console.error("Storage error:", chrome.runtime.lastError);
              ctaBtn.disabled = false;
              ctaLabel.textContent = originalText;
              return;
            }
            // Artificial delay for polish
            setTimeout(() => {
              chrome.runtime.sendMessage({ action: 'OPEN_APP' });
              // Small delay to reset button if the tab switch is slow or focused away
              setTimeout(() => {
                ctaBtn.disabled = false;
                ctaLabel.textContent = originalText;
              }, 1000);
            }, 800);
          });
        } catch (e) {
          console.error("Butterfly Effect: Failed to open workspace", e);
          alert("Extension connection lost. Please refresh the page.");
          ctaBtn.disabled = false;
          ctaLabel.textContent = originalText;
        }
      }
    });

    // Screen 4 is now in the Main Workspace tab only.
  }
})();
