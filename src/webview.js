function getWebviewContent() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DryRun Visualizer</title>
    <style>
        :root {
            --bg-color: var(--vscode-editor-background);
            --fg-color: var(--vscode-editor-foreground);
            --border-color: var(--vscode-panel-border);
            --input-bg: var(--vscode-input-background);
            --input-fg: var(--vscode-input-foreground);
            --button-bg: var(--vscode-button-background);
            --button-fg: var(--vscode-button-foreground);
            --button-hover: var(--vscode-button-hoverBackground);
            --card-bg: var(--vscode-editorWidget-background);
            --card-border: var(--vscode-widget-border);
            --type-color: var(--vscode-textPreformat-foreground, #6a9955);
            --name-color: var(--vscode-symbolIcon-variableForeground, #4fc1ff);
            --value-color: var(--vscode-textBlockQuote-foreground, #ce9178);
            --highlight-glow: var(--vscode-editor-selectionBackground);
            --error-bg: var(--vscode-inputValidation-errorBackground);
            --error-border: var(--vscode-inputValidation-errorBorder);
            --font-mono: var(--vscode-editor-font-family, "Consolas", "Courier New", monospace);
            --radius: 6px;
        }

        body {
            font-family: var(--vscode-font-family, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif);
            background-color: var(--bg-color);
            color: var(--fg-color);
            padding: 16px;
            margin: 0;
            display: flex;
            flex-direction: column;
            height: 100vh;
            box-sizing: border-box;
            overflow-y: auto;
        }

        .header {
            font-size: 1.2em;
            font-weight: 600;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .section {
            border: 1px solid var(--border-color);
            border-radius: var(--radius);
            padding: 12px;
            margin-bottom: 12px;
            background: var(--card-bg);
        }

        /* Input Panel */
        #input-panel {
            transition: all 0.3s ease;
        }
        #input-panel.collapsed #input-area {
            display: none;
        }
        #input-area {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 8px;
        }
        textarea {
            background-color: var(--input-bg);
            color: var(--input-fg);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: 8px;
            font-family: var(--font-mono);
            min-height: 60px;
            resize: vertical;
        }
        button {
            background-color: var(--button-bg);
            color: var(--button-fg);
            border: none;
            border-radius: 4px;
            padding: 6px 12px;
            cursor: pointer;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            transition: background-color 0.2s;
        }
        button:hover {
            background-color: var(--button-hover);
        }
        .header-btn {
            background: transparent;
            color: var(--fg-color);
            border: 1px solid var(--border-color);
            font-size: 0.9em;
            padding: 4px 8px;
        }
        .header-btn:hover {
            background: var(--button-hover);
        }

        /* Error Panel */
        #error-panel {
            display: none;
            background-color: var(--error-bg);
            border: 1px solid var(--error-border);
            color: var(--fg-color);
        }
        .error-header {
            font-weight: bold;
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
        }

        /* Controls */
        #controls-panel {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        }
        .control-group {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        input[type="range"] {
            width: 100px;
        }
        .status-text {
            font-family: var(--font-mono);
            font-size: 0.9em;
            margin-left: auto;
            color: var(--type-color);
        }

        /* Step Info */
        #step-info {
            font-family: var(--font-mono);
            background: var(--input-bg);
            border-left: 4px solid var(--name-color);
        }

        /* Memory Panel */
        #memory-panel {
            flex-grow: 1;
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            align-items: flex-start;
            align-content: flex-start;
            overflow-y: auto;
        }
        .var-card {
            background-color: var(--bg-color);
            border: 1px solid var(--card-border);
            border-radius: var(--radius);
            padding: 8px;
            min-width: 100px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .var-card.out-of-scope {
            opacity: 0.5;
            filter: grayscale(100%);
        }
        .var-header {
            display: flex;
            justify-content: space-between;
            font-size: 0.85em;
            margin-bottom: 6px;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 4px;
        }
        .var-type {
            color: var(--type-color);
            font-family: var(--font-mono);
        }
        .var-name {
            color: var(--name-color);
            font-weight: bold;
            font-family: var(--font-mono);
        }
        
        /* Scalars */
        .var-value-scalar {
            font-family: var(--font-mono);
            font-size: 1.5em;
            text-align: center;
            color: var(--value-color);
            padding: 4px;
        }
        
        /* Arrays */
        .var-value-array {
            display: flex;
            gap: 4px;
            overflow-x: auto;
            padding-bottom: 4px;
        }
        .array-cell-container {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .array-cell {
            border: 1px solid var(--border-color);
            min-width: 44px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: var(--font-mono);
            color: var(--value-color);
            background: var(--input-bg);
            border-radius: 4px;
        }
        .array-index {
            font-size: 0.7em;
            color: var(--type-color);
            margin-top: 2px;
        }

        /* Map Table */
        .map-table {
            border-collapse: collapse;
            width: 100%;
            margin-top: 4px;
            font-family: var(--font-mono);
            font-size: 0.9em;
        }
        .map-table th, .map-table td {
            border: 1px solid var(--border-color);
            padding: 4px 8px;
            text-align: center;
        }
        .map-table th {
            background-color: var(--input-bg);
            color: var(--type-color);
        }
        .map-table tr:nth-child(even) {
            background-color: rgba(0, 0, 0, 0.05);
        }
        
        /* Set Badges */
        .set-container {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            padding: 4px 0;
            align-items: center;
        }
        .set-badge {
            background-color: var(--input-bg);
            color: var(--value-color);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 2px 8px;
            font-family: var(--font-mono);
            font-size: 0.9em;
        }

        /* Stack */
        .stack-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
            margin-top: 4px;
        }
        .stack-cell-wrapper {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .stack-cell {
            border: 1px solid var(--name-color);
            min-width: 44px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: var(--font-mono);
            color: var(--value-color);
            background: var(--input-bg);
            border-radius: 2px;
        }
        .stack-top-label {
            font-size: 0.8em;
            color: var(--type-color);
            font-family: var(--font-mono);
        }

        /* Queue */
        .queue-container {
            display: flex;
            align-items: center;
            gap: 4px;
            margin-top: 4px;
            overflow-x: auto;
            padding-bottom: 4px;
        }
        .queue-label {
            font-size: 0.8em;
            color: var(--type-color);
            font-family: var(--font-mono);
            white-space: nowrap;
        }
        .queue-cell {
            border: 1px solid var(--border-color);
            min-width: 40px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: var(--font-mono);
            color: var(--value-color);
            background: var(--input-bg);
            border-radius: 4px;
        }

        /* Highlight Animations */
        @keyframes highlight-glow {
            0% { box-shadow: 0 0 0 2px var(--name-color), 0 0 10px var(--name-color); }
            100% { box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        }
        @keyframes cell-glow {
            0% { background-color: var(--name-color); color: #fff; }
            100% { background-color: var(--input-bg); color: var(--value-color); }
        }
        .highlight {
            animation: highlight-glow 1s ease-out;
        }
        .cell-highlight {
            animation: cell-glow 1s ease-out;
        }

        /* Call Stack & Output */
        .bottom-panel {
            font-family: var(--font-mono);
        }
        .breadcrumb {
            color: var(--name-color);
            display: inline-flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
        }
        .breadcrumb-item::after {
            content: "→";
            color: var(--fg-color);
            margin-left: 8px;
        }
        .breadcrumb-item:last-child::after {
            content: "";
        }
        
        #output-area {
            white-space: pre-wrap;
            color: var(--value-color);
            min-height: 40px;
        }

        .empty-state {
            text-align: center;
            padding: 40px;
            color: var(--type-color);
            font-style: italic;
            width: 100%;
        }
        
        .hidden { display: none !important; }
    </style>
</head>
<body>
    <div class="header">🔬 DryRun Visualizer</div>

    <!-- Input Panel -->
    <div id="input-panel" class="section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-weight: 600;">📥 Sample Input</div>
            <button id="toggle-input-btn" class="header-btn">Collapse</button>
        </div>
        <div id="input-area">
            <textarea id="sample-input" placeholder="Enter standard input here..."></textarea>
            <button id="run-btn">▶ Run</button>
        </div>
    </div>

    <!-- Error Panel -->
    <div id="error-panel" class="section">
        <div class="error-header">⚠️ Error</div>
        <div id="error-msg"></div>
        <div id="error-line" style="font-family: var(--font-mono); font-size: 0.9em; margin-top: 4px;"></div>
    </div>

    <!-- Controls -->
    <div id="controls-panel" class="section">
        <div class="control-group">
            <button id="btn-first" title="First Step">⏮</button>
            <button id="btn-prev" title="Previous Step (Left Arrow)">◀</button>
            <button id="btn-play" title="Play/Pause (Space)">⏵ Play</button>
            <button id="btn-next" title="Next Step (Right Arrow)">▶</button>
        </div>
        <div class="control-group" style="margin-left: 12px;">
            <label for="speed-slider" style="font-size: 0.9em;">Speed:</label>
            <input type="range" id="speed-slider" min="100" max="1000" step="100" value="500" dir="rtl">
        </div>
        <div class="status-text">
            Step <span id="step-counter">0/0</span> | Line <span id="line-counter">-</span>
        </div>
    </div>

    <!-- Step Description -->
    <div id="step-info" class="section">
        <div id="step-desc">Ready. Enter input and click Run.</div>
    </div>

    <!-- Memory -->
    <div class="header" style="font-size: 1em; margin-bottom: 8px;">🧠 Memory</div>
    <div id="memory-panel" class="section">
        <div class="empty-state">No active variables</div>
    </div>

    <!-- Call Stack -->
    <div id="callstack-panel" class="section bottom-panel hidden">
        <div style="font-weight: 600; margin-bottom: 4px;">📞 Call Stack:</div>
        <div id="callstack-path" class="breadcrumb"></div>
    </div>

    <!-- Output -->
    <div id="output-panel" class="section bottom-panel">
        <div style="font-weight: 600; margin-bottom: 4px;">📤 Output:</div>
        <div id="output-area"></div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
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
            let html = '<div class="var-value-array">';
            let elements = [];
            if (Array.isArray(v.value)) {
                elements = v.value;
            } else if (typeof v.value === 'object' && v.value !== null) {
                const maxIdx = v.size ? v.size : Math.max(-1, ...Object.keys(v.value).map(Number)) + 1;
                for(let i=0; i<maxIdx; i++) elements.push(v.value[i]);
            } else {
                elements = new Array(v.size || 0).fill('?');
            }

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

        function renderMemory(state, prevStep) {
            const vars = state.variables || {};
            
            Object.keys(vars).forEach(v => declaredVariables.add(v));
            
            if (declaredVariables.size === 0) {
                memoryPanel.innerHTML = '<div class="empty-state">No active variables</div>';
                return;
            }

            memoryPanel.innerHTML = '';
            
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

                const card = document.createElement('div');
                card.className = \`var-card \${!isActive ? 'out-of-scope' : ''} \${isHighlighted ? 'highlight' : ''}\`;
                
                let content = \`
                    <div class="var-header">
                        <span class="var-type">\${v.type || 'auto'}</span>
                        <span class="var-name">\${varName}</span>
                    </div>
                \`;

                if (v.isMap) {
                    content += renderMap(v, isHighlighted, highlightIndex);
                } else if (v.isSet) {
                    content += renderSet(v, isHighlighted);
                } else if (v.isStack) {
                    content += renderStack(v, isHighlighted);
                } else if (v.isQueue) {
                    content += renderQueue(v, isHighlighted);
                } else if (v.isArray) {
                    content += renderArray(v, isHighlighted, highlightIndex);
                } else {
                    content += renderScalar(v, isHighlighted);
                }
                
                card.innerHTML = content;
                memoryPanel.appendChild(card);
            });
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
