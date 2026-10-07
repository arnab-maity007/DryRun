// Project: DryRun — CP Code Visualizer Extension
// Author: Arnab Maity

const vscode = require('vscode');
const { Interpreter } = require('./src/interpreter');
const { getWebviewContent } = require('./src/webview');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    let disposable = vscode.commands.registerCommand('dryrun.start', function () {
        
        // Get the active text editor's content
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('DryRun: Open a C++ file first!');
            return;
        }

        const sourceCode = editor.document.getText();
        const fileName = editor.document.fileName;

        // Create a Webview Panel split to the side
        const panel = vscode.window.createWebviewPanel(
            'dryRunVisualizer',
            'DryRun Visualizer',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true  // Keep state when tab is hidden
            }
        );

        // Inject the HTML UI
        panel.webview.html = getWebviewContent();

        // Line highlight decoration for the editor
        const lineHighlightDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(0, 122, 204, 0.15)',
            isWholeLine: true,
            borderWidth: '0 0 0 3px',
            borderStyle: 'solid',
            borderColor: '#007acc'
        });

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'ready':
                        // Send the source code to the webview for display
                        panel.webview.postMessage({
                            command: 'loadCode',
                            code: sourceCode
                        });
                        break;

                    case 'requestRun':
                        try {
                            // Run the interpreter
                            const interpreter = new Interpreter(sourceCode, message.input || '');
                            const steps = interpreter.run();

                            // Send steps to webview
                            panel.webview.postMessage({
                                command: 'loadSteps',
                                steps: steps
                            });

                            vscode.window.showInformationMessage(
                                `DryRun: Generated ${steps.length} execution steps!`
                            );
                        } catch (error) {
                            panel.webview.postMessage({
                                command: 'error',
                                message: error.message
                            });
                            vscode.window.showErrorMessage(`DryRun Error: ${error.message}`);
                        }
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        // Clean up decoration when panel is disposed
        panel.onDidDispose(() => {
            lineHighlightDecoration.dispose();
        });
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}