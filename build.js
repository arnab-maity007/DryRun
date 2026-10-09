const fs = require('fs');
let content = fs.readFileSync('src/webview.js', 'utf8');

// 1. Replace the DOM to add split view
const targetDOM = `    <!-- Step Description -->
    <div id="step-info" class="section">
        <div id="step-desc">Ready. Enter input and click Run.</div>
    </div>

    <!-- Memory -->
    <div class="header" style="font-size: 1em; margin-bottom: 8px;">?? Memory</div>
    <div id="memory-panel" class="section">
        <div class="empty-state">No active variables</div>
    </div>

    <!-- Call Stack -->
    <div id="callstack-panel" class="section bottom-panel hidden">
        <div style="font-weight: 600; margin-bottom: 4px;">?? Call Stack:</div>
        <div id="callstack-path" class="breadcrumb"></div>
    </div>

    <!-- Output -->
    <div id="output-panel" class="section bottom-panel">
        <div style="font-weight: 600; margin-bottom: 4px;">?? Output:</div>
        <div id="output-area"></div>
    </div>`;

const replacementDOM = `    <div style="display: flex; flex-direction: row; gap: 16px; flex-grow: 1; overflow: hidden; min-height: 0;">
        <div style="width: 320px; display: flex; flex-direction: column; overflow-y: auto; padding-right: 4px;">
            <!-- Step Description -->
            <div id="step-info" class="section">
                <div id="step-desc">Ready. Enter input and click Run.</div>
            </div>

            <!-- Memory -->
            <div class="header" style="font-size: 1em; margin-bottom: 8px;">?? Memory</div>
            <div id="memory-panel" class="section">
                <div class="empty-state">No active variables</div>
            </div>

            <!-- Call Stack -->
            <div id="callstack-panel" class="section bottom-panel hidden">
                <div style="font-weight: 600; margin-bottom: 4px;">?? Call Stack:</div>
                <div id="callstack-path" class="breadcrumb"></div>
            </div>

            <!-- Output -->
            <div id="output-panel" class="section bottom-panel">
                <div style="font-weight: 600; margin-bottom: 4px;">?? Output:</div>
                <div id="output-area"></div>
            </div>
        </div>
        
        <div id="graph-view" style="flex-grow: 1; position: relative; background: var(--bg-color); border-radius: var(--radius); border: 1px solid var(--border-color); overflow: auto;">
            <svg id="edges" style="position: absolute; top: 0; left: 0; width: 3000px; height: 3000px; pointer-events: none;">
                <defs>
                    <marker id="arrow" viewBox="0 -5 10 10" refX="22" refY="0" markerWidth="8" markerHeight="8" orient="auto">
                        <path d="M0,-5L10,0L0,5" fill="var(--name-color)"></path>
                    </marker>
                </defs>
            </svg>
            <div id="nodes" style="position: absolute; top: 0; left: 0; width: 3000px; height: 3000px;"></div>
        </div>
    </div>`;

content = content.replace(targetDOM, replacementDOM);

// 2. Add Graph Visualizer CSS
const targetCSS = '        .hidden { display: none !important; }';
const cssToAdd = `
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
        .hidden { display: none !important; }
`;
content = content.replace(targetCSS, cssToAdd);

// 3. Add Visualizer class and integration in script
const targetScriptStart = '        const vscode = acquireVsCodeApi();';
const visualizerCode = `        const vscode = acquireVsCodeApi();

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

                // Support standard trees/lists
                ['next', 'left', 'right'].forEach(prop => {
                    if (node[prop] && typeof node[prop] === 'object' && node[prop].__id__) {
                        const edgeExists = this.graphEdges.some(e => e.source === node.__id__ && e.target === node[prop].__id__);
                        if (!edgeExists) {
                            this.graphEdges.push({ source: node.__id__, target: node[prop].__id__, type: prop });
                            this.traverse(node[prop], visited);
                        }
                    }
                });
                
                // Support adjacency list (e.g. neighbors list)
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
                        this.svgHtml += \`<line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" stroke="${color}" stroke-width="2" marker-end="url(#arrow)"/>\`;
                    } else {
                        this.svgHtml += \`<line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" stroke="${color}" stroke-width="2"/>\`;
                    }
                }

                for (const [id, node] of this.graphNodes.entries()) {
                    let cssClass = 'graph-node';
                    if (node.type && node.type.includes('Tree')) cssClass = 'tree-node';
                    if (node.type && node.type.includes('List')) cssClass = 'list-node';
                    
                    let labelsHtml = '';
                    if (this.pointers.has(id)) {
                        labelsHtml = \`<div class="pointer-labels">${this.pointers.get(id).map(name => \`<span class="pointer-label">${name}</span>\`).join('')}</div>\`;
                    }
                    this.nodesHtml += \`<div class="visual-node ${cssClass}" style="left: ${node.x}px; top: ${node.y}px" id="node-${id}">${labelsHtml}${node.val}</div>\`;
                }

                document.getElementById('edges').innerHTML = this.svgHtml;
                document.getElementById('nodes').innerHTML = this.nodesHtml;
            }
        }`;
content = content.replace(targetScriptStart, visualizerCode);

// 4. Update renderMemory to trigger visualizer
const targetRenderMemoryStart = '        function renderMemory(state, prevStep) {';
const renderMemoryReplacement = `        function renderMemory(state, prevStep) {
            const visualizer = new Visualizer();`;
content = content.replace(targetRenderMemoryStart, renderMemoryReplacement);

const targetRenderMemoryEnd = '                memoryPanel.appendChild(card);\r\n            });';
const renderMemoryEndReplacement = `                memoryPanel.appendChild(card);
                
                // Add Graph Node
                if (v.isGraphNode) {
                    visualizer.traverse(v.value);
                    visualizer.addPointer(v.value.__id__, varName);
                }
            });
            visualizer.render();`;
content = content.replace(targetRenderMemoryEnd, renderMemoryEndReplacement);

fs.writeFileSync('src/webview.js', content);
console.log('Successfully injected graph visualizer');
