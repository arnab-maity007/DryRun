// src/webview.js
// Generates the HTML content for the DryRun Visualizer webview panel.
//
// The webview communicates with the extension via postMessage:
//   Extension → Webview:  { command: 'loadSteps', steps: ExecutionState[] }
//   Extension → Webview:  { command: 'loadCode', code: string }
//   Webview → Extension:   { command: 'ready' }
//   Webview → Extension:   { command: 'requestRun', input: string }

function getWebviewContent() {
    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DryRun Visualizer</title>
    <style>
        /* ── Reset & Base ── */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 16px;
            overflow-x: hidden;
        }

        /* ── Header ── */
        .header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--vscode-panel-border, #333);
        }
        .header h1 {
            font-size: 18px;
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        .header .logo {
            font-size: 22px;
        }

        /* ── Input Panel ── */
        .input-panel {
            background: var(--vscode-input-background, #1e1e1e);
            border: 1px solid var(--vscode-input-border, #3c3c3c);
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 16px;
        }
        .input-panel label {
            font-size: 12px;
            font-weight: 600;
            color: var(--vscode-descriptionForeground, #888);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .input-panel textarea {
            width: 100%;
            min-height: 50px;
            margin-top: 6px;
            padding: 8px;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            border: 1px solid var(--vscode-input-border, #3c3c3c);
            border-radius: 4px;
            font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
            font-size: 13px;
            resize: vertical;
        }
        .input-panel textarea:focus {
            outline: none;
            border-color: var(--vscode-focusBorder, #007acc);
        }
        .run-btn {
            margin-top: 8px;
            padding: 6px 16px;
            background: var(--vscode-button-background, #007acc);
            color: var(--vscode-button-foreground, #fff);
            border: none;
            border-radius: 4px;
            font-size: 13px;
            cursor: pointer;
            font-weight: 500;
        }
        .run-btn:hover {
            background: var(--vscode-button-hoverBackground, #005a9e);
        }

        /* ── Controls ── */
        .controls {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 16px;
            flex-wrap: wrap;
        }
        .ctrl-btn {
            padding: 5px 12px;
            background: var(--vscode-button-secondaryBackground, #3a3d41);
            color: var(--vscode-button-secondaryForeground, #ccc);
            border: none;
            border-radius: 4px;
            font-size: 13px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .ctrl-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground, #505050);
        }
        .ctrl-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }
        .step-info {
            font-size: 12px;
            color: var(--vscode-descriptionForeground, #888);
            margin-left: auto;
        }
        .speed-control {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground, #888);
        }
        .speed-control input[type="range"] {
            width: 80px;
            accent-color: var(--vscode-focusBorder, #007acc);
        }

        /* ── Layout: two columns ── */
        .main-layout {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }

        /* ── Code Panel ── */
        .code-panel {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border, #333);
            border-radius: 6px;
            overflow: hidden;
        }
        .code-panel .panel-title {
            padding: 8px 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--vscode-descriptionForeground, #888);
            background: var(--vscode-sideBar-background, #252526);
            border-bottom: 1px solid var(--vscode-panel-border, #333);
        }
        .code-lines {
            padding: 8px 0;
            font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
            font-size: 13px;
            line-height: 1.6;
            overflow-y: auto;
            max-height: 400px;
        }
        .code-line {
            display: flex;
            padding: 1px 12px 1px 0;
            transition: background-color 0.2s;
        }
        .code-line.active {
            background: rgba(0, 122, 204, 0.15);
            border-left: 3px solid var(--vscode-focusBorder, #007acc);
        }
        .code-line.executed {
            border-left: 3px solid rgba(0, 122, 204, 0.05);
        }
        .code-line:not(.active):not(.executed) {
            border-left: 3px solid transparent;
        }
        .line-num {
            display: inline-block;
            width: 40px;
            text-align: right;
            padding-right: 12px;
            color: var(--vscode-editorLineNumber-foreground, #555);
            user-select: none;
            flex-shrink: 0;
        }
        .line-content {
            white-space: pre;
            flex: 1;
        }

        /* ── Memory Canvas ── */
        .memory-panel {
            border: 1px solid var(--vscode-panel-border, #333);
            border-radius: 6px;
            overflow: hidden;
        }
        .memory-panel .panel-title {
            padding: 8px 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--vscode-descriptionForeground, #888);
            background: var(--vscode-sideBar-background, #252526);
            border-bottom: 1px solid var(--vscode-panel-border, #333);
        }
        .memory-canvas {
            padding: 16px;
            min-height: 200px;
            overflow-y: auto;
            max-height: 400px;
        }

        /* ── Variable Box ── */
        .var-container {
            margin-bottom: 14px;
            animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .var-label {
            font-size: 11px;
            font-weight: 600;
            color: var(--vscode-descriptionForeground, #888);
            margin-bottom: 4px;
            font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
        }
        .var-type {
            color: #4ec9b0;
            margin-right: 4px;
        }
        .var-name {
            color: #9cdcfe;
        }

        /* Single value box */
        .scalar-box {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 50px;
            height: 40px;
            padding: 0 14px;
            border: 2px solid #007acc;
            border-radius: 6px;
            font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
            font-size: 16px;
            font-weight: 600;
            color: var(--vscode-editor-foreground);
            background: rgba(0, 122, 204, 0.08);
            transition: all 0.3s ease;
        }
        .scalar-box.highlight {
            border-color: #f0c674;
            background: rgba(240, 198, 116, 0.15);
            box-shadow: 0 0 8px rgba(240, 198, 116, 0.3);
        }

        /* Array visualization */
        .array-container {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .array-indices {
            display: flex;
            gap: 0;
        }
        .array-index {
            width: 44px;
            text-align: center;
            font-size: 10px;
            color: var(--vscode-descriptionForeground, #888);
            font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
        }
        .array-cells {
            display: flex;
            gap: 0;
        }
        .array-cell {
            width: 44px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #007acc;
            border-right: 1px solid #007acc;
            font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
            font-size: 14px;
            font-weight: 600;
            color: var(--vscode-editor-foreground);
            background: rgba(0, 122, 204, 0.08);
            transition: all 0.3s ease;
        }
        .array-cell:first-child {
            border-radius: 6px 0 0 6px;
        }
        .array-cell:last-child {
            border-right: 2px solid #007acc;
            border-radius: 0 6px 6px 0;
        }
        .array-cell.highlight {
            border-color: #f0c674;
            background: rgba(240, 198, 116, 0.15);
            box-shadow: 0 0 8px rgba(240, 198, 116, 0.3);
            z-index: 1;
        }

        /* ── Description Banner ── */
        .description-banner {
            margin-bottom: 16px;
            padding: 10px 14px;
            background: var(--vscode-sideBar-background, #252526);
            border-left: 3px solid var(--vscode-focusBorder, #007acc);
            border-radius: 0 6px 6px 0;
            font-size: 13px;
            color: var(--vscode-foreground);
            min-height: 20px;
        }
        .description-banner .action-badge {
            display: inline-block;
            padding: 1px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin-right: 8px;
        }
        .action-badge.declare { background: #264f78; color: #9cdcfe; }
        .action-badge.assign { background: #4d3800; color: #f0c674; }
        .action-badge.input { background: #1e4620; color: #6a9955; }
        .action-badge.output { background: #4b1e4e; color: #c586c0; }
        .action-badge.loop-check,
        .action-badge.loop-start,
        .action-badge.loop-update { background: #3b2e00; color: #dcdcaa; }
        .action-badge.condition-true { background: #1e4620; color: #6a9955; }
        .action-badge.condition-false { background: #4b1e1e; color: #f44747; }
        .action-badge.skip { background: #333; color: #888; }
        .action-badge.return { background: #264f78; color: #9cdcfe; }

        /* ── Output Panel ── */
        .output-panel {
            margin-top: 16px;
            border: 1px solid var(--vscode-panel-border, #333);
            border-radius: 6px;
            overflow: hidden;
        }
        .output-panel .panel-title {
            padding: 8px 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--vscode-descriptionForeground, #888);
            background: var(--vscode-sideBar-background, #252526);
            border-bottom: 1px solid var(--vscode-panel-border, #333);
        }
        .output-content {
            padding: 10px 12px;
            font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
            font-size: 13px;
            white-space: pre-wrap;
            min-height: 30px;
            color: #6a9955;
        }

        /* ── Empty State ── */
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: var(--vscode-descriptionForeground, #888);
        }
        .empty-state .icon { font-size: 48px; margin-bottom: 12px; }
        .empty-state p { font-size: 14px; }
    </style>
</head>
<body>
    <div class="header">
        <span class="logo">🔬</span>
        <h1>DryRun Visualizer</h1>
    </div>

    <!-- Input Panel -->
    <div class="input-panel">
        <label>📥 Sample Input (stdin)</label>
        <textarea id="inputArea" placeholder="Enter test input here, e.g.&#10;5&#10;1 2 3 4 5"></textarea>
        <button class="run-btn" id="runBtn" onclick="requestRun()">▶ Run Visualization</button>
    </div>

    <!-- Step Controls -->
    <div class="controls" id="controls" style="display:none;">
        <button class="ctrl-btn" id="resetBtn" onclick="goToStep(0)">⏮ Reset</button>
        <button class="ctrl-btn" id="prevBtn" onclick="prevStep()">◀ Prev</button>
        <button class="ctrl-btn" id="nextBtn" onclick="nextStep()">Next ▶</button>
        <button class="ctrl-btn" id="playBtn" onclick="toggleAutoPlay()">⏵ Play</button>
        <div class="speed-control">
            <span>Speed:</span>
            <input type="range" id="speedSlider" min="1" max="10" value="5">
        </div>
        <span class="step-info" id="stepInfo">Step 0 / 0</span>
    </div>

    <!-- Description Banner -->
    <div class="description-banner" id="descBanner" style="display:none;">
        <span class="action-badge" id="actionBadge"></span>
        <span id="descText"></span>
    </div>

    <!-- Main Layout -->
    <div class="main-layout" id="mainLayout" style="display:none;">
        <div class="code-panel">
            <div class="panel-title">📄 Source Code</div>
            <div class="code-lines" id="codeLines"></div>
        </div>
        <div class="memory-panel">
            <div class="panel-title">🧠 Memory State</div>
            <div class="memory-canvas" id="memoryCanvas"></div>
        </div>
    </div>

    <!-- Output Panel -->
    <div class="output-panel" id="outputPanel" style="display:none;">
        <div class="panel-title">📤 Program Output (stdout)</div>
        <div class="output-content" id="outputContent"></div>
    </div>

    <!-- Empty State -->
    <div class="empty-state" id="emptyState">
        <div class="icon">🧪</div>
        <p>Enter sample input above and click <strong>Run Visualization</strong><br>
        to step through your code.</p>
    </div>

    <script>
        // ── State ──
        const vscode = acquireVsCodeApi();
        let steps = [];
        let codeLines = [];
        let currentStep = -1;
        let autoPlayInterval = null;
        let executedLines = new Set();

        // ── Communication with Extension ──
        window.addEventListener('message', event => {
            const msg = event.data;
            switch (msg.command) {
                case 'loadSteps':
                    steps = msg.steps;
                    executedLines = new Set();
                    if (steps.length > 0) {
                        showControls();
                        goToStep(0);
                    }
                    break;
                case 'loadCode':
                    codeLines = msg.code.split('\\n');
                    renderCodeLines();
                    break;
                case 'error':
                    showError(msg.message);
                    break;
            }
        });

        function requestRun() {
            const input = document.getElementById('inputArea').value;
            vscode.postMessage({ command: 'requestRun', input: input });
        }

        // ── Controls ──
        function showControls() {
            document.getElementById('controls').style.display = 'flex';
            document.getElementById('descBanner').style.display = 'block';
            document.getElementById('mainLayout').style.display = 'grid';
            document.getElementById('outputPanel').style.display = 'block';
            document.getElementById('emptyState').style.display = 'none';
        }

        function goToStep(index) {
            if (index < 0 || index >= steps.length) return;
            currentStep = index;

            const step = steps[currentStep];

            // Track executed lines
            if (step.line) executedLines.add(step.line);

            // Update step info
            document.getElementById('stepInfo').textContent =
                'Step ' + (currentStep + 1) + ' / ' + steps.length;

            // Update description banner
            const badge = document.getElementById('actionBadge');
            badge.textContent = step.action;
            badge.className = 'action-badge ' + step.action;
            document.getElementById('descText').textContent = step.description;

            // Update button states
            document.getElementById('prevBtn').disabled = currentStep === 0;
            document.getElementById('nextBtn').disabled = currentStep === steps.length - 1;

            // Highlight current code line
            highlightCodeLine(step.line);

            // Render memory state
            renderMemory(step);

            // Render output
            document.getElementById('outputContent').textContent = step.output || '';
        }

        function nextStep() {
            goToStep(currentStep + 1);
        }

        function prevStep() {
            // Recompute executed lines up to previous step
            if (currentStep > 0) {
                executedLines = new Set();
                for (let i = 0; i < currentStep; i++) {
                    if (steps[i].line) executedLines.add(steps[i].line);
                }
            }
            goToStep(currentStep - 1);
        }

        function toggleAutoPlay() {
            const btn = document.getElementById('playBtn');
            if (autoPlayInterval) {
                clearInterval(autoPlayInterval);
                autoPlayInterval = null;
                btn.textContent = '⏵ Play';
            } else {
                btn.textContent = '⏸ Pause';
                const speed = document.getElementById('speedSlider').value;
                const delay = 1100 - (speed * 100); // 1000ms at speed 1, 100ms at speed 10
                autoPlayInterval = setInterval(() => {
                    if (currentStep < steps.length - 1) {
                        nextStep();
                    } else {
                        clearInterval(autoPlayInterval);
                        autoPlayInterval = null;
                        btn.textContent = '⏵ Play';
                    }
                }, delay);
            }
        }

        // ── Code Rendering ──
        function renderCodeLines() {
            const container = document.getElementById('codeLines');
            container.innerHTML = codeLines.map((line, i) => {
                const lineNum = i + 1;
                const escapedLine = escapeHtml(line);
                return '<div class="code-line" id="code-line-' + lineNum + '">' +
                    '<span class="line-num">' + lineNum + '</span>' +
                    '<span class="line-content">' + escapedLine + '</span>' +
                    '</div>';
            }).join('');
        }

        function highlightCodeLine(lineNum) {
            // Remove all active highlights
            document.querySelectorAll('.code-line.active').forEach(el => {
                el.classList.remove('active');
            });
            // Mark executed lines
            document.querySelectorAll('.code-line').forEach(el => {
                el.classList.remove('executed');
            });
            executedLines.forEach(ln => {
                const el = document.getElementById('code-line-' + ln);
                if (el) el.classList.add('executed');
            });
            // Highlight current line
            if (lineNum) {
                const el = document.getElementById('code-line-' + lineNum);
                if (el) {
                    el.classList.add('active');
                    el.classList.remove('executed');
                    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            }
        }

        // ── Memory Rendering ──
        function renderMemory(step) {
            const canvas = document.getElementById('memoryCanvas');
            const vars = step.variables || {};
            const varNames = Object.keys(vars);

            if (varNames.length === 0) {
                canvas.innerHTML = '<div style="color:#888; font-style:italic;">No variables yet</div>';
                return;
            }

            let html = '';
            for (const name of varNames) {
                const v = vars[name];
                const isHighlighted = step.highlightVar === name;

                html += '<div class="var-container">';
                html += '<div class="var-label">' +
                    '<span class="var-type">' + escapeHtml(v.type) + '</span> ' +
                    '<span class="var-name">' + escapeHtml(name) + '</span>' +
                    '</div>';

                if (v.isArray && Array.isArray(v.value)) {
                    // Array/Vector visualization
                    html += '<div class="array-container">';

                    // Index row
                    html += '<div class="array-indices">';
                    for (let i = 0; i < v.value.length; i++) {
                        html += '<div class="array-index">' + i + '</div>';
                    }
                    html += '</div>';

                    // Cell row
                    html += '<div class="array-cells">';
                    for (let i = 0; i < v.value.length; i++) {
                        const cellHighlight = isHighlighted && step.highlightIndex === i;
                        html += '<div class="array-cell' + (cellHighlight ? ' highlight' : '') + '">' +
                            formatValue(v.value[i]) + '</div>';
                    }
                    html += '</div>';

                    html += '</div>';
                } else {
                    // Scalar visualization
                    html += '<div class="scalar-box' + (isHighlighted ? ' highlight' : '') + '">' +
                        formatValue(v.value) + '</div>';
                }

                html += '</div>';
            }

            canvas.innerHTML = html;
        }

        // ── Helpers ──
        function formatValue(val) {
            if (val === null || val === undefined) return '?';
            if (typeof val === 'string') {
                if (val.length === 0) return '""';
                if (val.length === 1) return "'" + escapeHtml(val) + "'";
                return '"' + escapeHtml(val) + '"';
            }
            return String(val);
        }

        function escapeHtml(str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        function showError(message) {
            document.getElementById('emptyState').innerHTML =
                '<div class="icon">⚠️</div>' +
                '<p style="color: #f44747;">' + escapeHtml(message) + '</p>' +
                '<p style="margin-top: 8px;">Check your code and try again.</p>';
            document.getElementById('emptyState').style.display = 'block';
            document.getElementById('controls').style.display = 'none';
            document.getElementById('descBanner').style.display = 'none';
            document.getElementById('mainLayout').style.display = 'none';
            document.getElementById('outputPanel').style.display = 'none';
        }

        // Notify extension that webview is ready
        vscode.postMessage({ command: 'ready' });
    </script>
</body>
</html>`;
}

module.exports = { getWebviewContent };

