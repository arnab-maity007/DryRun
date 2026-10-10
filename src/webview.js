function getWebviewContent() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DryRun Visualizer</title>
    <style>
        :root {
            --bg: var(--vscode-editor-background, #1e1e1e);
            --fg: var(--vscode-editor-foreground, #cccccc);
            --border: var(--vscode-panel-border, #3c3c3c);
            --card: var(--vscode-editorWidget-background, #252526);
            --sel: var(--vscode-editor-selectionBackground, #264f78);
            --accent: var(--vscode-symbolIcon-variableForeground, #75beff);
            --type-c: var(--vscode-symbolIcon-classForeground, #ee9d28);
            --val-c: var(--vscode-terminal-ansiGreen, #89d185);
            --btn-bg: var(--vscode-button-background, #0e639c);
            --btn-fg: var(--vscode-button-foreground, #ffffff);
            --btn-hover: var(--vscode-button-hoverBackground, #1177bb);
            --input-bg: var(--vscode-input-background, #3c3c3c);
            --input-fg: var(--vscode-input-foreground, #cccccc);
            --mono: var(--vscode-editor-font-family, Consolas, 'Courier New', monospace);
            --r: 5px;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            background: var(--bg);
            color: var(--fg);
            font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
            font-size: 13px;
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        /* ─── Scrollbars ─── */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.3); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(128,128,128,0.5); }

        /* ─── Header ─── */
        #header {
            display: flex; align-items: center; gap: 8px;
            padding: 10px 14px;
            font-size: 1.15em; font-weight: 700;
            border-bottom: 1px solid var(--border);
            flex-shrink: 0;
        }
        #header svg { flex-shrink: 0; }

        /* ─── Sections ─── */
        .section {
            border-bottom: 1px solid var(--border);
            flex-shrink: 0;
        }
        .section-head {
            display: flex; align-items: center; justify-content: space-between;
            padding: 6px 14px;
            font-weight: 600; font-size: 0.92em;
            cursor: pointer; user-select: none;
        }
        .section-head:hover { background: rgba(255,255,255,0.04); }
        .section-body { padding: 6px 14px 10px; }

        /* ─── Buttons ─── */
        button {
            background: var(--btn-bg); color: var(--btn-fg);
            border: none; border-radius: var(--r);
            padding: 5px 14px; cursor: pointer;
            font-size: 0.92em;
        }
        button:hover { background: var(--btn-hover); }
        .ctrl-btn {
            width: 36px; height: 32px;
            display: inline-flex; align-items: center; justify-content: center;
            background: var(--card); color: var(--fg);
            border: 1px solid var(--border); border-radius: var(--r);
            font-size: 1.1em; padding: 0;
        }
        .ctrl-btn:hover { background: var(--sel); }
        .ctrl-btn.primary { background: var(--btn-bg); color: var(--btn-fg); border-color: transparent; width: auto; padding: 0 16px; }
        .ctrl-btn.primary:hover { background: var(--btn-hover); }

        /* ─── Input ─── */
        #input-row { display: flex; gap: 8px; align-items: stretch; }
        #sample-input {
            flex: 1; resize: none;
            background: var(--input-bg); color: var(--input-fg);
            border: 1px solid var(--border); border-radius: var(--r);
            padding: 6px 8px; font-family: var(--mono); font-size: 0.92em;
            min-height: 36px; max-height: 120px;
        }
        #run-btn {
            flex-shrink: 0; padding: 0 18px;
            font-weight: 600; font-size: 0.95em;
        }

        /* ─── Controls ─── */
        #controls-row {
            display: flex; align-items: center; gap: 6px;
            flex-wrap: wrap;
        }
        #speed-select {
            background: var(--input-bg); color: var(--input-fg);
            border: 1px solid var(--border); border-radius: var(--r);
            padding: 3px 6px; font-size: 0.9em; margin-left: auto;
        }
        .step-info {
            font-family: var(--mono); font-size: 0.85em;
            opacity: 0.7; white-space: nowrap;
        }

        /* ─── Variables Table ─── */
        #var-table {
            width: 100%; border-collapse: collapse;
            font-family: var(--mono); font-size: 0.88em;
        }
        #var-table th {
            text-align: left; padding: 3px 6px 5px;
            font-weight: 600; opacity: 0.6;
            border-bottom: 1px solid var(--border);
        }
        #var-table td {
            padding: 3px 6px;
        }
        #var-table tr.hl { background: var(--sel); }
        #var-table tr.oos { opacity: 0.4; }
        .vn { color: var(--accent); }
        .vt { color: var(--type-c); font-size: 0.9em; }
        .vv { color: var(--val-c); }
        .vv-link { color: var(--val-c); cursor: pointer; text-decoration: underline dotted; }
        .changed::after { content: ' ●'; color: #d7ba7d; font-size: 0.7em; }

        /* ─── Output ─── */
        #output-area {
            font-family: var(--mono); font-size: 0.9em;
            white-space: pre-wrap; color: var(--val-c);
            min-height: 24px; max-height: 100px; overflow-y: auto;
        }

        /* ─── Error ─── */
        #error-panel {
            background: rgba(244,135,113,0.08);
            border-left: 3px solid #f48771;
            padding: 8px 14px; display: none;
            flex-shrink: 0;
        }
        #error-panel .err-title { color: #f48771; font-weight: 600; margin-bottom: 2px; }
        #error-panel .err-detail { font-family: var(--mono); font-size: 0.9em; }

        /* ─── Bottom Split ─── */
        #bottom-area {
            flex: 1; display: flex;
            min-height: 0; /* crucial for flex overflow */
            border-top: 1px solid var(--border);
        }
        #viz-pane {
            flex: 1; display: flex; flex-direction: column;
            min-width: 0;
            border-right: 1px solid var(--border);
        }
        #viz-pane .pane-head {
            padding: 5px 12px;
            font-weight: 600; font-size: 0.88em;
            background: var(--card); border-bottom: 1px solid var(--border);
            flex-shrink: 0;
            display: flex; align-items: center; gap: 8px;
        }
        #viz-content {
            flex: 1; position: relative;
            overflow: auto; background: var(--bg);
        }
        /* Structure cards inside viz */
        .ds-card {
            margin: 10px 12px;
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: var(--r);
            padding: 8px 10px;
        }
        .ds-card-head {
            display: flex; gap: 6px; align-items: baseline;
            margin-bottom: 6px; font-family: var(--mono); font-size: 0.88em;
        }
        .ds-card-head .ds-name { color: var(--accent); font-weight: 600; }
        .ds-card-head .ds-type { color: var(--type-c); font-size: 0.85em; }
        .ds-card-head .ds-size { color: var(--fg); opacity: 0.6; font-size: 0.85em; }

        /* Array visualization */
        .arr-row { display: flex; flex-wrap: wrap; gap: 2px; }
        .arr-cell {
            min-width: 32px; height: 28px;
            display: flex; align-items: center; justify-content: center;
            background: var(--sel); border: 1px solid var(--border);
            border-radius: 3px;
            font-family: var(--mono); font-size: 0.9em;
            color: var(--val-c); font-weight: 600;
        }
        .arr-cell.empty { background: transparent; border-style: dashed; color: var(--fg); opacity: 0.3; }
        .arr-cell.cell-hl { background: #d7ba7d33; border-color: #d7ba7d; }
        .arr-idx-row { display: flex; flex-wrap: wrap; gap: 2px; }
        .arr-idx {
            min-width: 32px; height: 14px;
            text-align: center; font-size: 0.7em; opacity: 0.45;
            font-family: var(--mono);
        }

        /* Map table */
        .map-tbl { border-collapse: collapse; font-family: var(--mono); font-size: 0.88em; }
        .map-tbl th { padding: 2px 8px; font-weight: 600; border-bottom: 1px solid var(--border); opacity: 0.6; text-align: left; }
        .map-tbl td { padding: 2px 8px; }
        .map-tbl tr:nth-child(even) { background: rgba(255,255,255,0.02); }

        /* Set badges */
        .set-row { display: flex; flex-wrap: wrap; gap: 4px; }
        .set-badge {
            padding: 2px 8px; border-radius: 12px;
            background: rgba(117,190,255,0.12); border: 1px solid rgba(117,190,255,0.25);
            font-family: var(--mono); font-size: 0.88em; color: var(--accent);
        }

        /* Stack */
        .stack-col { display: flex; flex-direction: column; gap: 2px; align-items: flex-start; }
        .stack-cell {
            min-width: 48px; padding: 3px 10px;
            background: var(--sel); border: 1px solid var(--border); border-radius: 3px;
            font-family: var(--mono); color: var(--val-c); font-weight: 600; text-align: center;
        }
        .stack-top { display: flex; align-items: center; gap: 6px; }
        .stack-top .top-lbl { font-size: 0.75em; color: var(--type-c); opacity: 0.7; }

        /* Queue */
        .queue-row { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
        .queue-lbl { font-size: 0.78em; opacity: 0.5; font-family: var(--mono); }
        .queue-cell {
            padding: 3px 10px;
            background: var(--sel); border: 1px solid var(--border); border-radius: 3px;
            font-family: var(--mono); color: var(--val-c); font-weight: 600;
        }

        /* Scalar value (inside viz pane) */
        .scalar-val {
            font-family: var(--mono); font-weight: 700; font-size: 1.4em;
            color: var(--val-c); padding: 4px 0;
        }

        /* Graph / Tree nodes */
        .visual-node {
            position: absolute; display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            transform: translate(-50%, -50%);
            background: var(--card); font-weight: bold;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            transition: top 0.3s ease, left 0.3s ease;
            font-family: var(--mono); color: var(--val-c);
        }
        .tree-node { width: 38px; height: 38px; border-radius: 50%; border: 2px solid var(--accent); }
        .list-node { width: 48px; height: 28px; border-radius: 4px; border: 2px solid var(--type-c); }
        .graph-node { width: 38px; height: 38px; border-radius: 50%; border: 2px solid #c586c0; }
        .pointer-labels {
            position: absolute; bottom: calc(100% + 6px);
            display: flex; flex-direction: column-reverse;
            align-items: center; gap: 3px; white-space: nowrap; pointer-events: none;
        }
        .pointer-label {
            background: var(--accent); color: var(--bg);
            font-size: 10px; padding: 1px 5px; border-radius: 6px;
            font-family: monospace; font-weight: bold;
        }

        /* ─── History Pane ─── */
        #history-pane {
            width: 240px; min-width: 160px;
            display: flex; flex-direction: column;
        }
        #history-pane .pane-head {
            padding: 5px 12px;
            font-weight: 600; font-size: 0.88em;
            background: var(--card); border-bottom: 1px solid var(--border);
            flex-shrink: 0;
        }
        #history-list {
            flex: 1; overflow-y: auto; padding: 4px;
            font-size: 0.85em;
        }
        .hist-item {
            display: flex; gap: 6px; align-items: baseline;
            padding: 3px 6px; border-radius: 3px;
            cursor: pointer; white-space: nowrap;
            overflow: hidden; text-overflow: ellipsis;
        }
        .hist-item:hover { background: rgba(255,255,255,0.04); }
        .hist-item.active { background: var(--sel); border-left: 2px solid var(--accent); }
        .hist-line { color: var(--fg); opacity: 0.4; font-family: var(--mono); min-width: 20px; text-align: right; }
        .hist-desc { overflow: hidden; text-overflow: ellipsis; }

        /* Step description bar */
        #step-bar {
            padding: 4px 14px;
            font-family: var(--mono); font-size: 0.85em;
            background: var(--card);
            border-bottom: 1px solid var(--border);
            flex-shrink: 0; overflow: hidden;
            white-space: nowrap; text-overflow: ellipsis;
        }
        .action-badge {
            display: inline-block;
            padding: 1px 5px; border-radius: 3px;
            font-size: 0.8em; font-weight: 700;
            background: rgba(117,190,255,0.15); color: var(--accent);
            margin-right: 6px;
        }

        .hidden { display: none !important; }

        /* ─── 2D table ─── */
        .grid-2d { border-collapse: collapse; font-family: var(--mono); font-size: 0.85em; }
        .grid-2d th { padding: 2px 6px; font-size: 0.7em; opacity: 0.4; font-weight: normal; }
        .grid-2d td {
            min-width: 28px; height: 24px; text-align: center;
            border: 1px solid var(--border); color: var(--val-c);
        }
        .grid-2d td.cell-hl { background: #d7ba7d33; border-color: #d7ba7d; }

        /* ─── Collapsed section ─── */
        .section.collapsed .section-body { display: none; }
        .section-toggle { font-size: 0.7em; opacity: 0.5; transition: transform 0.15s; }
        .section.collapsed .section-toggle { transform: rotate(-90deg); }
    </style>
</head>
<body>

    <!-- Header -->
    <div id="header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--accent)" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        DryRun
    </div>

    <!-- Error -->
    <div id="error-panel">
        <div class="err-title">⚠️ <span id="error-msg"></span></div>
        <div class="err-detail" id="error-line"></div>
    </div>

    <!-- Input -->
    <div class="section" id="input-section">
        <div class="section-head" data-toggle="input-section">
            <span>Input</span>
            <span class="section-toggle">▼</span>
        </div>
        <div class="section-body">
            <div id="input-row">
                <textarea id="sample-input" rows="2" placeholder="Enter std input..."></textarea>
                <button id="run-btn">▶ Run</button>
            </div>
        </div>
    </div>

    <!-- Execution Controls -->
    <div class="section" id="controls-section">
        <div class="section-head" data-toggle="controls-section">
            <span>Execution Controls</span>
            <span class="section-toggle">▼</span>
        </div>
        <div class="section-body">
            <div id="controls-row">
                <button class="ctrl-btn" id="btn-first" title="First Step (Home)">⏮</button>
                <button class="ctrl-btn" id="btn-prev" title="Previous Step (←)">◀</button>
                <button class="ctrl-btn primary" id="btn-play" title="Play / Pause (Space)">▶ Play</button>
                <button class="ctrl-btn" id="btn-next" title="Next Step (→)">▶</button>
                <button class="ctrl-btn" id="btn-reset" title="Reset (R)">↻</button>
                <span style="margin-left:auto; font-size:0.88em;">Speed:</span>
                <select id="speed-select">
                    <option value="1000">0.5x</option>
                    <option value="500" selected>1x</option>
                    <option value="250">2x</option>
                    <option value="167">3x</option>
                    <option value="125">4x</option>
                </select>
            </div>
        </div>
    </div>

    <!-- Variables -->
    <div class="section" id="vars-section">
        <div class="section-head" data-toggle="vars-section">
            <span>Variables <span id="var-count" style="opacity:0.5"></span></span>
            <span class="section-toggle">▼</span>
        </div>
        <div class="section-body" style="padding-top:0;padding-bottom:4px">
            <table id="var-table">
                <thead><tr><th>Name</th><th>Type</th><th>Value</th></tr></thead>
                <tbody id="var-tbody"></tbody>
            </table>
            <div id="var-empty" style="opacity:0.4;font-style:italic;padding:6px 0">No active variables</div>
        </div>
    </div>

    <!-- Output -->
    <div class="section" id="output-section">
        <div class="section-head" data-toggle="output-section">
            <span>📤 Output</span>
            <span class="section-toggle">▼</span>
        </div>
        <div class="section-body">
            <div id="output-area"></div>
        </div>
    </div>

    <!-- Step description -->
    <div id="step-bar">
        <span id="step-counter" class="step-info"></span>
        <span id="step-desc" style="margin-left:8px"></span>
        <span id="line-counter" class="hidden"></span>
    </div>

    <!-- Bottom: Visualization + History -->
    <div id="bottom-area">
        <!-- Visualization Pane -->
        <div id="viz-pane">
            <div class="pane-head">
                <span style="color:var(--accent)">Data Structures</span>
            </div>
            <div id="viz-content">
                <!-- Structures will be rendered here -->
                <div id="ds-cards"></div>
                <!-- Graph/Tree overlay -->
                <svg id="edges" style="position:absolute;top:0;left:0;width:3000px;height:3000px;pointer-events:none">
                    <defs>
                        <marker id="arrow" viewBox="0 -5 10 10" refX="22" refY="0" markerWidth="8" markerHeight="8" orient="auto">
                            <path d="M0,-5L10,0L0,5" fill="var(--accent)"/>
                        </marker>
                    </defs>
                </svg>
                <div id="nodes" style="position:absolute;top:0;left:0;width:3000px;height:3000px"></div>
            </div>
        </div>

        <!-- History Pane -->
        <div id="history-pane">
            <div class="pane-head">History / Events</div>
            <div id="history-list">
                <div style="opacity:0.4;font-style:italic;text-align:center;padding:20px 8px">Run code to see execution history</div>
            </div>
        </div>
    </div>

    <!-- Invisible helpers -->
    <div id="callstack-panel" class="hidden"><div id="callstack-path"></div></div>

    <script>
        const vscode = acquireVsCodeApi();

        // ─── Visualizer class (tree / linked-list / graph rendering) ───
        class Visualizer {
            constructor() {
                this.svgHtml = '<defs><marker id="arrow" viewBox="0 -5 10 10" refX="22" refY="0" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,-5L10,0L0,5" fill="var(--accent)"/></marker></defs>';
                this.nodesHtml = '';
                this.graphNodes = new Map();
                this.graphEdges = [];
                this.pointers = new Map();
            }

            addPointer(nodeId, varName) {
                if (!this.pointers.has(nodeId)) this.pointers.set(nodeId, []);
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
                        const exists = this.graphEdges.some(e => e.source === node.__id__ && e.target === node[prop].__id__);
                        if (!exists) {
                            this.graphEdges.push({ source: node.__id__, target: node[prop].__id__, type: prop });
                            this.traverse(node[prop], visited);
                        }
                    }
                });

                if (node.neighbors && Array.isArray(node.neighbors)) {
                    node.neighbors.forEach(nb => {
                        if (nb && typeof nb === 'object' && nb.__id__) {
                            const exists = this.graphEdges.some(e => e.source === node.__id__ && e.target === nb.__id__);
                            if (!exists) {
                                this.graphEdges.push({ source: node.__id__, target: nb.__id__, type: 'neighbor' });
                                this.traverse(nb, visited);
                            }
                        }
                    });
                }
            }

            render() {
                const inDeg = new Map();
                for (const id of this.graphNodes.keys()) inDeg.set(id, 0);
                for (const e of this.graphEdges) inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1);

                let roots = [];
                for (const [id, d] of inDeg.entries()) { if (d === 0) roots.push(id); }
                if (roots.length === 0 && this.graphNodes.size > 0) roots.push(this.graphNodes.keys().next().value);

                let currentY = 60;
                const visited = new Set();
                const cw = document.getElementById('viz-content').clientWidth || 400;
                const startX = Math.max(cw / 2, 200);

                const assign = (id, x, y, off) => {
                    if (visited.has(id)) return;
                    visited.add(id);
                    const n = this.graphNodes.get(id);
                    n.x = x; n.y = y;
                    const ch = this.graphEdges.filter(e => e.source === id);
                    let nx = x - (off * (ch.length - 1)) / 2;
                    for (const edge of ch) {
                        if (edge.type === 'next') assign(edge.target, x + 90, y, off);
                        else if (edge.type === 'left') assign(edge.target, x - off, y + 70, off / 1.5);
                        else if (edge.type === 'right') assign(edge.target, x + off, y + 70, off / 1.5);
                        else { assign(edge.target, nx, y + 90, off / 1.2); nx += off; }
                    }
                };
                for (const r of roots) { assign(r, startX, currentY, 120); currentY += 120; }

                for (const edge of this.graphEdges) {
                    const s = this.graphNodes.get(edge.source);
                    const t = this.graphNodes.get(edge.target);
                    if (!s || !t) continue;
                    let col = 'var(--accent)';
                    if (edge.type === 'next') col = 'var(--type-c)';
                    if (edge.type === 'neighbor') col = '#c586c0';
                    const marker = (edge.type === 'next' || edge.type === 'neighbor') ? ' marker-end="url(#arrow)"' : '';
                    this.svgHtml += '<line x1="' + s.x + '" y1="' + s.y + '" x2="' + t.x + '" y2="' + t.y + '" stroke="' + col + '" stroke-width="2"' + marker + '/>';
                }

                for (const [id, node] of this.graphNodes.entries()) {
                    let cls = 'graph-node';
                    if (node.type && node.type.includes('Tree')) cls = 'tree-node';
                    if (node.type && node.type.includes('List')) cls = 'list-node';
                    let lbl = '';
                    if (this.pointers.has(id)) {
                        lbl = '<div class="pointer-labels">' + this.pointers.get(id).map(function(n){ return '<span class="pointer-label">' + n + '</span>'; }).join('') + '</div>';
                    }
                    this.nodesHtml += '<div class="visual-node ' + cls + '" style="left:' + node.x + 'px;top:' + node.y + 'px" id="node-' + id + '">' + lbl + node.val + '</div>';
                }

                document.getElementById('edges').innerHTML = this.svgHtml;
                document.getElementById('nodes').innerHTML = this.nodesHtml;
            }
        }

        // ─── State ───
        let steps = [];
        let currentStepIndex = -1;
        let playing = false;
        let playInterval = null;
        let speedMs = 500;
        let declaredVariables = new Set();

        // ─── DOM refs ───
        const sampleInput  = document.getElementById('sample-input');
        const runBtn       = document.getElementById('run-btn');
        const errorPanel   = document.getElementById('error-panel');
        const errorMsg     = document.getElementById('error-msg');
        const errorLine    = document.getElementById('error-line');
        const btnFirst     = document.getElementById('btn-first');
        const btnPrev      = document.getElementById('btn-prev');
        const btnPlay      = document.getElementById('btn-play');
        const btnNext      = document.getElementById('btn-next');
        const btnReset     = document.getElementById('btn-reset');
        const speedSelect  = document.getElementById('speed-select');
        const stepCounter  = document.getElementById('step-counter');
        const lineCounter  = document.getElementById('line-counter');
        const stepDesc     = document.getElementById('step-desc');
        const varTbody     = document.getElementById('var-tbody');
        const varEmpty     = document.getElementById('var-empty');
        const varCount     = document.getElementById('var-count');
        const outputArea   = document.getElementById('output-area');
        const dsCards      = document.getElementById('ds-cards');
        const historyList  = document.getElementById('history-list');
        const callstackPanel = document.getElementById('callstack-panel');
        const callstackPath  = document.getElementById('callstack-path');

        // ─── Section toggles ───
        document.querySelectorAll('.section-head[data-toggle]').forEach(function(head) {
            head.addEventListener('click', function() {
                var sec = document.getElementById(head.getAttribute('data-toggle'));
                if (sec) sec.classList.toggle('collapsed');
            });
        });

        // ─── Init ───
        vscode.postMessage({ command: 'ready' });

        // ─── Events ───
        runBtn.addEventListener('click', function() {
            document.getElementById('input-section').classList.add('collapsed');
            errorPanel.style.display = 'none';
            vscode.postMessage({ command: 'requestRun', input: sampleInput.value });
        });

        btnFirst.addEventListener('click', function() { goToStep(0); });
        btnPrev.addEventListener('click', function() { goToStep(currentStepIndex - 1); });
        btnNext.addEventListener('click', function() { goToStep(currentStepIndex + 1); });
        btnPlay.addEventListener('click', togglePlay);
        btnReset.addEventListener('click', function() {
            stopPlay();
            steps = [];
            currentStepIndex = -1;
            declaredVariables.clear();
            varTbody.innerHTML = '';
            varEmpty.style.display = '';
            varCount.textContent = '';
            outputArea.textContent = '';
            dsCards.innerHTML = '';
            document.getElementById('nodes').innerHTML = '';
            document.getElementById('edges').innerHTML = '';
            historyList.innerHTML = '<div style="opacity:0.4;font-style:italic;text-align:center;padding:20px 8px">Run code to see execution history</div>';
            stepCounter.textContent = '';
            stepDesc.innerHTML = '';
        });

        speedSelect.addEventListener('change', function(e) {
            speedMs = parseInt(e.target.value);
            if (playing) { stopPlay(); startPlay(); }
        });

        document.addEventListener('keydown', function(e) {
            if (document.activeElement.tagName === 'TEXTAREA') return;
            if (e.key === 'ArrowLeft') goToStep(currentStepIndex - 1);
            else if (e.key === 'ArrowRight') goToStep(currentStepIndex + 1);
            else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
            else if (e.key === 'Home') goToStep(0);
            else if (e.key === 'End') goToStep(steps.length - 1);
        });

        window.addEventListener('message', function(event) {
            var msg = event.data;
            switch (msg.command) {
                case 'loadSteps':
                    steps = msg.steps || [];
                    declaredVariables.clear();
                    goToStep(0);
                    break;
                case 'error':
                    showError(msg.message, msg.line);
                    break;
                case 'goToStep':
                    goToStep(msg.step);
                    break;
            }
        });

        // ─── Playback ───
        function togglePlay() { playing ? stopPlay() : startPlay(); }

        function startPlay() {
            if (steps.length === 0 || currentStepIndex >= steps.length - 1) return;
            playing = true;
            btnPlay.textContent = '⏸ Pause';
            playInterval = setInterval(function() {
                if (currentStepIndex < steps.length - 1) goToStep(currentStepIndex + 1, false);
                else stopPlay();
            }, speedMs);
        }

        function stopPlay() {
            playing = false;
            btnPlay.textContent = '▶ Play';
            if (playInterval) clearInterval(playInterval);
        }

        // ─── Go to step ───
        function goToStep(index, notifyExtension) {
            if (notifyExtension === undefined) notifyExtension = true;
            if (!steps.length || index < 0 || index >= steps.length) return;

            var prevStep = currentStepIndex >= 0 ? steps[currentStepIndex] : null;
            currentStepIndex = index;
            var state = steps[index];

            stepCounter.textContent = 'Step ' + (index + 1) + '/' + steps.length;
            lineCounter.textContent = state.line;

            var badge = '<span class="action-badge">' + (state.action || 'STEP').toUpperCase() + '</span>';
            stepDesc.innerHTML = badge + (state.description || '');

            if (state.callStack && state.callStack.length > 1) {
                callstackPanel.classList.remove('hidden');
                callstackPath.innerHTML = state.callStack.map(function(f) { return '<span style="margin:0 4px">' + f + '</span>'; }).join(' → ');
            } else {
                callstackPanel.classList.add('hidden');
            }

            outputArea.textContent = state.output || '';
            renderVariables(state, prevStep);
            renderHistory();

            if (notifyExtension) {
                vscode.postMessage({ command: 'stepChanged', line: state.line, stepIndex: index });
            }
        }

        // ─── Render history ───
        function renderHistory() {
            historyList.innerHTML = '';
            for (var i = 0; i <= currentStepIndex; i++) {
                var s = steps[i];
                var div = document.createElement('div');
                div.className = 'hist-item' + (i === currentStepIndex ? ' active' : '');
                var lineSpan = document.createElement('span');
                lineSpan.className = 'hist-line';
                lineSpan.textContent = s.line || '-';
                var descSpan = document.createElement('span');
                descSpan.className = 'hist-desc';
                descSpan.textContent = s.description || '';
                div.appendChild(lineSpan);
                div.appendChild(descSpan);
                (function(idx) { div.onclick = function() { goToStep(idx); }; })(i);
                historyList.appendChild(div);
            }
            historyList.scrollTop = historyList.scrollHeight;
        }

        // ─── Render variables table + data structures ───
        function renderVariables(state, prevStep) {
            var visualizer = new Visualizer();
            var vars = state.variables || {};
            var prevVars = prevStep ? (prevStep.variables || {}) : {};

            Object.keys(vars).forEach(function(v) { declaredVariables.add(v); });

            var activeCount = 0;
            var tbodyHtml = '';
            var cardsHtml = '';

            var sortedVars = Array.from(declaredVariables).sort();

            sortedVars.forEach(function(name) {
                var isActive = name in vars;
                var v = isActive ? vars[name] : (prevStep && prevStep.variables && prevStep.variables[name] ? prevStep.variables[name] : null);
                if (!v) return;
                v = Object.assign({}, v); // shallow copy

                // Auto-detect types from type string
                if (v.type) {
                    var ts = v.type.toLowerCase();
                    if (!v.isMap && (ts.indexOf('map') >= 0 || ts.indexOf('dict') >= 0)) v.isMap = true;
                    if (!v.isSet && ts.indexOf('set') >= 0) v.isSet = true;
                    if (!v.isStack && ts.indexOf('stack') >= 0) v.isStack = true;
                    if (!v.isQueue && (ts.indexOf('queue') >= 0 || ts.indexOf('deque') >= 0)) v.isQueue = true;
                }

                if (isActive) activeCount++;

                var isHL = (state.highlightVar === name);
                var hlIdx = state.highlightIndex;
                var prevVal = prevVars[name];
                var changed = isActive && prevVal && didValueChange(prevVal.value, v.value);

                // Table row
                var trCls = '';
                if (!isActive) trCls = ' class="oos"';
                else if (isHL) trCls = ' class="hl"';

                var displayVal = '';
                var isComplex = false;

                if (v.isGraphNode) {
                    visualizer.traverse(v.value);
                    visualizer.addPointer(v.value.__id__, name);
                    displayVal = '→ ' + (v.type || 'Node');
                } else if (v.isMap) {
                    var mapLen = Object.keys(v.value || {}).length;
                    displayVal = 'size = ' + mapLen;
                    isComplex = true;
                    cardsHtml += buildMapCard(name, v, isHL, hlIdx);
                } else if (v.isSet) {
                    displayVal = 'size = ' + ((v.value || []).length);
                    isComplex = true;
                    cardsHtml += buildSetCard(name, v, isHL);
                } else if (v.isStack) {
                    displayVal = 'size = ' + ((v.value || []).length);
                    isComplex = true;
                    cardsHtml += buildStackCard(name, v, isHL);
                } else if (v.isQueue) {
                    displayVal = 'size = ' + ((v.value || []).length);
                    isComplex = true;
                    cardsHtml += buildQueueCard(name, v, isHL);
                } else if (v.isArray) {
                    var len = Array.isArray(v.value) ? v.value.length : (v.size || 0);
                    displayVal = 'size = ' + len;
                    isComplex = true;
                    cardsHtml += buildArrayCard(name, v, isHL, hlIdx);
                } else {
                    var raw = v.value;
                    displayVal = (raw === undefined || raw === null) ? '?' : String(raw);
                    // Also show scalar in viz pane
                    cardsHtml += '<div class="ds-card"><div class="ds-card-head"><span class="ds-name">' + name + '</span><span class="ds-type">' + (v.type || 'auto') + '</span></div><div class="scalar-val">' + esc(displayVal) + '</div></div>';
                }

                var changedCls = changed ? ' changed' : '';

                tbodyHtml += '<tr' + trCls + '>'
                    + '<td class="vn' + changedCls + '">' + esc(name) + '</td>'
                    + '<td class="vt">' + esc(v.type || 'auto') + '</td>'
                    + '<td class="vv">' + esc(displayVal) + '</td>'
                    + '</tr>';
            });

            if (activeCount > 0) {
                varEmpty.style.display = 'none';
                varCount.textContent = '(' + activeCount + ')';
            } else {
                varEmpty.style.display = '';
                varCount.textContent = '';
            }
            varTbody.innerHTML = tbodyHtml;
            dsCards.innerHTML = cardsHtml;
            visualizer.render();
        }

        // ─── Card builders ───
        function buildArrayCard(name, v, isHL, hlIdx) {
            var elems = [];
            if (Array.isArray(v.value)) elems = v.value;
            else if (typeof v.value === 'object' && v.value !== null) {
                var mx = v.size ? v.size : Math.max(-1, ...Object.keys(v.value).map(Number)) + 1;
                for (var i = 0; i < mx; i++) elems.push(v.value[i]);
            } else {
                elems = new Array(v.size || 0).fill('?');
            }

            // 2D check
            var is2D = elems.length > 0 && Array.isArray(elems[0]);
            if (is2D) {
                var h = '<div class="ds-card"><div class="ds-card-head"><span class="ds-name">' + esc(name) + '</span><span class="ds-type">' + esc(v.type || '') + '</span><span class="ds-size">size = ' + elems.length + 'x' + (elems[0] ? elems[0].length : '?') + '</span></div>';
                h += '<table class="grid-2d"><tr><th></th>';
                for (var j = 0; j < (elems[0] ? elems[0].length : 0); j++) h += '<th>' + j + '</th>';
                h += '</tr>';
                for (var r = 0; r < elems.length; r++) {
                    h += '<tr><th>' + r + '</th>';
                    var row = Array.isArray(elems[r]) ? elems[r] : (typeof elems[r] === 'object' && elems[r] !== null ? Object.values(elems[r]) : [elems[r]]);
                    for (var c = 0; c < row.length; c++) {
                        var cellHL = (isHL && hlIdx === r + ',' + c) ? ' cell-hl' : '';
                        h += '<td class="' + cellHL + '">' + esc(row[c] === undefined || row[c] === null ? '?' : row[c]) + '</td>';
                    }
                    h += '</tr>';
                }
                h += '</table></div>';
                return h;
            }

            // 1D
            var h = '<div class="ds-card"><div class="ds-card-head"><span class="ds-name">' + esc(name) + '</span><span class="ds-type">' + esc(v.type || '') + '</span><span class="ds-size">size = ' + elems.length + '</span></div>';
            h += '<div class="arr-idx-row">';
            for (var i = 0; i < elems.length; i++) h += '<div class="arr-idx">' + i + '</div>';
            h += '</div><div class="arr-row">';
            for (var i = 0; i < elems.length; i++) {
                var val = elems[i];
                var cls = 'arr-cell';
                if (val === undefined || val === null) cls += ' empty';
                if (isHL && hlIdx === i) cls += ' cell-hl';
                h += '<div class="' + cls + '">' + esc(val === undefined || val === null ? '' : val) + '</div>';
            }
            h += '</div></div>';
            return h;
        }

        function buildMapCard(name, v, isHL, hlIdx) {
            if (!v.value || typeof v.value !== 'object') return '';
            var h = '<div class="ds-card"><div class="ds-card-head"><span class="ds-name">' + esc(name) + '</span><span class="ds-type">' + esc(v.type || '') + '</span></div>';
            h += '<table class="map-tbl"><tr><th>Key</th><th>Value</th></tr>';
            var entries = Object.entries(v.value);
            for (var i = 0; i < entries.length; i++) {
                h += '<tr><td>' + esc(entries[i][0]) + '</td><td style="color:var(--val-c)">' + esc(entries[i][1]) + '</td></tr>';
            }
            h += '</table></div>';
            return h;
        }

        function buildSetCard(name, v, isHL) {
            var arr = Array.isArray(v.value) ? v.value : [];
            var h = '<div class="ds-card"><div class="ds-card-head"><span class="ds-name">' + esc(name) + '</span><span class="ds-type">' + esc(v.type || '') + '</span></div>';
            if (arr.length === 0) { h += '<div style="opacity:0.4;font-style:italic">∅ empty set</div>'; }
            else {
                h += '<div class="set-row">';
                for (var i = 0; i < arr.length; i++) h += '<span class="set-badge">' + esc(arr[i]) + '</span>';
                h += '</div>';
            }
            h += '</div>';
            return h;
        }

        function buildStackCard(name, v, isHL) {
            var arr = Array.isArray(v.value) ? v.value : [];
            var h = '<div class="ds-card"><div class="ds-card-head"><span class="ds-name">' + esc(name) + '</span><span class="ds-type">' + esc(v.type || '') + '</span></div>';
            if (arr.length === 0) { h += '<div style="opacity:0.4;font-style:italic">empty</div>'; }
            else {
                h += '<div class="stack-col">';
                for (var i = arr.length - 1; i >= 0; i--) {
                    if (i === arr.length - 1) {
                        h += '<div class="stack-top"><div class="stack-cell">' + esc(arr[i]) + '</div><span class="top-lbl">← top</span></div>';
                    } else {
                        h += '<div class="stack-cell">' + esc(arr[i]) + '</div>';
                    }
                }
                h += '</div>';
            }
            h += '</div>';
            return h;
        }

        function buildQueueCard(name, v, isHL) {
            var arr = Array.isArray(v.value) ? v.value : [];
            var h = '<div class="ds-card"><div class="ds-card-head"><span class="ds-name">' + esc(name) + '</span><span class="ds-type">' + esc(v.type || '') + '</span></div>';
            if (arr.length === 0) { h += '<div style="opacity:0.4;font-style:italic">empty</div>'; }
            else {
                h += '<div class="queue-row"><span class="queue-lbl">front →</span>';
                for (var i = 0; i < arr.length; i++) h += '<div class="queue-cell">' + esc(arr[i]) + '</div>';
                h += '<span class="queue-lbl">← back</span></div>';
            }
            h += '</div>';
            return h;
        }

        // ─── Helpers ───
        function esc(val) {
            if (val === undefined || val === null) return '?';
            return String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        function didValueChange(prev, curr) {
            if (prev === undefined || prev === null) return curr !== undefined && curr !== null;
            if (typeof prev !== typeof curr) return true;
            if (Array.isArray(prev) && Array.isArray(curr)) {
                if (prev.length !== curr.length) return true;
                return prev.some(function(v, i) { return v !== curr[i]; });
            }
            if (typeof prev === 'object' && typeof curr === 'object') {
                return JSON.stringify(prev) !== JSON.stringify(curr);
            }
            return prev !== curr;
        }

        function showError(msg, line) {
            stopPlay();
            errorPanel.style.display = 'block';
            errorMsg.textContent = msg;
            errorLine.textContent = line ? 'At line ' + line : 'Check your code and try again.';
        }
    </script>
</body>
</html>`;
}

module.exports = { getWebviewContent };
