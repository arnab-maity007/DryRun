// Quick smoke test for the DryRun engine
// Run with: node test-engine.js

const { tokenize } = require('./src/tokenizer');
const { parse } = require('./src/parser');
const { Interpreter } = require('./src/interpreter');

const code = `#include <bits/stdc++.h>
using namespace std;

int main() {
    int n;
    cin >> n;
    vector<int> arr(n);
    for (int i = 0; i < n; i++) {
        cin >> arr[i];
    }
    int sum = 0;
    for (int i = 0; i < n; i++) {
        sum += arr[i];
    }
    cout << sum << endl;
    return 0;
}`;

const input = '5\n1 2 3 4 5';

console.log('=== TOKENIZE ===');
const tokens = tokenize(code);
console.log(`Generated ${tokens.length} tokens`);
console.log('First 10 tokens:', tokens.slice(0, 10).map(t => `${t.type}(${t.value})`).join(', '));

console.log('\n=== PARSE ===');
const ast = parse(tokens);
console.log(`Program has ${ast.body.length} top-level statements`);
console.log('Statements:', ast.body.map(s => s.type).join(', '));

console.log('\n=== INTERPRET ===');
const interpreter = new Interpreter(code, input);
const steps = interpreter.run();
console.log(`Generated ${steps.length} execution steps\n`);

for (const step of steps) {
    const vars = Object.entries(step.variables).map(([k, v]) => {
        if (v.isArray) return `${k}=[${v.value.join(',')}]`;
        return `${k}=${v.value}`;
    }).join(', ');
    
    const highlight = step.highlightVar ? ` ★ ${step.highlightVar}${step.highlightIndex !== null ? '[' + step.highlightIndex + ']' : ''}` : '';
    console.log(`  Line ${String(step.line).padStart(2)} | ${step.action.padEnd(16)} | ${step.description}${highlight}`);
    if (vars) console.log(`         | vars: ${vars}`);
    if (step.output) console.log(`         | stdout: "${step.output.replace(/\n/g, '\\n')}"`);
}

