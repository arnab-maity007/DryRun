const vscode = require('vscode');
const { spawn } = require('child_process');
const path = require('path');
const { Interpreter } = require('./src/interpreter');
const { getWebviewContent } = require('./src/webview');

// ─── Line Highlighting Decoration ───────────────────────────────────────────
const activeLineDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 200, 0, 0.2)',
    isWholeLine: true,
});

// ─── Delta Flash: green pulse on changed variable lines ─────────────────────
const deltaFlashDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(50, 205, 50, 0.15)',
    isWholeLine: true,
});

let currentPanel = null;
let pythonProcess = null;

// ─── Language Detection ─────────────────────────────────────────────────────
function detectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.py': return 'python';
        case '.java': return 'java';
        case '.cpp':
        case '.cc':
        case '.cxx':
        case '.c':
            return 'cpp';
        default: return null;
    }
}

// ─── Find Python Command (cross-platform) ───────────────────────────────────
function getPythonCommand() {
    // On Windows, 'python' is the standard. On Unix, 'python3' is safer.
    return process.platform === 'win32' ? 'python' : 'python3';
}

// ─── Activation ─────────────────────────────────────────────────────────────
function activate(context) {
    let disposable = vscode.commands.registerCommand('dryrun.start', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('DryRun: Please open a code file first.');
            return;
        }

        const filePath = editor.document.fileName;
        const language = detectLanguage(filePath);

        if (!language) {
            vscode.window.showErrorMessage(
                `DryRun: Unsupported file type "${path.extname(filePath)}". Supported: .py, .java, .cpp, .c`
            );
            return;
        }

        // Kill any lingering Python process
        if (pythonProcess) {
            pythonProcess.kill();
            pythonProcess = null;
        }
        editor.setDecorations(activeLineDecoration, []);
        editor.setDecorations(deltaFlashDecoration, []);

        // ─── Create or reuse webview panel ──────────────────────────
        if (!currentPanel) {
            currentPanel = vscode.window.createWebviewPanel(
                "dryrunVisualizer",
                "DryRun: Visualizer",
                vscode.ViewColumn.Two,
                { enableScripts: true, retainContextWhenHidden: true }
            );

            currentPanel.onDidDispose(() => {
                currentPanel = null;
                if (pythonProcess) {
                    pythonProcess.kill();
                    pythonProcess = null;
                }
                // FIX B2: re-resolve active editor instead of using potentially stale closure
                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor) {
                    activeEditor.setDecorations(activeLineDecoration, []);
                    activeEditor.setDecorations(deltaFlashDecoration, []);
                }
                lastHighlightedLine = -1;
            });

            currentPanel.webview.html = getWebviewContent();

            currentPanel.webview.onDidReceiveMessage(
                (message) => {
                    switch (message.command) {
                        case "ready":
                            // FIX B1: don't auto-run on ready — just wait for user to click Run.
                            // The webview shows its idle/empty state until the user provides input and clicks Run.
                            break;
                        case "requestRun":
                            runCode(editor, filePath, language, message.input || "", context);
                            break;
                        case "stepChanged":
                            highlightLine(editor, message.line);
                            break;
                    }
                },
                undefined,
                context.subscriptions
            );
        } else {
            currentPanel.reveal(vscode.ViewColumn.Two);
            // When re-opening for a new file, run immediately with empty input as a preview
            runCode(editor, filePath, language, "", context);
        }
    });

    context.subscriptions.push(disposable);
}

// ─── Run Code: Routes to the correct engine ─────────────────────────────────
function runCode(editor, filePath, language, inputString, context) {
    // Re-read the file content fresh (user may have edited since opening)
    const sourceCode = editor.document.getText();

    try {
        if (language === 'python') {
            // Python gets two paths:
            // 1. Try the JS interpreter first (fast, supports step-back, input)
            // 2. Fall back to engine.py for advanced tracing (custom objects, etc.)
            runWithJSInterpreter(sourceCode, inputString, language, filePath, context);
        } else {
            // C++ and Java always use the JS interpreter
            runWithJSInterpreter(sourceCode, inputString, language, filePath, context);
        }
    } catch (err) {
        // If JS interpreter fails, show error in the webview
        if (currentPanel) {
            currentPanel.webview.postMessage({
                command: 'error',
                message: err.message || String(err),
                line: err.line || null,
            });
        }
        vscode.window.showErrorMessage(`DryRun: ${err.message}`);
    }
}

// ─── JS Interpreter Engine (C++, Python, Java) ─────────────────────────────
function runWithJSInterpreter(sourceCode, inputString, language, filePath, context) {
    try {
        const interpreter = new Interpreter(sourceCode, inputString, language);
        const steps = interpreter.run();

        if (steps.length === 0) {
            if (currentPanel) {
                currentPanel.webview.postMessage({
                    command: 'error',
                    message: 'No execution steps generated. Make sure your code has a main() function.',
                    line: null,
                });
            }
            return;
        }

        // Send all steps to the webview at once — it handles playback
        if (currentPanel) {
            currentPanel.webview.postMessage({
                command: 'loadSteps',
                steps: steps,
            });
        }
    } catch (err) {
        // If it's a Python file and the JS interpreter fails,
        // fall back to the native Python engine for advanced features
        if (language === 'python') {
            console.log('DryRun: JS interpreter failed for Python, falling back to engine.py:', err.message);
            runWithPythonEngine(filePath, inputString, context);
            return;
        }

        // For C++/Java, surface the error
        if (currentPanel) {
            currentPanel.webview.postMessage({
                command: 'error',
                message: err.message || String(err),
                line: null,
            });
        }
    }
}

// ─── Python Native Engine (sys.settrace fallback) ───────────────────────────
function runWithPythonEngine(filePath, inputString, context) {
    if (pythonProcess) {
        pythonProcess.kill();
        pythonProcess = null;
    }

    const pythonScript = path.join(context.extensionPath, 'src', 'engine.py');
    const pythonCmd = getPythonCommand();

    pythonProcess = spawn(pythonCmd, [pythonScript, filePath]);

    // If the script needs stdin, provide it
    if (inputString) {
        pythonProcess.stdin.write(inputString);
        pythonProcess.stdin.end();
    } else {
        pythonProcess.stdin.end();
    }

    const collectedStates = [];
    let buffer = '';

    pythonProcess.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
                const state = JSON.parse(trimmed);

                if (state.error) {
                    // Python runtime error
                    if (currentPanel) {
                        currentPanel.webview.postMessage({
                            command: 'error',
                            message: state.error,
                            line: state.lineNumber || null,
                        });
                    }
                    return;
                }

                // Convert engine.py state format to step format
                collectedStates.push({
                    line: state.lineNumber,
                    action: 'trace',
                    description: `Line ${state.lineNumber} executed`,
                    variables: convertPythonVariables(state.variables),
                    output: '',
                    highlightVar: null,
                    highlightIndex: null,
                    callStack: state.callStack || ['main'],
                });
            } catch (e) {
                console.error('DryRun: Failed to parse Python output:', e);
            }
        }
    });

    pythonProcess.stderr.on('data', (data) => {
        const errMsg = data.toString().trim();
        if (errMsg) {
            if (currentPanel) {
                currentPanel.webview.postMessage({
                    command: 'error',
                    message: errMsg,
                    line: null,
                });
            }
        }
    });

    pythonProcess.on('close', () => {
        // Process any remaining buffer
        if (buffer.trim()) {
            try {
                const state = JSON.parse(buffer.trim());
                if (!state.error) {
                    collectedStates.push({
                        line: state.lineNumber,
                        action: 'trace',
                        description: `Line ${state.lineNumber} executed`,
                        variables: convertPythonVariables(state.variables),
                        output: '',
                        highlightVar: null,
                        highlightIndex: null,
                        callStack: state.callStack || ['main'],
                    });
                }
            } catch (e) { /* ignore */ }
        }

        // Send all collected states as steps
        if (currentPanel && collectedStates.length > 0) {
            currentPanel.webview.postMessage({
                command: 'loadSteps',
                steps: collectedStates,
            });
        } else if (currentPanel && collectedStates.length === 0) {
            currentPanel.webview.postMessage({
                command: 'error',
                message: 'No execution data collected. Make sure Python is installed and the file runs correctly.',
                line: null,
            });
        }

        pythonProcess = null;
    });
}

// ─── Convert Python engine variables to webview format ──────────────────────
function convertPythonVariables(pyVars) {
    if (!pyVars) return {};
    const result = {};

    for (const [name, data] of Object.entries(pyVars)) {
        const val = data.value;
        const type = data.type || 'auto';

        if (Array.isArray(val)) {
            result[name] = {
                type: type,
                value: val,
                isArray: true,
                size: val.length,
            };
        } else if (val && typeof val === 'object' && !val.__type__) {
            // dict/map
            result[name] = {
                type: type,
                value: val,
                isMap: true,
            };
        } else if (val && typeof val === 'object' && val.__type__) {
            // Custom object (TreeNode, ListNode) - keep object for graph rendering
            result[name] = {
                type: val.__type__,
                value: val,
                isGraphNode: true
            };
        } else {
            result[name] = {
                type: type,
                value: val,
            };
        }
    }

    return result;
}

// ─── Line Highlighting ──────────────────────────────────────────────────────
let lastHighlightedLine = -1;

function highlightLine(editor, lineNumber) {
    if (!editor || !lineNumber || lineNumber < 1) return;

    const line = lineNumber - 1; // VS Code is 0-indexed
    const range = new vscode.Range(
        new vscode.Position(line, 0),
        new vscode.Position(line, 0)
    );

    // Active line highlight (yellow)
    editor.setDecorations(activeLineDecoration, [range]);

    // Delta flash (green pulse) when line changes
    if (lastHighlightedLine !== line) {
        editor.setDecorations(deltaFlashDecoration, [range]);
        // Clear the delta flash after 600ms
        setTimeout(() => {
            if (editor) {
                editor.setDecorations(deltaFlashDecoration, []);
            }
        }, 600);
    }

    lastHighlightedLine = line;

    // Scroll to make the line visible
    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

// ─── Deactivation ───────────────────────────────────────────────────────────
function deactivate() {
    if (pythonProcess) {
        pythonProcess.kill();
        pythonProcess = null;
    }
}

module.exports = { activate, deactivate };