'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const $$ = (sel) => document.querySelectorAll(sel);

    // ── STATE ──
    let state = 'step4';
    let keywords = [];
    let selectedImages = new Set();
    let selectedCluster = null;
    let selectedLayout = null;
    
    let totalLoaded = 0;
    const BATCH_SIZE = 20;
    let isTransitioning = false;
    const SWIPE_THRESHOLD = 150;
    let accumX = 0;

    // ── DOM REFS ──
    const screen4 = $('screen-4'), screen5 = $('screen-5'), screen6 = $('screen-6');
    const screen7 = $('screen-7'), screen8 = $('screen-8');
    const kwContainer = $('kw-chips-container');
    const imageGrid = $('image-grid');
    // const reviewGrid = $('review-kw-grid'); // Removed for Bubbles
    const addKwInput = $('add-kw-input');
    const pipCurrent = $('pip-current');
    const backBtn = $('btn-back-affordance');
    const clusterContainer = $('cluster-list');

    // ── ASSETS ──
    const VIBE_ASSETS = {
        'biophilic-design': ['1518531933037-9122f5f22bb0', '1585320806297-9794b3e4eeae', '1515377905703-c4788e51af15', '1497366216548-37526070297c', '1513506003901-1e6a229e2d15'],
        'natural-materials': ['1518770660439-4636190af475', '1524758631624-e2822e304c36', '1533090161767-e6ffed986c88', '1532372320572-cda25653a26d', '1540518614846-7ede433c4b6d'],
        'minimal-architecture': ['1511389026070-a14ae610a1be', '1518005020241-6b8f2f57579a', '1494438639946-1ebd1d20bf85', '1512917774080-9991f1c4c750', '1480074568708-e7b720bb3f09'],
        'industrial-chic': ['1505015920881-0f83c2f7c95e', '1556740758-90de374c12ad', '1504384308090-c594dd286cbd', '1503387762-11a0e912e79e', '1536412597336-ade7b523ec3f'],
        'fluid-gradients': ['1557683316-973673baf926', '1618005182384-a83a8bd57fbe', '1620641788421-7a1c342ea42e', '1618005198919-d3d4b5a92e1f', '1477346611705-65d1883cee1e'],
        'earthy-textures': ['1441974231531-c6227db76b6e', '1533090161767-e6ffed986c88', '1523413144131-de7f1eb94361', '1536329583941-1442c7c576dc', '1464822759023-fed622ff2c3b'],
        'modern-minimalism': ['1494438639946-1ebd1d20bf85', '1518005020241-6b8f2f57579a', '1511389026070-a14ae610a1be', '1512917774080-9991f1c4c750', '1480074568708-e7b720bb3f09']
    };

    // ── INITIAL LOAD ──
    try {
        chrome.storage.local.get(['extractedKeywords'], (data) => {
            keywords = data.extractedKeywords || ['Wellness', 'Durability', 'Natural Textures'];
            init();
        });
    } catch (e) {
        keywords = ['Wellness', 'Durability', 'Natural Textures'];
        init();
    }

    function init() {
        renderKeywords();
        if (state === 'step4') renderReviewKeywords();
        totalLoaded = 0;
        if (imageGrid) {
            imageGrid.innerHTML = '';
            renderBatch(BATCH_SIZE);
        }
        setupGestures();
        go('step4');
    }

    // ── RENDER HELPERS ──
    function renderKeywords() {
        if (!kwContainer) return;
        kwContainer.innerHTML = '';
        keywords.forEach(kw => {
            const chip = document.createElement('div');
            chip.className = 'kw-chip';
            chip.textContent = kw;
            kwContainer.appendChild(chip);
        });
    }

    let bubbleSystem = null;

    function renderReviewKeywords() {
        const container = $('keyword-review-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        keywords.forEach(word => {
            const chip = document.createElement('div');
            chip.className = 'keyword-chip selected';
            chip.textContent = word;
            
            chip.onclick = () => {
                chip.classList.toggle('selected');
                // Synchronize the local 'keywords' state if we want to filter them
                if (!chip.classList.contains('selected')) {
                    keywords = keywords.filter(w => w !== word);
                } else if (!keywords.includes(word)) {
                    keywords.push(word);
                }
            };
            container.appendChild(chip);
        });
    }


    function getPrimaryTheme(kw) {
        const themeMap = {
            'Wellness': 'biophilic-design',
            'Sustainability': 'natural-materials',
            'Minimalism': 'minimal-architecture',
            'Industrial': 'industrial-chic',
            'Digital': 'fluid-gradients',
            'Organic': 'earthy-textures'
        };
        for (let k of kw) { if (themeMap[k]) return themeMap[k]; }
        return 'modern-minimalism';
    }

    function renderBatch(count) {
        if (!imageGrid) return;
        const theme = getPrimaryTheme(keywords);
        const assetSet = VIBE_ASSETS[theme] || VIBE_ASSETS['modern-minimalism'];
        
        let numCols = 3;
        if (window.innerWidth >= 1600) numCols = 5;
        else if (window.innerWidth >= 1200) numCols = 4;

        let row = imageGrid.querySelector('.masonry-row');
        if (!row || row.querySelectorAll('.masonry-column').length !== numCols) {
            imageGrid.innerHTML = '';
            row = document.createElement('div');
            row.className = 'masonry-row';
            imageGrid.appendChild(row);
            for (let c = 0; c < numCols; c++) {
                const col = document.createElement('div');
                col.className = 'masonry-column';
                row.appendChild(col);
            }
            totalLoaded = 0;
        }

        const columns = row.querySelectorAll('.masonry-column');
        const vibes = [
            { query: 'interior', title: 'Atmospheric Retreat', source: '@vibe_curator' },
            { query: 'detail', title: 'Tactile Materiality', source: '@material_lab' },
            { query: 'wide', title: 'Spatial Harmony', source: '@visionary_arch' },
            { query: 'abstract', title: 'Digital Fluidity', source: '@future_forms' },
            { query: 'minimal', title: 'Essential Forms', source: '@minimal_eye' }
        ];
        const heights = ['280px', '340px', '400px', '320px', '480px'];

        for (let i = 0; i < count; i++) {
            const currentIdx = totalLoaded + i;
            const vibe = vibes[currentIdx % vibes.length];
            const assetId = assetSet[currentIdx % assetSet.length];
            
            const card = document.createElement('div');
            card.className = 'image-card';
            const img = document.createElement('div');
            img.className = 'grid-img';
            img.style.height = heights[currentIdx % heights.length];
            img.style.backgroundImage = `url('https://images.unsplash.com/photo-${assetId}?auto=format&fit=crop&w=600&q=80')`;
            
            img.innerHTML = `
                <div class="img-dim-overlay"></div>
                <div class="focus-icon"><svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></div>
            `;

            img.onclick = () => {
                img.classList.toggle('selected');
                const p = img.querySelector('.focus-icon');
                if (img.classList.contains('selected')) {
                    selectedImages.add(currentIdx);
                    p.innerHTML = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`;
                } else {
                    selectedImages.delete(currentIdx);
                    p.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;
                }
            };

            const info = document.createElement('div');
            info.className = 'image-info';
            info.innerHTML = `<div class="image-title">${vibe.title}</div><div class="image-source">${vibe.source}</div>`;

            card.appendChild(img);
            card.appendChild(info);
            columns[i % numCols].appendChild(card);
        }

        totalLoaded += count;
        renderLoadMoreBridge();
    }

    function renderLoadMoreBridge() {
        const old = $('load-more-bridge');
        if (old) old.remove();
        const bridge = document.createElement('div');
        bridge.id = 'load-more-bridge';
        bridge.className = 'load-more-bridge';
        bridge.innerHTML = `<div class="bridge-content"><span class="bridge-text">Want to view more?</span><button class="bridge-btn" id="btn-load-more"><svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></button></div>`;
        imageGrid.appendChild(bridge);
        const btn = $('btn-load-more');
        if (btn) btn.onclick = () => renderBatch(BATCH_SIZE);
    }

    // ── NAVIGATION ──
    function go(next) {
        if (!next || isTransitioning) return;
        isTransitioning = true;
        
        console.log("Navigating to:", next);

        try {
            // Robust Hide: Hide all screens and any potential modals
            [screen4, screen5, screen6, screen7, screen8, $('template-explorer')].forEach(s => { 
                if(s) s.classList.add('hidden'); 
            });

            // Handle Header Visibility: Hide global header on Screen 4
            const globalHeader = $('workspace-header');
            if (globalHeader) {
                if (next === 'step4') globalHeader.classList.add('hidden');
                else globalHeader.classList.remove('hidden');
            }

            state = next;

            // Step-specific Initialization Logic
            if (next === 'step4') {
                renderReviewKeywords();
                setTimeout(renderReviewKeywords, 50); 
            } else if (next === 'step5') {
                if (imageGrid) {
                    imageGrid.innerHTML = '';
                    totalLoaded = 0;
                    renderBatch(BATCH_SIZE);
                }
            } else if (next === 'step6') {
                generateClusters();
            } else if (next === 'step8') {
                renderFinalMoodboard();
            }
            
            const screens = { 
                'step4': screen4, 
                'step5': screen5, 
                'step6': screen6, 
                'step7': screen7, 
                'step8': screen8 
            };

            if (screens[next]) {
                screens[next].classList.remove('hidden');
                window.scrollTo(0, 0); 
                if (container) container.scrollTop = 0;
            }

            if (container) {
                container.style.transition = 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)';
                container.style.transform = 'translateX(0)';
            }

            updateUI(next);
        } catch (err) {
            console.error("Navigation error:", err);
        } finally {
            setTimeout(() => { isTransitioning = false; }, 400);
        }
    }

    function generateClusters() {
        if (!clusterContainer) return;
        clusterContainer.innerHTML = '';
        const theme = getPrimaryTheme(keywords);
        const assetSet = VIBE_ASSETS[theme] || VIBE_ASSETS['modern-minimalism'];
        
        const archetypes = {
            'biophilic-design': [
                { name: 'Zen Sanctuary', desc: 'Minimalist wood with lush interior greenery.' },
                { name: 'Organic Tones', desc: 'Raw sienna and moss palettes with stone textures.' },
                { name: 'Atmospheric Air', desc: 'Large windows, soft lighting, and high-quality linens.' }
            ],
            'minimal-architecture': [
                { name: 'Industrial Purity', desc: 'Concrete, steel, and stark geometric light.' },
                { name: 'Warm Modernist', desc: 'Minimalist forms with warm lighting and oak accents.' },
                { name: 'Sculptural White', desc: 'High-contrast white forms and negative space.' }
            ],
            'modern-minimalism': [
                { name: 'Quiet Luxury', desc: 'Sophisticated neutral palettes and high-end materials.' },
                { name: 'Monochrome Living', desc: 'Deep grays, blacks, and focused spotlights.' },
                { name: 'Soft Materiality', desc: 'Creamy bouclé, soft felts, and rounded corners.' }
            ]
        };

        const currentClusters = archetypes[theme] || archetypes['modern-minimalism'];

        currentClusters.forEach((cluster, idx) => {
            const section = document.createElement('div');
            section.className = 'cluster-section';
            
            let imgHTML = '';
            for (let i = 0; i < 4; i++) {
                const assetId = assetSet[(idx + i + 2) % assetSet.length];
                imgHTML += `<div class="montage-img" style="background-image: url('https://images.unsplash.com/photo-${assetId}?auto=format&fit=crop&w=400&q=80')"></div>`;
            }

            section.innerHTML = `
                <div class="cluster-content">
                    <div class="cluster-text">
                        <h2 class="cluster-title">${cluster.name}</h2>
                        <p class="cluster-desc">${cluster.desc}</p>
                    </div>
                    <div class="cluster-montage">${imgHTML}</div>
                    <button class="cluster-select-btn">Select This Direction</button>
                </div>
            `;

            section.querySelector('.cluster-select-btn').onclick = (e) => {
                e.stopPropagation();
                selectedCluster = cluster.name;
                $$('.cluster-section').forEach(s => s.classList.remove('active'));
                section.classList.add('active');
                go('step7');
            };

            clusterContainer.appendChild(section);
        });
    }

    function updateUI(st) {
        if (pipCurrent) pipCurrent.className = (st === 'step4') ? 'step-pip active' : 'step-pip done';
        if (backBtn) backBtn.style.display = (st === 'step4') ? 'none' : 'block';
    }

    function getNextStep(curr) {
        const order = ['step4', 'step5', 'step6', 'step7', 'step8'];
        return order[order.indexOf(curr) + 1];
    }

    function getPrevStep(curr) {
        const order = ['step4', 'step5', 'step6', 'step7', 'step8'];
        return order[order.indexOf(curr) - 1];
    }

    // ── NAVIGATION LISTENERS ──
    const btnGenerate = $('btn-generate-moodboard');
    if (btnGenerate) {
        btnGenerate.onclick = () => {
            // Note: bubbleSystem was removed for Grid chips, so we just progress
            go('step5');
        };
    }

    const btnVisualsDone = $('btn-visuals-done');
    if (btnVisualsDone) {
        btnVisualsDone.onclick = () => go('step6');
    }

    const btnLayoutDone = $('btn-layout-done');
    if (btnLayoutDone) {
        btnLayoutDone.onclick = () => go('step8');
    }

    const btnSaveMoodboard = $('btn-save-moodboard');
    if (btnSaveMoodboard) {
        btnSaveMoodboard.onclick = () => {
            btnSaveMoodboard.innerHTML = '✨ Moodboard Saved! <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
            btnSaveMoodboard.disabled = true;
            setTimeout(() => {
                btnSaveMoodboard.innerHTML = 'Save Final Moodboard <svg viewBox="0 0 24 24"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>';
                btnSaveMoodboard.disabled = false;
            }, 2500);
        };
    }

    if (backBtn) backBtn.onclick = () => go(getPrevStep(state));

    let gestureTimer = null;
    function setupGestures() {
        window.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) return;
            if (isTransitioning) return;
            e.preventDefault();
            accumX += e.deltaX;
            const shift = -accumX * 0.4;
            if (container) { container.style.transition = 'none'; container.style.transform = `translateX(${shift}px)`; }
            clearTimeout(gestureTimer);
            gestureTimer = setTimeout(() => {
                if (isTransitioning) return;
                if (accumX > SWIPE_THRESHOLD) {
                    const next = getNextStep(state);
                    if (next) { isTransitioning = true; go(next); } else resetContainer();
                } else if (accumX < -SWIPE_THRESHOLD) {
                    const prev = getPrevStep(state);
                    if (prev) { isTransitioning = true; go(prev); } else resetContainer();
                } else resetContainer();
                accumX = 0;
            }, 150);
        }, { passive: false });
    }

    function resetContainer() {
        if (!container) return;
        container.style.transition = 'transform 0.4s var(--ease)';
        container.style.transform = 'translateX(0)';
    }

    if (addKwInput) {
        addKwInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                const val = addKwInput.value.trim();
                if (val && !keywords.includes(val)) {
                    keywords.push(val); renderKeywords(); renderReviewKeywords();
                    addKwInput.value = '';
                }
            }
        };
    }

    // ── TEMPLATE EXPLORER LOGIC ──
    const templateExplorer = $('template-explorer');
    const explorerGrid = $('explorer-grid');
    const explorerTitle = $('explorer-title');
    const closeExplorer = $('close-explorer');

    const TEMPLATES = {
        structured: ['Symmetric 4-Grid', 'Symmetric 6-Grid', 'Hero Left Offset', 'Hero Right Offset', 'Portrait Trio', 'Panoramic Grid'],
        unstructured: ['Organic Flow', 'Tight Masonry', 'Columnar Shift', 'Floating Nodes', 'Atmospheric Drift', 'Visual Rhythm'],
        collage: ['Overlapping Hero', 'Scattered Detail', 'Central Focus', 'Abstract Depth', 'Layered Texture', 'Creative Chaos']
    };

    $$('.layout-card').forEach(card => {
        card.onclick = () => {
            const type = card.dataset.layout;
            selectedLayout = type;
            
            $$('.layout-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            // Open Explorer
            explorerTitle.textContent = `${type.charAt(0).toUpperCase() + type.slice(1)} Templates`;
            explorerGrid.innerHTML = '';
            
            TEMPLATES[type].forEach(tm => {
                const item = document.createElement('div');
                item.className = 'template-item';
                item.textContent = tm;
                item.onclick = () => {
                    selectedLayout = `${type}:${tm}`;
                    templateExplorer.classList.add('hidden');
                    go('step8'); // Proceed after selection
                };
                explorerGrid.appendChild(item);
            });

            templateExplorer.classList.remove('hidden');
        };
    });

    if (closeExplorer) {
        closeExplorer.onclick = () => templateExplorer.classList.add('hidden');
    }

    if (templateExplorer) {
        templateExplorer.onclick = (e) => {
            if (e.target === templateExplorer) templateExplorer.classList.add('hidden');
        };
    }

    // ── STEP 8: FINAL OUTPUT & PALETTE LOGIC ──
    const finalBoard = $('final-moodboard-output');
    const btnExtract = $('btn-extract-palette');
    const primaryPaletteView = $('primary-palette-view');
    const primarySwatches = $('primary-swatches');
    const btnExplore = $('btn-explore-palettes');
    const expandedPaletteSystem = $('expanded-palette-system');
    const expandedGrid = $('expanded-grid');

    const THEME_COLORS = {
        'biophilic-design': ['#2D4F1E', '#6B8E23', '#A9BA9D', '#D9E4D1', '#4A3728'],
        'natural-materials': ['#D2B48C', '#F5F5DC', '#8B4513', '#E6E6FA', '#BC8F8F'],
        'minimal-architecture': ['#FFFFFF', '#E5E7EB', '#9CA3AF', '#374151', '#111827'],
        'industrial-chic': ['#4B2C20', '#704214', '#2C3E50', '#7F8C8D', '#BDC3C7'],
        'fluid-gradients': ['#FF00FF', '#00FFFF', '#8A2BE2', '#4B0082', '#FF1493'],
        'earthy-textures': ['#8B4513', '#CD853F', '#DEB887', '#556B2F', '#A0522D'],
        'modern-minimalism': ['#F3F4F6', '#D1D5DB', '#4B5563', '#1F2937', '#6366F1']
    };

    function renderFinalMoodboard() {
        if (!finalBoard) return;
        
        // RESET PALETTE VISIBILITY (Hidden by default)
        if (primaryPaletteView) primaryPaletteView.classList.add('hidden');
        if (expandedPaletteSystem) expandedPaletteSystem.classList.add('hidden');
        
        finalBoard.innerHTML = '';
        const [type, template] = (selectedLayout || 'structured:Default').split(':');
        const theme = getPrimaryTheme(keywords);
        const images = VIBE_ASSETS[theme] || VIBE_ASSETS['modern-minimalism'];
        
        let boardHTML = '';
        if (type === 'structured') {
            boardHTML = `<div class="board-grid">`;
            for (let i = 0; i < 6; i++) {
                boardHTML += `<div class="final-img" style="background-image: url('https://images.unsplash.com/photo-${images[i % images.length]}?auto=format&fit=crop&w=800&q=80')"></div>`;
            }
            boardHTML += `</div>`;
        } else if (type === 'unstructured') {
            boardHTML = `<div class="board-masonry">`;
            for (let c = 0; c < 3; c++) {
                boardHTML += `<div class="board-col">`;
                for (let r = 0; r < 2; r++) {
                    const idx = c * 2 + r;
                    boardHTML += `<div class="final-img" style="height:${r===0?'60%':'40%'}; background-image: url('https://images.unsplash.com/photo-${images[idx % images.length]}?auto=format&fit=crop&w=800&q=80')"></div>`;
                }
                boardHTML += `</div>`;
            }
            boardHTML += `</div>`;
        } else {
            boardHTML = `<div class="board-collage">`;
            const positions = [
                { t:'5%', l:'5%', w:'40%', h:'50%' }, { t:'10%', l:'50%', w:'45%', h:'40%' },
                { t:'60%', l:'10%', w:'30%', h:'35%' }, { t:'55%', l:'45%', w:'50%', h:'40%' }
            ];
            positions.forEach((p, i) => {
                boardHTML += `<div class="collage-item" style="top:${p.t}; left:${p.l}; width:${p.w}; height:${p.h}; background-image: url('https://images.unsplash.com/photo-${images[i % images.length]}?auto=format&fit=crop&w=800&q=80')"></div>`;
            });
            boardHTML += `</div>`;
        }
        
        finalBoard.innerHTML = boardHTML;
    }

    if (btnExtract) {
        btnExtract.onclick = () => {
            const theme = getPrimaryTheme(keywords);
            const colors = THEME_COLORS[theme] || THEME_COLORS['modern-minimalism'];
            
            primarySwatches.innerHTML = '';
            primaryPaletteView.classList.remove('hidden');
            
            colors.forEach((hex, i) => {
                setTimeout(() => {
                    const card = document.createElement('div');
                    card.className = 'swatch-card';
                    card.innerHTML = `
                        <div class="swatch-color" style="background: ${hex}"></div>
                        <div class="swatch-hex">${hex}</div>
                        <div class="swatch-label">${getCMFLabel(i)}</div>
                    `;
                    primarySwatches.appendChild(card);
                }, i * 150);
            });

            primaryPaletteView.scrollIntoView({ behavior: 'smooth' });
        };
    }

    function getCMFLabel(idx) {
        const labels = ['Primary Base', 'Secondary Tone', 'Accent Detail', 'Structural Finish', 'Material Highlight'];
        return labels[idx] || 'Tonal Variation';
    }

    if (btnExplore) {
        btnExplore.onclick = () => {
            expandedPaletteSystem.classList.remove('hidden');
            renderExpandedPalettes();
            expandedPaletteSystem.scrollIntoView({ behavior: 'smooth' });
        };
    }

    function renderExpandedPalettes() {
        expandedGrid.innerHTML = '';
        const theme = getPrimaryTheme(keywords);
        const base = THEME_COLORS[theme][0];
        
        const categories = [
            'Contrast', 'Analogous', 'Complementary', 'Monochromatic', 
            'Material-Inspired', 'Neutral Base', 'Accent Pops', 'Gradients',
            'Warm Tones', 'Cool Tones', 'Desaturated', 'High-Saturation'
        ];

        categories.forEach(cat => {
            const group = document.createElement('div');
            group.className = 'palette-group';
            
            let colors = [];
            for (let i = 0; i < 4; i++) colors.push(generateVariation(base, cat, i));

            group.innerHTML = `
                <div class="group-swatches">
                    ${colors.map(c => `<div class="mini-swatch" style="background: ${c}"></div>`).join('')}
                </div>
                <div class="group-label">${cat}</div>
            `;
            expandedGrid.appendChild(group);
        });
    }

    function generateVariation(hex, cat, i) {
        if (cat === 'Monochromatic') return hex + (i * 20).toString(16).padStart(2, '0');
        if (cat === 'Warm Tones') return ['#b45309', '#ea580c', '#f59e0b', '#7c2d12'][i];
        if (cat === 'Cool Tones') return ['#1d4ed8', '#2563eb', '#3b82f6', '#1e3a8a'][i];
        if (cat === 'Material-Inspired') return ['#5b3e31', '#78350f', '#a8a29e', '#404040'][i];
        return hex;
    }

    // Initialization
    init();
});
