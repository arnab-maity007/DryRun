const vscode = require('vscode');
const { spawn } = require('child_process');
const path = require('path');

const activeLineDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 200, 0, 0.2)',
    isWholeLine: true,
});

let currentPanel = null;
let pythonProcess = null;

function activate(context) {
    let disposable = vscode.commands.registerCommand('dryrun.start', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('DryRun: Please open a code file first.');
            return;
        }

        if (pythonProcess) pythonProcess.kill();
        editor.setDecorations(activeLineDecoration, []);

        if (!currentPanel) {
            currentPanel = vscode.window.createWebviewPanel(
                'dryrunMemory',
                'DryRun: Memory State',
                vscode.ViewColumn.Two,
                { enableScripts: true, retainContextWhenHidden: true }
            );

            currentPanel.onDidDispose(() => {
                currentPanel = null;
                if (pythonProcess) pythonProcess.kill();
                editor.setDecorations(activeLineDecoration, []);
            });
            
            currentPanel.webview.html = getWebviewContent();
        }

        const filePath = editor.document.fileName;
        const pythonScript = path.join(context.extensionPath, 'src', 'engine.py');
        
        pythonProcess = spawn('python3', [pythonScript, filePath]);

        pythonProcess.stdout.on('data', (data) => {
            try {
                const outputs = data.toString().trim().split('\n');
                
                for (const output of outputs) {
                    if (!output) continue;
                    const state = JSON.parse(output);
                    
                    if (state.lineNumber) {
                        const range = new vscode.Range(
                            new vscode.Position(state.lineNumber - 1, 0),
                            new vscode.Position(state.lineNumber - 1, 0)
                        );
                        editor.setDecorations(activeLineDecoration, [range]);
                        editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
                    }

                    if (currentPanel) {
                        currentPanel.webview.postMessage({
                            command: 'updateState',
                            variables: state.variables,
                            callStack: state.callStack
                        });
                    }
                }
            } catch (e) {
                console.error("Failed to parse Python output:", e);
            }
        });

        pythonProcess.stderr.on('data', (data) => {
            vscode.window.showErrorMessage(`DryRun Engine Error: ${data.toString()}`);
        });
    });

    context.subscriptions.push(disposable);
}

function getWebviewContent() {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: sans-serif; padding: 10px; color: #d4d4d4; margin: 0; display: flex; height: 100vh; overflow: hidden; }
            
            /* Sidebar Layout (Call Stack + Primitives) */
            #sidebar { width: 300px; display: flex; flex-direction: column; padding-right: 15px; border-right: 1px solid #333; overflow-y: auto; }
            
            h4 { margin: 10px 0 5px 0; color: #cccccc; border-bottom: 1px solid #333; padding-bottom: 4px; }
            
            /* Call Stack Styling */
            #stack-container { display: flex; flex-direction: column; gap: 4px; margin-bottom: 15px; }
            .stack-frame { padding: 6px 12px; background: #2d2d30; border-left: 4px solid #c586c0; border-radius: 2px; font-family: monospace; font-size: 13px; font-weight: bold; }
            .stack-frame.active { background: #37373d; border-left-color: #e3b341; }
            
            /* Memory Boxes */
            #memory-container { display: flex; flex-direction: column; gap: 8px; }
            .memory-box { padding: 8px 12px; background: #252526; border: 1px solid #333; border-radius: 4px; font-family: monospace; font-size: 13px; }
            
            /* Canvas Styling - Now fully scrollable with massive inner bounds */
            #main-view { flex-grow: 1; position: relative; background: #1e1e1e; margin-left: 15px; border-radius: 6px; border: 1px solid #333; overflow: auto; }
            #edges { position: absolute; top: 0; left: 0; width: 3000px; height: 3000px; pointer-events: none; }
            #nodes { position: absolute; top: 0; left: 0; width: 3000px; height: 3000px; }
            
            .visual-node {
                position: absolute; display: flex; flex-direction: column; align-items: center; justify-content: center;
                transform: translate(-50%, -50%); background: #252526; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.4);
                transition: top 0.3s ease, left 0.3s ease;
            }
            .tree-node { width: 40px; height: 40px; border-radius: 50%; border: 2px solid #569cd6; }
            .list-node { width: 50px; height: 30px; border-radius: 4px; border: 2px solid #4ec9b0; }

            .pointer-labels {
                position: absolute; bottom: calc(100% + 8px); display: flex; flex-direction: column-reverse;
                align-items: center; gap: 4px; white-space: nowrap; pointer-events: none;
            }
            .pointer-label { background: #9cdcfe; color: #1e1e1e; font-size: 11px; padding: 2px 6px; border-radius: 8px; font-family: monospace; font-weight: bold; }
        </style>
    </head>
    <body>
        <div id="sidebar">
            <h4>Call Stack</h4>
            <div id="stack-container"></div>
            
            <h4>Memory</h4>
            <div id="memory-container"></div>
        </div>
        
        <div id="main-view">
            <svg id="edges">
                <defs>
                    <marker id="arrow" viewBox="0 -5 10 10" refX="22" refY="0" markerWidth="8" markerHeight="8" orient="auto">
                        <path d="M0,-5L10,0L0,5" fill="#4ec9b0"></path>
                    </marker>
                </defs>
            </svg>
            <div id="nodes"></div>
        </div>
        
        <script>
            const vscode = acquireVsCodeApi();
            
            class Visualizer {
                constructor() {
                    this.svgHtml = '<defs><marker id="arrow" viewBox="0 -5 10 10" refX="22" refY="0" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,-5L10,0L0,5" fill="#4ec9b0"></path></marker></defs>';
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

                traverse(node) {
                    if (!node || typeof node !== 'object' || !node.__id__) return;
                    
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
                                this.traverse(node[prop]);
                            }
                        }
                    });
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
                    
                    // FIX: Center dynamically based on the panel width, but never go further left than 300px
                    const canvasWidth = document.getElementById('main-view').clientWidth || 600;
                    const startX = Math.max(canvasWidth / 2, 300);

                    const assignCoords = (id, x, y, offsetX) => {
                        if (visited.has(id)) return;
                        visited.add(id);

                        const node = this.graphNodes.get(id);
                        node.x = x;
                        node.y = y;

                        const children = this.graphEdges.filter(e => e.source === id);
                        for (const edge of children) {
                            if (edge.type === 'next') assignCoords(edge.target, x + 100, y, offsetX);
                            else if (edge.type === 'left') assignCoords(edge.target, x - offsetX, y + 80, offsetX / 1.5);
                            else if (edge.type === 'right') assignCoords(edge.target, x + offsetX, y + 80, offsetX / 1.5);
                        }
                    };

                    for (const rootId of roots) {
                        assignCoords(rootId, startX, currentY, 150);
                        currentY += 150; 
                    }

                    for (const edge of this.graphEdges) {
                        const source = this.graphNodes.get(edge.source);
                        const target = this.graphNodes.get(edge.target);
                        if (edge.type === 'next') {
                            this.svgHtml += \`<line x1="\${source.x}" y1="\${source.y}" x2="\${target.x}" y2="\${target.y}" stroke="#4ec9b0" stroke-width="2" marker-end="url(#arrow)"/>\`;
                        } else {
                            this.svgHtml += \`<line x1="\${source.x}" y1="\${source.y}" x2="\${target.x}" y2="\${target.y}" stroke="#569cd6" stroke-width="2"/>\`;
                        }
                    }

                    for (const [id, node] of this.graphNodes.entries()) {
                        const cssClass = (node.type && node.type.includes('Tree')) ? 'tree-node' : 'list-node';
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

            window.addEventListener('message', event => {
                const message = event.data;
                if (message.command === 'updateState') {
                    
                    // Render Call Stack (Reversed so deepest call is visually at the top)
                    const stackContainer = document.getElementById('stack-container');
                    stackContainer.innerHTML = '';
                    if (message.callStack) {
                        const reversedStack = [...message.callStack].reverse();
                        reversedStack.forEach((func, index) => {
                            const isActive = index === 0 ? 'active' : '';
                            stackContainer.innerHTML += \`<div class="stack-frame \${isActive}">\${func}()</div>\`;
                        });
                    }

                    // Render Variables & Canvas
                    const memoryContainer = document.getElementById('memory-container');
                    memoryContainer.innerHTML = '';
                    const visualizer = new Visualizer();

                for (const [name, data] of Object.entries(message.variables)) {
                        const val = data.value;
                        if (val && typeof val === 'object' && val.__type__) {
                            visualizer.traverse(val);
                            visualizer.addPointer(val.__id__, name);
                            
                            // RESTORED: This line was missing, which hid your variables!
                            memoryContainer.innerHTML += \`<div class="memory-box"><span style="color: #c586c0">\${data.type}</span> <strong>\${name}</strong> = [Mapped]</div>\`;
                        } else {
                            memoryContainer.innerHTML += \`<div class="memory-box"><span style="color: #569cd6">\${data.type}</span> <strong>\${name}</strong> = \${val === null ? 'null' : typeof val === 'string' ? val : JSON.stringify(val)}</div>\`;
                        }
                    }
                    visualizer.render();
                }
            });
        </script>
    </body>
    </html>`;
}

function deactivate() {
    if (pythonProcess) pythonProcess.kill();
}

module.exports = { activate, deactivate };