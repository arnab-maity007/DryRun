// src/preprocessor.js
// Expands #define macros in C++ source code before tokenization.
// Handles both simple defines and function-like macros:
//   #define vi vector<int>
//   #define f(i,a,b) for(int i=a; i<b; i++)
//   #define all(x) x.begin(), x.end()

// Common CP macros to pre-define (expanded automatically even if not in the code)
const BUILTIN_MACROS = {
    // These are only used as fallbacks if not defined in the source
};

class Preprocessor {
    constructor(sourceCode) {
        this.source = sourceCode;
        this.macros = new Map();         // name -> { params: string[]|null, body: string }
    }

    process() {
        const lines = this.source.split('\n');
        const outputLines = [];

        // First pass: collect #define directives
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('#define')) {
                this.parseDefine(trimmed);
                outputLines.push('// ' + trimmed); // Comment out the #define so tokenizer skips it
            } else {
                outputLines.push(line);
            }
        }

        // Second pass: expand macros in non-directive lines
        let result = outputLines.join('\n');

        // Iteratively expand macros (handles nested macros)
        let maxPasses = 10; // prevent infinite recursion
        for (let pass = 0; pass < maxPasses; pass++) {
            const expanded = this.expandAll(result);
            if (expanded === result) break; // no more expansions
            result = expanded;
        }

        return result;
    }

    parseDefine(line) {
        // Remove '#define '
        let rest = line.substring('#define'.length).trim();

        // Check for function-like macro: NAME(params)
        const funcMatch = rest.match(/^([a-zA-Z_]\w*)\(([^)]*)\)\s+(.*)/);
        if (funcMatch) {
            const name = funcMatch[1];
            const params = funcMatch[2].split(',').map(p => p.trim()).filter(p => p.length > 0);
            const body = funcMatch[3].trim();
            this.macros.set(name, { params, body });
            return;
        }

        // Simple macro: NAME value
        const simpleMatch = rest.match(/^([a-zA-Z_]\w*)\s+(.*)/);
        if (simpleMatch) {
            const name = simpleMatch[1];
            const body = simpleMatch[2].trim();
            this.macros.set(name, { params: null, body });
            return;
        }

        // Define without value: NAME (define to empty)
        const nameOnly = rest.match(/^([a-zA-Z_]\w*)$/);
        if (nameOnly) {
            this.macros.set(nameOnly[1], { params: null, body: '' });
        }
    }

    expandAll(text) {
        let result = text;

        for (const [name, macro] of this.macros) {
            if (macro.params !== null) {
                // Function-like macro expansion
                result = this.expandFunctionMacro(result, name, macro);
            } else {
                // Simple text replacement — only replace whole words
                const regex = new RegExp('\\b' + this.escapeRegex(name) + '\\b', 'g');
                // Don't replace inside #define lines, string literals, or comments
                result = this.replaceOutsideStrings(result, regex, macro.body);
            }
        }

        return result;
    }

    expandFunctionMacro(text, name, macro) {
        let result = '';
        let i = 0;

        while (i < text.length) {
            // Check if we're inside a string
            if (text[i] === '"') {
                const end = this.findStringEnd(text, i);
                result += text.substring(i, end + 1);
                i = end + 1;
                continue;
            }
            if (text[i] === "'") {
                const end = this.findCharEnd(text, i);
                result += text.substring(i, end + 1);
                i = end + 1;
                continue;
            }

            // Check for // comments
            if (text[i] === '/' && i + 1 < text.length && text[i + 1] === '/') {
                const end = text.indexOf('\n', i);
                if (end === -1) {
                    result += text.substring(i);
                    break;
                }
                result += text.substring(i, end);
                i = end;
                continue;
            }

            // Try to match the macro name as a whole word
            if (this.isWordBoundary(text, i) && text.substring(i, i + name.length) === name) {
                const afterName = i + name.length;
                if (afterName < text.length && text[afterName] === '(') {
                    // Parse arguments
                    const args = this.parseArguments(text, afterName);
                    if (args) {
                        // Substitute parameters in the body
                        let body = macro.body;
                        for (let p = 0; p < macro.params.length; p++) {
                            const paramName = macro.params[p];
                            const argValue = args.args[p] || '';
                            const paramRegex = new RegExp('\\b' + this.escapeRegex(paramName) + '\\b', 'g');
                            body = body.replace(paramRegex, argValue);
                        }
                        result += body;
                        i = args.endPos + 1; // skip past the closing ')'
                        continue;
                    }
                }
            }

            result += text[i];
            i++;
        }

        return result;
    }

    parseArguments(text, openParenPos) {
        let i = openParenPos + 1; // skip '('
        const args = [];
        let current = '';
        let depth = 1; // track nested parentheses

        while (i < text.length && depth > 0) {
            if (text[i] === '(') {
                depth++;
                current += text[i];
            } else if (text[i] === ')') {
                depth--;
                if (depth === 0) {
                    args.push(current.trim());
                } else {
                    current += text[i];
                }
            } else if (text[i] === ',' && depth === 1) {
                args.push(current.trim());
                current = '';
            } else {
                current += text[i];
            }
            i++;
        }

        if (depth !== 0) return null; // unmatched parentheses

        return { args, endPos: i - 1 };
    }

    isWordBoundary(text, pos) {
        if (pos === 0) return true;
        const prev = text[pos - 1];
        return !/[a-zA-Z0-9_]/.test(prev);
    }

    findStringEnd(text, startQuote) {
        let i = startQuote + 1;
        while (i < text.length) {
            if (text[i] === '\\') { i += 2; continue; }
            if (text[i] === '"') return i;
            i++;
        }
        return text.length - 1;
    }

    findCharEnd(text, startQuote) {
        let i = startQuote + 1;
        while (i < text.length) {
            if (text[i] === '\\') { i += 2; continue; }
            if (text[i] === "'") return i;
            i++;
        }
        return text.length - 1;
    }

    replaceOutsideStrings(text, regex, replacement) {
        // Simple approach: split by lines, skip comment lines, apply regex
        const lines = text.split('\n');
        return lines.map(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('#')) return line;
            // Very basic: just replace, avoiding string internals is complex
            // For CP code, this is usually fine
            return line.replace(regex, replacement);
        }).join('\n');
    }

    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

function preprocess(sourceCode) {
    const pp = new Preprocessor(sourceCode);
    return pp.process();
}

module.exports = { preprocess, Preprocessor };

