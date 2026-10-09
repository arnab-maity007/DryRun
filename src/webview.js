function getWebviewContent() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DryRun Visualizer</title>
    <style>
        :root {
            --bg-color: var(--vscode-editor-background, #1e1e1e);
            --fg-color: var(--vscode-editor-foreground, #cccccc);
            --border-color: var(--vscode-panel-border, #444444);
            --card-bg: var(--vscode-editorWidget-background, #252526);
            --highlight-bg: var(--vscode-editor-selectionBackground, #264f78);
            --name-color: var(--vscode-symbolIcon-variableForeground, #75beff);
            --type-color: var(--vscode-symbolIcon-classForeground, #ee9d28);
            --value-color: var(--vscode-terminal-ansiGreen, #89d185);
            --font-mono: var(--vscode-editor-font-family, Consolas, 'Courier New', monospace);
            --radius: 6px;
        }
        body {
            margin: 0; padding: 0;
            background-color: var(--bg-color);
            color: var(--fg-color);
            font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
            height: 100vh;
            display: flex;
            overflow: hidden;
            box-sizing: border-box;
        }
        .header { font-weight: bold; font-size: 1.2em; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .section { margin-bottom: 16px; display: flex; flex-direction: column; }
        
        button {
            background: var(--vscode-button-background, #0e639c);
            color: var(--vscode-button-foreground, #ffffff);
            border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer;
        }
        button:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
        button.icon-btn { padding: 4px 8px; background: var(--card-bg); border: 1px solid var(--border-color); color: var(--fg-color); }
        button.icon-btn:hover { background: var(--highlight-bg); }
        
        input, select, textarea {
            background: var(--vscode-input-background, #3c3c3c);
            color: var(--vscode-input-foreground, #cccccc);
            border: 1px solid var(--vscode-input-border, transparent);
            border-radius: 4px; padding: 6px;
            font-family: var(--font-mono);
        }
        
        /* Layout */
        #left-sidebar {
            width: 260px; min-width: 220px; max-width: 320px;
            border-right: 1px solid var(--border-color);
            padding: 12px;
            display: flex; flex-direction: column;
            overflow-y: auto;
        }
        #main-view {
            flex-grow: 1; display: flex; flex-direction: column;
            padding: 12px; background: var(--bg-color);
            min-width: 0; /* flex bug */
        }
        
        /* Left Sidebar Cards */
        .panel {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: var(--radius);
            margin-bottom: 16px;
            overflow: hidden;
            display: flex; flex-direction: column;
        }
        .panel-header {
            background: rgba(0,0,0,0.15);
            padding: 8px 12px;
            font-weight: 600; font-size: 0.9em;
            border-bottom: 1px solid var(--border-color);
            display: flex; justify-content: space-between; align-items: center;
        }
        .panel-content { padding: 12px; }
        
        /* Variables */
        .var-card { margin-bottom: 8px; }
        .var-header { display: flex; gap: 8px; margin-bottom: 4px; font-family: var(--font-mono); font-size: 0.9em; }
        .var-type { color: var(--type-color); font-size: 0.85em; opacity: 0.8; }
        .var-name { color: var(--name-color); font-weight: bold; }
        .var-value-scalar { color: var(--value-color); font-family: var(--font-mono); font-weight: bold; font-size: 1.2em; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 4px; display: inline-block; }
        
        /* Arrays & Structures */
        .var-value-array { display: flex; flex-wrap: wrap; gap: 4px; }
        .array-cell-container { display: flex; flex-direction: column; align-items: center; }
        .array-cell {
            background: var(--bg-color); border: 1px solid var(--border-color);
            padding: 4px; min-width: 24px; text-align: center;
            font-family: var(--font-mono); color: var(--value-color); font-weight: bold;
            border-radius: 4px;
        }
        .array-index { font-size: 0.7em; color: var(--fg-color); opacity: 0.5; margin-top: 2px; }
        
        /* History Items */
        .history-item {
            padding: 4px 8px; cursor: pointer; border-radius: 4px; margin-bottom: 2px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .history-item:hover { background: var(--card-bg); }
        .history-item.active { background: var(--highlight-bg); border-left: 3px solid var(--name-color); padding-left: 5px; }

        /* Animations */
        @keyframes flash {
            0% { box-shadow: 0 0 8px #d7ba7d; border-color: #d7ba7d; }
            100% { box-shadow: none; border-color: var(--border-color); }
        }
        .delta-changed .var-value-scalar, .delta-changed .array-cell {
            animation: flash 1.5s ease-out;
        }
        
        .hidden { display: none !important; }
        
        
        /* Responsive Layout */
        #main-view-inner {
            display: flex;
            flex-grow: 1;
            gap: 16px;
            min-height: 0;
            flex-direction: row;
        }
        #history-panel {
            width: 280px;
            min-width: 250px;
            margin-bottom: 0;
            display: flex;
            flex-direction: column;
        }
        
        @media (max-width: 900px) {
            #main-view-inner {
                flex-direction: column;
            }
            #history-panel {
                width: 100%;
                min-height: 150px;
                flex-grow: 0;
            }
        }
        @media (max-width: 650px) {
            body {
                flex-direction: column;
            }
            #left-sidebar {
                width: 100% !important;
                max-width: none !important;
                height: 300px;
                flex-shrink: 0;
                border-right: none !important;
                border-bottom: 1px solid var(--border-color);
            }
            #main-view {
                width: 100%;
            }
        }

            #history-panel {
                width: 100%;
                min-height: 150px;
                flex-grow: 0;
            }
        }
        
        /* Modern Scrollbars */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(128, 128, 128, 0.3); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(128, 128, 128, 0.5); }

        /* Graph View */
        .visual-node {
            position: absolute; display: flex; flex-direction: column; align-items: center; justify-content: center;
            transform: translate(-50%, -50%); background: var(--card-bg); font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.4);
            transition: top 0.3s ease, left 0.3s ease;
            font-family: var(--font-mono); color: var(--value-color);
        }
        .tree-node { width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--name-color); }
        .list-node { width: 50px; height: 30px; border-radius: 4px; border: 2px solid var(--type-color); }
        .graph-node { width: 40px; height: 40px; border-radius: 50%; border: 2px solid #c586c0; }

        .pointer-labels {
            position: absolute; bottom: calc(100% + 8px); display: flex; flex-direction: column-reverse;
            align-items: center; gap: 4px; white-space: nowrap; pointer-events: none;
        }
        .pointer-label { background: var(--name-color); color: var(--bg-color); font-size: 11px; padding: 2px 6px; border-radius: 8px; font-family: monospace; font-weight: bold; }
    </style>
</head>
<body>

    <!-- Left Sidebar -->
    <div id="left-sidebar">
        <div class="header">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--name-color)" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            DryRun
        </div>

        <!-- Input Panel -->
        <div class="panel" id="input-panel">
            <div class="panel-header">
                <span>📥 Input</span>
                <button id="toggle-input-btn" class="icon-btn" style="font-size: 0.8em;">Collapse</button>
            </div>
            <div class="panel-content" id="input-area">
                <textarea id="sample-input" placeholder="Enter std input..."></textarea>
                <button id="run-btn" style="width: 100%; margin-top: 8px;">▶ Run Code</button>
            </div>
        </div>
        
        <!-- Controls -->
        <div class="panel" id="controls-panel">
            <div class="panel-header">⚙️ Controls</div>
            <div class="panel-content">
                <div style="display: flex; gap: 4px; justify-content: center; margin-bottom: 12px;">
                    <button id="btn-first" class="icon-btn" title="First Step">⏮</button>
                    <button id="btn-prev" class="icon-btn" title="Previous Step">◀</button>
                    <button id="btn-play" style="flex-grow: 1;">⏵ Play</button>
                    <button id="btn-next" class="icon-btn" title="Next Step">▶</button>
                </div>
                
                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.9em; margin-bottom: 8px;">
                    <span style="color: var(--fg-color); opacity: 0.8;">Speed:</span>
                    <select id="speed-select" style="padding: 2px 4px;">
                        <option value="1000">0.5X</option>
                        <option value="500" selected>1X</option>
                        <option value="250">2X</option>
                        <option value="167">3X</option>
                        <option value="125">4X</option>
                    </select>
                </div>
                
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 0.85em; color: var(--fg-color); opacity: 0.8;">Step:</span> <input type="range" id="progress-slider" title="Scrub through execution steps" min="0" max="0" value="0" style="flex-grow: 1; cursor: pointer;">
                    <span id="step-counter" style="font-family: var(--font-mono); font-size: 0.85em;">0/0</span>
                </div>
            </div>
        </div>

        <!-- Memory structure list -->
        <div class="panel" style="flex-grow: 1; display: flex; flex-direction: column; min-height: 200px;">
            <div class="panel-header">📋 Variables</div>
            <div class="panel-content" id="memory-panel" style="flex-grow: 1; overflow-y: auto;">
                <div class="empty-state" style="opacity: 0.5; font-style: italic;">No active variables</div>
            </div>
        </div>

        <!-- Output at the very bottom -->
        <div class="panel" style="margin-bottom: 0;">
            <div class="panel-header">📤 Output</div>
            <div class="panel-content">
                <div id="output-area" style="font-family: var(--font-mono); white-space: pre-wrap; color: var(--value-color); min-height: 40px; font-size: 0.9em;"></div>
            </div>
        </div>
    </div>

    <!-- Main View (Right Side) -->
    <div id="main-view">
        
        <!-- Error Panel -->
        <div id="error-panel" class="panel hidden" style="border-color: #f48771;">
            <div class="panel-header" style="background: rgba(244, 135, 113, 0.2); color: #f48771;">⚠️ Error</div>
            <div class="panel-content">
                <div id="error-msg" style="font-weight: bold; color: #f48771;"></div>
                <div id="error-line" style="font-family: var(--font-mono); font-size: 0.9em; margin-top: 4px;"></div>
            </div>
        </div>

        <div id="main-view-inner">
            
            <!-- Graphical Visualizer -->
            <div class="panel" style="flex-grow: 1; margin-bottom: 0; display: flex; flex-direction: column; min-height: 250px; min-width: 0;">
                <div class="panel-header" style="justify-content: flex-start; gap: 12px;">
                    <span style="color: var(--name-color);">Data Structure Visualization</span>
                    <span id="step-desc" style="font-family: var(--font-mono); font-weight: normal; color: var(--fg-color); opacity: 0.8;"></span>
                    <span id="line-counter" class="hidden"></span>
                </div>
                <div id="graph-view" style="flex-grow: 1; position: relative; background: #1e1e1e; overflow: hidden;">
                    <svg id="edges" style="position: absolute; top: 0; left: 0; width: 3000px; height: 3000px; pointer-events: none;">
                        <defs>
                            <marker id="arrow" viewBox="0 -5 10 10" refX="22" refY="0" markerWidth="8" markerHeight="8" orient="auto">
                                <path d="M0,-5L10,0L0,5" fill="var(--name-color)"></path>
                            </marker>
                        </defs>
                    </svg>
                    <div id="nodes" style="position: absolute; top: 0; left: 0; width: 3000px; height: 3000px;"></div>
                </div>
            </div>

            <!-- History / Events -->
            <div id="history-panel" class="panel">
                <div class="panel-header">⏱️ History / Events</div>
                <div class="panel-content" id="history-list" style="flex-grow: 1; overflow-y: auto; padding: 8px;">
                    <div style="opacity: 0.5; font-style: italic; text-align: center; margin-top: 20px;">Run code to see history</div>
                </div>
            </div>

            <div id="callstack-panel" class="hidden"><div id="callstack-path"></div></div>
        </div>

    </div>

    <script>

        const vscode = acquireVsCodeApi();

        class Visualizer {
            constructor() {
                this.svgHtml = '<defs><marker id="arrow" viewBox="0 -5 10 10" refX="22" refY="0" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,-5L10,0L0,5" fill="var(--name-color)"></path></marker></defs>';
                this.nodesHtml = '';
                this.graphNodes = new Map(); 
                this.graphEdges = []; 
                this.pointers = new Map(); 
            }

            addPointer(nodeId, varName) {
                if (!this.pointers.has(nodeId)) {
                    this.pointers.set(nodeId, []);
                }
                this.pointers.get(nodeId).push(varName);
            }

            traverse(node, visited = new Set()) {
                if (!node || typeof node !== 'object' || !node.__id__) return;
                if (visited.has(node.__id__)) return;
                visited.add(node.__id__);
                
                if (!this.graphNodes.has(node.__id__)) {
                    this.graphNodes.set(node.__id__, {
                        val: node.val ?? node.value ?? node.data ?? '?',
                        type: node.__type__, x: 0, y: 0 
                    });
                }

                ['next', 'left', 'right'].forEach(prop => {
                    if (node[prop] && typeof node[prop] === 'object' && node[prop].__id__) {
                        const edgeExists = this.graphEdges.some(e => e.source === node.__id__ && e.target === node[prop].__id__);
                        if (!edgeExists) {
                            this.graphEdges.push({ source: node.__id__, target: node[prop].__id__, type: prop });
                            this.traverse(node[prop], visited);
                        }
                    }
                });
                
                // For adjacency lists (e.g. neighbors list)
                if (node.neighbors && Array.isArray(node.neighbors)) {
                    node.neighbors.forEach(neighbor => {
                        if (neighbor && typeof neighbor === 'object' && neighbor.__id__) {
                            const edgeExists = this.graphEdges.some(e => e.source === node.__id__ && e.target === neighbor.__id__);
                            if (!edgeExists) {
                                this.graphEdges.push({ source: node.__id__, target: neighbor.__id__, type: 'neighbor' });
                                this.traverse(neighbor, visited);
                            }
                        }
                    });
                }
            }

            render() {
                const inDegree = new Map();
                for (const id of this.graphNodes.keys()) inDegree.set(id, 0);
                for (const edge of this.graphEdges) {
                    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
                }

                let roots = [];
                for (const [id, deg] of inDegree.entries()) {
                    if (deg === 0) roots.push(id);
                }
                if (roots.length === 0 && this.graphNodes.size > 0) {
                    roots.push(this.graphNodes.keys().next().value);
                }

                let currentY = 80;
                const visited = new Set();
                
                const canvasWidth = document.getElementById('graph-view').clientWidth || 600;
                const startX = Math.max(canvasWidth / 2, 300);

                const assignCoords = (id, x, y, offsetX) => {
                    if (visited.has(id)) return;
                    visited.add(id);

                    const node = this.graphNodes.get(id);
                    node.x = x;
                    node.y = y;

                    const children = this.graphEdges.filter(e => e.source === id);
                    
                    let nextX = x - (offsetX * (children.length - 1)) / 2;
                    
                    for (const edge of children) {
                        if (edge.type === 'next') assignCoords(edge.target, x + 100, y, offsetX);
                        else if (edge.type === 'left') assignCoords(edge.target, x - offsetX, y + 80, offsetX / 1.5);
                        else if (edge.type === 'right') assignCoords(edge.target, x + offsetX, y + 80, offsetX / 1.5);
                        else if (edge.type === 'neighbor') {
                            assignCoords(edge.target, nextX, y + 100, offsetX / 1.2);
                            nextX += offsetX;
                        }
                    }
                };

                for (const rootId of roots) {
                    assignCoords(rootId, startX, currentY, 150);
                    currentY += 150; 
                }

                for (const edge of this.graphEdges) {
                    const source = this.graphNodes.get(edge.source);
                    const target = this.graphNodes.get(edge.target);
                    if (!source || !target) continue;
                    
                    let color = "var(--name-color)";
                    if (edge.type === 'next') color = "var(--type-color)";
                    if (edge.type === 'neighbor') color = "#c586c0";
                    
                    if (edge.type === 'next' || edge.type === 'neighbor') {
                        this.svgHtml += \`<line x1="\${source.x}" y1="\${source.y}" x2="\${target.x}" y2="\${target.y}" stroke="\${color}" stroke-width="2" marker-end="url(#arrow)"/>\`;
                    } else {
                        this.svgHtml += \`<line x1="\${source.x}" y1="\${source.y}" x2="\${target.x}" y2="\${target.y}" stroke="\${color}" stroke-width="2"/>\`;
                    }
                }

                for (const [id, node] of this.graphNodes.entries()) {
                    let cssClass = 'graph-node';
                    if (node.type && node.type.includes('Tree')) cssClass = 'tree-node';
                    if (node.type && node.type.includes('List')) cssClass = 'list-node';
                    
                    let labelsHtml = '';
                    if (this.pointers.has(id)) {
                        labelsHtml = \`<div class="pointer-labels">\${this.pointers.get(id).map(name => \`<span class="pointer-label">\${name}</span>\`).join('')}</div>\`;
                    }
                    this.nodesHtml += \`<div class="visual-node \${cssClass}" style="left: \${node.x}px; top: \${node.y}px" id="node-\${id}">\${labelsHtml}\${node.val}</div>\`;
                }

                document.getElementById('edges').innerHTML = this.svgHtml;
                document.getElementById('nodes').innerHTML = this.nodesHtml;
            }
        }
        
        let steps = [];
        let currentStepIndex = -1;
        let playing = false;
        let playInterval = null;
        let speedMs = 500;
        let declaredVariables = new Set();

        // UI Elements
        const inputPanel = document.getElementById('input-panel');
        const toggleInputBtn = document.getElementById('toggle-input-btn');
        const sampleInput = document.getElementById('sample-input');
        const runBtn = document.getElementById('run-btn');
        
        const errorPanel = document.getElementById('error-panel');
        const errorMsg = document.getElementById('error-msg');
        const errorLine = document.getElementById('error-line');

        const btnFirst = document.getElementById('btn-first');
        const btnPrev = document.getElementById('btn-prev');
        const btnPlay = document.getElementById('btn-play');
        const btnNext = document.getElementById('btn-next');
        const speedSlider = document.getElementById('speed-slider');
        
        const stepCounter = document.getElementById('step-counter');
        const lineCounter = document.getElementById('line-counter');
        const stepDesc = document.getElementById('step-desc');
        
        const memoryPanel = document.getElementById('memory-panel');
        const callstackPanel = document.getElementById('callstack-panel');
        const callstackPath = document.getElementById('callstack-path');
        const outputArea = document.getElementById('output-area');

        // Initialization
        vscode.postMessage({ command: 'ready' });

        // Event Listeners - UI
        toggleInputBtn.addEventListener('click', () => {
            inputPanel.classList.toggle('collapsed');
            toggleInputBtn.textContent = inputPanel.classList.contains('collapsed') ? 'Expand' : 'Collapse';
        });

        runBtn.addEventListener('click', () => {
            inputPanel.classList.add('collapsed');
            toggleInputBtn.textContent = 'Expand';
            errorPanel.style.display = 'none';
            vscode.postMessage({ command: 'requestRun', input: sampleInput.value });
        });

        btnFirst.addEventListener('click', () => goToStep(0));
        btnPrev.addEventListener('click', () => goToStep(currentStepIndex - 1));
        btnNext.addEventListener('click', () => goToStep(currentStepIndex + 1));
        btnPlay.addEventListener('click', togglePlay);

        speedSlider.addEventListener('input', (e) => {
            speedMs = parseInt(e.target.value);
            if (playing) {
                stopPlay();
                startPlay();
            }
        });

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            if (document.activeElement.tagName === 'TEXTAREA') return;
            if (e.key === 'ArrowLeft') goToStep(currentStepIndex - 1);
            else if (e.key === 'ArrowRight') goToStep(currentStepIndex + 1);
            else if (e.key === ' ') {
                e.preventDefault();
                togglePlay();
            }
        });

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'loadSteps':
                    steps = message.steps || [];
                    declaredVariables.clear();
                    goToStep(0);
                    break;
                case 'error':
                    showError(message.message, message.line);
                    break;
                case 'goToStep':
                    goToStep(message.step);
                    break;
            }
        });

        function togglePlay() {
            if (playing) stopPlay();
            else startPlay();
        }

        function startPlay() {
            if (steps.length === 0 || currentStepIndex >= steps.length - 1) return;
            playing = true;
            btnPlay.textContent = '⏸ Pause';
            playInterval = setInterval(() => {
                if (currentStepIndex < steps.length - 1) {
                    goToStep(currentStepIndex + 1, false);
                } else {
                    stopPlay();
                }
            }, speedMs);
        }

        function stopPlay() {
            playing = false;
            btnPlay.textContent = '⏵ Play';
            if (playInterval) clearInterval(playInterval);
        }

        function goToStep(index, notifyExtension = true) {
            if (!steps.length || index < 0 || index >= steps.length) return;
            
            const prevStep = currentStepIndex >= 0 ? steps[currentStepIndex] : null;
            currentStepIndex = index;
            const state = steps[index];

            stepCounter.textContent = \`\${index + 1}/\${steps.length}\`;
            lineCounter.textContent = state.line;
            
            const actionBadge = \`[\${(state.action || 'STEP').toUpperCase()}]\`;
            stepDesc.innerHTML = \`<strong>\${actionBadge}</strong> \${state.description || ''}\`;

            if (state.callStack && state.callStack.length > 1) {
                callstackPanel.classList.remove('hidden');
                callstackPath.innerHTML = state.callStack.map(f => \`<span class="breadcrumb-item">\${f}</span>\`).join('');
            } else {
                callstackPanel.classList.add('hidden');
            }

            outputArea.textContent = state.output || '';
            renderMemory(state, prevStep);
            
            // Render history
            const historyList = document.getElementById('history-list');
            if (historyList) {
                historyList.innerHTML = '';
                for (let i = 0; i <= currentStepIndex; i++) {
                    const s = steps[i];
                    const div = document.createElement('div');
                    div.className = 'history-item' + (i === currentStepIndex ? ' active' : '');
                    div.innerHTML = '<span style="color:#858585; margin-right:8px; font-family: monospace;">' + (s.line||'-') + '</span> <span>' + s.description + '</span>';
                    div.onclick = () => goToStep(i);
                    historyList.appendChild(div);
                }
                // Scroll to bottom
                historyList.scrollTop = historyList.scrollHeight;
            }

            if (notifyExtension) {
                vscode.postMessage({ 
                    command: 'stepChanged', 
                    line: state.line, 
                    stepIndex: index 
                });
            }
        }

        function renderMap(v, isHighlighted, highlightIndex) {
            if (!v.value || typeof v.value !== 'object') return '<div class="var-value-scalar">?</div>';
            let html = '<table class="map-table"><tr><th>Key</th><th>Value</th></tr>';
            for (const [key, val] of Object.entries(v.value)) {
                html += \`<tr><td>\${key}</td><td>\${val}</td></tr>\`;
            }
            html += '</table>';
            return html;
        }

        function renderSet(v, isHighlighted) {
            const arr = Array.isArray(v.value) ? v.value : [];
            if (arr.length === 0) return '<div class="set-container"><span class="set-badge" style="background:transparent;border:none;">{ }</span></div>';
            let html = '<div class="set-container"><span style="font-family: var(--font-mono);">{</span>';
            arr.forEach(val => {
                html += \`<span class="set-badge">\${val}</span>\`;
            });
            html += '<span style="font-family: var(--font-mono);">}</span></div>';
            return html;
        }

        function renderStack(v, isHighlighted) {
            const arr = Array.isArray(v.value) ? v.value : [];
            let html = '<div class="stack-container">';
            if (arr.length === 0) {
                html += '<div class="var-value-scalar" style="font-size:1em;">empty</div>';
            } else {
                for (let i = arr.length - 1; i >= 0; i--) {
                    const isTop = (i === arr.length - 1);
                    const hlClass = (isTop && isHighlighted) ? 'cell-highlight' : '';
                    html += \`
                        <div class="stack-cell-wrapper">
                            <div class="stack-cell \${hlClass}">\${arr[i]}</div>
                            \${isTop ? '<div class="stack-top-label">← top</div>' : '<div style="width: 40px;"></div>'}
                        </div>
                    \`;
                }
            }
            html += '</div>';
            return html;
        }

        function renderQueue(v, isHighlighted) {
            const arr = Array.isArray(v.value) ? v.value : [];
            let html = '<div class="queue-container">';
            if (arr.length === 0) {
                html += '<div class="var-value-scalar" style="font-size:1em;">empty</div>';
            } else {
                html += '<div class="queue-label">front →</div>';
                arr.forEach((val, idx) => {
                    html += \`<div class="queue-cell">\${val}</div>\`;
                });
                html += '<div class="queue-label">← back</div>';
            }
            html += '</div>';
            return html;
        }

        function renderArray(v, isHighlighted, highlightIndex) {
            let elements = [];
            if (Array.isArray(v.value)) {
                elements = v.value;
            } else if (typeof v.value === 'object' && v.value !== null) {
                const maxIdx = v.size ? v.size : Math.max(-1, ...Object.keys(v.value).map(Number)) + 1;
                for(let i=0; i<maxIdx; i++) elements.push(v.value[i]);
            } else {
                elements = new Array(v.size || 0).fill('?');
            }

            // Check if it's a 2D array
            const is2D = elements.length > 0 && Array.isArray(elements[0]);
            
            if (is2D) {
                let html = '<table class="map-table" style="margin-top: 4px;">';
                // X-axis indices
                html += '<tr><th style="background:transparent;border:none;"></th>';
                for (let j = 0; j < elements[0].length; j++) {
                    html += \`<th style="font-size:0.7em;">\${j}</th>\`;
                }
                html += '</tr>';
                
                elements.forEach((row, rIdx) => {
                    html += '<tr>';
                    html += \`<th style="font-size:0.7em;">\${rIdx}</th>\`; // Y-axis index
                    
                    const rowArr = Array.isArray(row) ? row : (typeof row === 'object' && row !== null ? Object.values(row) : [row]);
                    rowArr.forEach((val, cIdx) => {
                        const cellHighlight = (isHighlighted && highlightIndex === \`\${rIdx},\${cIdx}\`) ? 'cell-highlight' : '';
                        const displayVal = val === undefined || val === null ? '?' : val;
                        html += \`<td class="\${cellHighlight}">\${displayVal}</td>\`;
                    });
                    html += '</tr>';
                });
                html += '</table>';
                return html;
            }

            // 1D array
            let html = '<div class="var-value-array">';
            elements.forEach((val, idx) => {
                const cellHighlight = (isHighlighted && highlightIndex === idx) ? 'cell-highlight' : '';
                const displayVal = val === undefined || val === null ? '?' : val;
                html += \`
                    <div class="array-cell-container">
                        <div class="array-cell \${cellHighlight}">\${displayVal}</div>
                        <div class="array-index">\${idx}</div>
                    </div>
                \`;
            });
            html += '</div>';
            return html;
        }

        function renderScalar(v, isHighlighted) {
            const displayVal = v.value === undefined || v.value === null ? '?' : v.value;
            return \`<div class="var-value-scalar">\${displayVal}</div>\`;
        }

        function didValueChange(prev, curr) {
            if (prev === undefined || prev === null) return curr !== undefined && curr !== null;
            if (typeof prev !== typeof curr) return true;
            if (Array.isArray(prev) && Array.isArray(curr)) {
                if (prev.length !== curr.length) return true;
                return prev.some((v, i) => v !== curr[i]);
            }
            if (typeof prev === 'object' && typeof curr === 'object') {
                return JSON.stringify(prev) !== JSON.stringify(curr);
            }
            return prev !== curr;
        }

        
        function renderMemory(state, prevStep) {
            const visualizer = new Visualizer();
            const vars = state.variables || {};
            const prevVars = prevStep ? (prevStep.variables || {}) : {};
            
            Object.keys(vars).forEach(v => declaredVariables.add(v));
            
            if (declaredVariables.size === 0) {
                memoryPanel.innerHTML = '<div class="empty-state">No active variables</div>';
                document.getElementById('nodes').innerHTML = '';
                document.getElementById('edges').innerHTML = '';
                return;
            }

            // 1. Setup the Variables Table
            let tableHtml = '<table style="width: 100%; border-collapse: collapse; text-align: left; font-family: var(--font-mono); font-size: 0.9em;">';
            tableHtml += '<thead><tr style="border-bottom: 1px solid var(--border-color);"><th style="padding-bottom: 4px;">Name</th><th style="padding-bottom: 4px;">Type</th><th style="padding-bottom: 4px;">Value</th></tr></thead><tbody>';

            // 2. Setup a container for complex structures inside graph-view
            let structuresHtml = '<div style="display: flex; flex-direction: column; gap: 16px; padding: 16px;">';

            Array.from(declaredVariables).sort().forEach(varName => {
                const isActive = varName in vars;
                let v = isActive ? vars[varName] : (prevStep && prevStep.variables[varName] ? prevStep.variables[varName] : null);
                if (!v) return;
                v = { ...v };

                if (v.type) {
                    const typeStr = v.type.toLowerCase();
                    if (!v.isMap && (typeStr.includes('map') || typeStr.includes('dict'))) v.isMap = true;
                    if (!v.isSet && typeStr.includes('set')) v.isSet = true;
                    if (!v.isStack && typeStr.includes('stack')) v.isStack = true;
                    if (!v.isQueue && (typeStr.includes('queue') || typeStr.includes('deque'))) v.isQueue = true;
                }

                const isHighlighted = (state.highlightVar === varName);
                const highlightIndex = state.highlightIndex;
                const prevVal = prevVars[varName];
                const valueChanged = isActive && prevVal && didValueChange(prevVal.value, v.value);

                let rowClass = !isActive ? 'opacity: 0.5;' : '';
                if (isHighlighted) rowClass += ' background: var(--highlight-bg);';
                
                let changeIndicator = valueChanged ? '<span style="color:#d7ba7d;">*</span>' : '';

                let displayValue = '';
                let isComplex = false;

                if (v.isGraphNode) {
                    visualizer.traverse(v.value);
                    visualizer.addPointer(v.value.__id__, varName);
                    displayValue = '→ ' + (v.type || 'Node');
                } else if (v.isMap) {
                    displayValue = 'size = ' + Object.keys(v.value || {}).length;
                    isComplex = true;
                    structuresHtml += '<div class="var-card" style="display:inline-block; margin-bottom:8px;"><div class="var-header"><span class="var-type">' + v.type + '</span> <span class="var-name">' + varName + '</span></div>' + renderMap(v, isHighlighted, highlightIndex) + '</div>';
                } else if (v.isSet) {
                    displayValue = 'size = ' + ((v.value || []).length);
                    isComplex = true;
                    structuresHtml += '<div class="var-card" style="display:inline-block; margin-bottom:8px;"><div class="var-header"><span class="var-type">' + v.type + '</span> <span class="var-name">' + varName + '</span></div>' + renderSet(v, isHighlighted) + '</div>';
                } else if (v.isStack) {
                    displayValue = 'size = ' + ((v.value || []).length);
                    isComplex = true;
                    structuresHtml += '<div class="var-card" style="display:inline-block; margin-bottom:8px;"><div class="var-header"><span class="var-type">' + v.type + '</span> <span class="var-name">' + varName + '</span></div>' + renderStack(v, isHighlighted) + '</div>';
                } else if (v.isQueue) {
                    displayValue = 'size = ' + ((v.value || []).length);
                    isComplex = true;
                    structuresHtml += '<div class="var-card" style="display:inline-block; margin-bottom:8px;"><div class="var-header"><span class="var-type">' + v.type + '</span> <span class="var-name">' + varName + '</span></div>' + renderQueue(v, isHighlighted) + '</div>';
                } else if (v.isArray) {
                    let len = Array.isArray(v.value) ? v.value.length : (v.size || 0);
                    displayValue = 'size = ' + (len);
                    isComplex = true;
                    structuresHtml += '<div class="var-card" style="display:inline-block; margin-bottom:8px;"><div class="var-header"><span class="var-type">' + v.type + '</span> <span class="var-name">' + varName + '</span></div>' + renderArray(v, isHighlighted, highlightIndex) + '</div>';
                } else {
                    displayValue = v.value === undefined || v.value === null ? '?' : v.value;
                }

                tableHtml += '<tr style="' + rowClass + '"><td style="padding: 4px 0; color: var(--name-color);">' + varName + changeIndicator + '</td><td style="padding: 4px 0; color: var(--type-color); font-size: 0.9em;">' + (v.type || 'auto') + '</td><td style="padding: 4px 0; color: var(--value-color);">' + displayValue + '</td></tr>';
            });
            
            tableHtml += '</tbody></table>';
            memoryPanel.innerHTML = tableHtml;

            structuresHtml += '</div>';

            // We inject structuresHtml into the graph-view, but we must preserve the nodes and edges SVG!
            // Let's create a dedicated container for structures if it doesn't exist
            let structContainer = document.getElementById('complex-structures');
            if (!structContainer) {
                structContainer = document.createElement('div');
                structContainer.id = 'complex-structures';
                structContainer.style.position = 'absolute';
                structContainer.style.top = '0';
                structContainer.style.left = '0';
                structContainer.style.width = '100%';
                 // let clicks pass to graph if needed
                document.getElementById('graph-view').appendChild(structContainer);
            }
            structContainer.innerHTML = structuresHtml;
            
            // Re-render Graph (linked lists, trees)
            visualizer.render();
        }


        function showError(msg, line) {
            stopPlay();
            errorPanel.style.display = 'block';
            errorMsg.textContent = msg;
            if (line) {
                errorLine.textContent = \`At line \${line}\`;
            } else {
                errorLine.textContent = 'Check your code and try again.';
            }
        }
    
    </script>
</body>
</html>`;
}

module.exports = { getWebviewContent };
