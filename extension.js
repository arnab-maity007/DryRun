// Project: DryRun — CP Code Visualizer Extension
// Author: Arnab Maity

const vscode = require('vscode');
const { Interpreter } = require('./src/interpreter');
const { getWebviewContent } = require('./src/webview');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

    // ── Line highlight decoration (applied to the EDITOR, not the webview) ──
    const activeLineDecoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(0, 122, 204, 0.18)',
        isWholeLine: true,
        borderWidth: '0 0 0 3px',
        borderStyle: 'solid',
        borderColor: '#007acc',
        overviewRulerColor: '#007acc',
        overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    const executedLineDecoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(0, 122, 204, 0.05)',
        isWholeLine: true,
        borderWidth: '0 0 0 2px',
        borderStyle: 'solid',
        borderColor: 'rgba(0, 122, 204, 0.2)',
    });

    let disposable = vscode.commands.registerCommand('dryrun.start', function () {

        // Get the active text editor's content
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('DryRun: Open a C++ file first!');
            return;
        }

        const sourceCode = editor.document.getText();
        const sourceEditor = editor; // Keep reference to the source editor
        let executedLines = new Set();

        // Detect language (for future multi-language support)
        const fileName = editor.document.fileName;
        const ext = fileName.split('.').pop().toLowerCase();
        let language = 'cpp';
        if (['py'].includes(ext)) language = 'python';
        if (['java'].includes(ext)) language = 'java';

        if (language !== 'cpp') {
            vscode.window.showWarningMessage(`DryRun: ${language.toUpperCase()} support coming soon! Currently only C++ is supported.`);
            return;
        }

        // Create a Webview Panel split to the side
        const panel = vscode.window.createWebviewPanel(
            'dryRunVisualizer',
            'DryRun Visualizer',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // Inject the HTML UI
        panel.webview.html = getWebviewContent();

        // ── Highlight a line in the actual editor ──
        function highlightEditorLine(lineNum) {
            if (!lineNum || lineNum < 1) return;

            // Find the editor showing the source file
            const visibleEditor = vscode.window.visibleTextEditors.find(
                e => e.document.uri.toString() === sourceEditor.document.uri.toString()
            );
            if (!visibleEditor) return;

            // Active line decoration
            const activeLine = new vscode.Range(lineNum - 1, 0, lineNum - 1, 0);
            visibleEditor.setDecorations(activeLineDecoration, [activeLine]);

            // Executed lines decoration
            executedLines.add(lineNum);
            const executedRanges = [...executedLines]
                .filter(l => l !== lineNum)
                .map(l => new vscode.Range(l - 1, 0, l - 1, 0));
            visibleEditor.setDecorations(executedLineDecoration, executedRanges);

            // Scroll editor to the line
            visibleEditor.revealRange(activeLine, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
        }

        // ── Clear all decorations ──
        function clearDecorations() {
            const visibleEditor = vscode.window.visibleTextEditors.find(
                e => e.document.uri.toString() === sourceEditor.document.uri.toString()
            );
            if (visibleEditor) {
                visibleEditor.setDecorations(activeLineDecoration, []);
                visibleEditor.setDecorations(executedLineDecoration, []);
            }
        }

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'ready':
                        // Webview is ready — no code to send (code panel removed)
                        break;

                    case 'requestRun':
                        executedLines = new Set();
                        clearDecorations();

                        try {
                            // Run the interpreter
                            const interpreter = new Interpreter(sourceCode, message.input || '');
                            const steps = interpreter.run();

                            if (steps.length === 0) {
                                panel.webview.postMessage({
                                    command: 'error',
                                    message: 'No executable steps found. Make sure your code has a main() or signed main() function.',
                                });
                                return;
                            }

                            // Send steps to webview
                            panel.webview.postMessage({
                                command: 'loadSteps',
                                steps: steps
                            });

                            vscode.window.showInformationMessage(
                                `DryRun: ${steps.length} steps generated ✓`
                            );
                        } catch (error) {
                            // Parse/interpret error — send detailed message
                            let errorMsg = error.message;
                            let errorLine = null;

                            // Try to extract line number from error message
                            const lineMatch = errorMsg.match(/line (\d+)/i);
                            if (lineMatch) errorLine = parseInt(lineMatch[1]);

                            panel.webview.postMessage({
                                command: 'error',
                                message: errorMsg,
                                line: errorLine
                            });

                            // Also highlight the error line in the editor
                            if (errorLine) {
                                highlightEditorLine(errorLine);
                            }
                        }
                        break;

                    case 'stepChanged':
                        // User navigated to a step — highlight the line in the editor
                        if (message.line) {
                            highlightEditorLine(message.line);
                        }
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        // Clean up decorations when panel is disposed
        panel.onDidDispose(() => {
            clearDecorations();
        });
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}