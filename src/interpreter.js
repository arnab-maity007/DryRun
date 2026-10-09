
class Interpreter {
    constructor(sourceCode, inputString, language = 'cpp') {
        this.originalSource = sourceCode;
        this.language = language;
        
        if (language === 'cpp') {
            const { preprocess } = require('./preprocessor');
            const { tokenize } = require('./tokenizer');
            const { parse } = require('./parser');
            this.processedSource = preprocess(sourceCode);
            this.tokens = tokenize(this.processedSource);
            this.ast = parse(this.tokens);
        } else if (language === 'python') {
            const { parse } = require('./python-parser');
            this.ast = parse(sourceCode);
        } else if (language === 'java') {
            const { parse } = require('./java-parser');
            this.ast = parse(sourceCode);
        }
        this.inputTokens = inputString.trim().split(/\s+/).filter(t => t.length > 0);
        this.inputPos = 0;
        
        this.scopes = [new Map()]; // Global scope
        this.output = "";
        this.steps = [];
        this.stepCount = 0;
        this.MAX_STEPS = 10000;
        
        // User-defined functions: name -> { params, body, returnType, line }
        this.functions = new Map();
        
        // Call stack tracking for recursion visualization
        this.callStack = ['main()'];
        
        // Signals for control flow
        this.BREAK = Symbol('BREAK');
        this.CONTINUE = Symbol('CONTINUE');
        this.RETURN = Symbol('RETURN');
        this.returnValue = null;
    }

    getVariablesSnapshot() {
        const snapshot = {};
        for (let i = 0; i < this.scopes.length; i++) {
            const scope = this.scopes[i];
            for (const [key, val] of scope.entries()) {
                snapshot[key] = {
                    type: val.type,
                    value: Array.isArray(val.value) ? [...val.value] : 
                           (val.value && typeof val.value === 'object' && !Array.isArray(val.value)) 
                               ? { ...val.value } : val.value,
                    isArray: val.isArray,
                    isMap: val.isMap,
                    isSet: val.isSet,
                    isStack: val.isStack,
                    isQueue: val.isQueue,
                    size: val.size
                };
            }
        }
        return snapshot;
    }

    addStep(line, action, description, highlightVar = null, highlightIndex = null) {
        this.stepCount++;
        if (this.stepCount > this.MAX_STEPS) {
            throw new Error("Max steps exceeded (possible infinite loop)");
        }
        
        this.steps.push({
            line,
            action,
            description,
            variables: this.getVariablesSnapshot(),
            output: this.output,
            highlightVar,
            highlightIndex,
            callStack: [...this.callStack]
        });
    }

    pushScope() {
        this.scopes.push(new Map());
    }

    popScope() {
        this.scopes.pop();
    }

    declareVariable(name, type, value, isArray = false, size = null, extra = {}) {
        this.scopes[this.scopes.length - 1].set(name, { type, value, isArray, size, ...extra });
    }

    getVariable(name) {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            if (this.scopes[i].has(name)) {
                return this.scopes[i].get(name);
            }
        }
        throw new Error(`Variable '${name}' is not defined`);
    }

    updateVariable(name, value) {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            if (this.scopes[i].has(name)) {
                const v = this.scopes[i].get(name);
                v.value = value;
                return;
            }
        }
        throw new Error(`Variable '${name}' is not defined`);
    }

    getDefaultValue(type) {
        if (!type) return 0;
        const t = type.toLowerCase();
        if (['int', 'long', 'long long', 'unsigned int', 'unsigned long', 'unsigned long long', 'short'].includes(t)) return 0;
        if (['double', 'float'].includes(t)) return 0.0;
        if (t === 'char') return '\0';
        if (t === 'string' || t === 'std::string') return "";
        if (t === 'bool') return false;
        return 0;
    }

    // ── Container-type detection ─────────────────────────────────────────────
    isMapType(type) {
        if (!type) return false;
        const t = type.toLowerCase();
        return t.includes('map') || t.includes('unordered_map') || t.includes('dict');
    }
    isSetType(type) {
        if (!type) return false;
        const t = type.toLowerCase();
        return t.includes('set') || t.includes('unordered_set');
    }
    isStackType(type) {
        if (!type) return false;
        return type.toLowerCase().includes('stack');
    }
    isQueueType(type) {
        if (!type) return false;
        const t = type.toLowerCase();
        return t.includes('queue') || t.includes('deque') || t.includes('priority_queue');
    }

    run() {
        // First pass: collect all function declarations (don't execute anything)
        this.collectFunctions(this.ast);
        
        // Then execute main
        if (this.functions.has('main')) {
            const mainFunc = this.functions.get('main');
            this.addStep(mainFunc.line, 'skip', 'Entering main()');
            try {
                this.execute(mainFunc.body);
            } catch (e) {
                if (e !== this.RETURN) throw e;
            }
        } else {
            throw new Error("No main() function found. Make sure your code has 'int main()' or 'signed main()'.");
        }
        
        return this.steps;
    }

    collectFunctions(node) {
        if (!node) return;
        if (node.type === 'Program') {
            for (const stmt of node.body) {
                if (stmt.type === 'FunctionDeclaration') {
                    this.functions.set(stmt.name, stmt);
                }
                if (stmt.type === 'VariableDeclaration') {
                    for (const decl of stmt.declarations) {
                        let val = this.getDefaultValue(stmt.dataType);
                        if (decl.initializer) {
                            try { val = this.evaluate(decl.initializer); } catch(e) { /* skip */ }
                        }
                        this.declareVariable(decl.name, stmt.dataType, val);
                    }
                }
                if (stmt.type === 'VectorDeclaration') {
                    try { this._executeVectorDeclaration(stmt); } catch(e) { /* skip */ }
                }
            }
        }
    }

    // ── Shared vector/container declaration logic ────────────────────────────
    _executeVectorDeclaration(node) {
        const typeStr = node.containerType || `vector<${node.elementType}>`;
        
        // Stack
        if (this.isStackType(typeStr)) {
            this.declareVariable(node.name, typeStr, [], true, 0, { isStack: true });
            this.addStep(node.line, 'declare', `Declared ${typeStr} ${node.name}`, node.name);
            return;
        }
        // Queue / deque / priority_queue
        if (this.isQueueType(typeStr)) {
            this.declareVariable(node.name, typeStr, [], true, 0, { isQueue: true });
            this.addStep(node.line, 'declare', `Declared ${typeStr} ${node.name}`, node.name);
            return;
        }
        // Map / unordered_map
        if (this.isMapType(typeStr)) {
            this.declareVariable(node.name, typeStr, {}, false, null, { isMap: true });
            this.addStep(node.line, 'declare', `Declared ${typeStr} ${node.name}`, node.name);
            return;
        }
        // Set / unordered_set
        if (this.isSetType(typeStr)) {
            this.declareVariable(node.name, typeStr, [], true, 0, { isSet: true });
            this.addStep(node.line, 'declare', `Declared ${typeStr} ${node.name}`, node.name);
            return;
        }

        // Regular vector/array
        let size = 0;
        let fill = this.getDefaultValue(node.elementType);
        let valArray = [];
        
        if (node.sizeExpr) {
            size = this.evaluate(node.sizeExpr);
            if (node.fillExpr) fill = this.evaluate(node.fillExpr);
            for (let i = 0; i < size; i++) valArray.push(fill);
        } else if (node.initList) {
            size = node.initList.length;
            valArray = node.initList.map(e => this.evaluate(e));
        }
        
        this.declareVariable(node.name, typeStr, valArray, true, size);
        this.addStep(node.line, 'declare', `Declared ${typeStr} ${node.name} of size ${size}`, node.name);
    }

    execute(node) {
        if (!node) return;
        
        switch (node.type) {
            case 'Program':
                for (const stmt of node.body) {
                    this.execute(stmt);
                }
                break;
                
            // Skip these silently — no steps generated
            case 'IncludeDirective':
            case 'UsingDirective':
                break;
                
            // Skip function declarations — already collected
            case 'FunctionDeclaration':
                break;
                
            case 'Block':
                this.pushScope();
                try {
                    for (const stmt of node.body) {
                        this.execute(stmt);
                    }
                } finally {
                    this.popScope();
                }
                break;
                
            case 'VariableDeclaration':
                for (const decl of node.declarations) {
                    let val = this.getDefaultValue(node.dataType);
                    if (decl.initializer) {
                        val = this.evaluate(decl.initializer);
                    }
                    this.declareVariable(decl.name, node.dataType, val);
                    this.addStep(node.line, 'declare', `Declared ${node.dataType} ${decl.name} = ${val}`, decl.name);
                }
                break;
                
            case 'VectorDeclaration':
                this._executeVectorDeclaration(node);
                break;
                
            case 'ArrayDeclaration': {
                const size = this.evaluate(node.sizeExpr);
                const fill = this.getDefaultValue(node.elementType);
                const valArray = new Array(size).fill(fill);
                
                this.declareVariable(node.name, `${node.elementType}[]`, valArray, true, size);
                this.addStep(node.line, 'declare', `Declared ${node.elementType}[${size}] ${node.name}`, node.name);
                break;
            }
                
            case 'CinStatement':
                for (const target of node.targets) {
                    if (this.inputPos >= this.inputTokens.length) {
                        this.inputTokens.push("0");
                    }
                    const token = this.inputTokens[this.inputPos++];
                    
                    if (target.type === 'Identifier') {
                        const v = this.getVariable(target.name);
                        let parsedVal = token;
                        const t = (v.type || '').toLowerCase();
                        if (t.includes('int') || t.includes('long') || t.includes('short')) parsedVal = parseInt(token, 10);
                        else if (t === 'double' || t === 'float') parsedVal = parseFloat(token);
                        
                        this.updateVariable(target.name, parsedVal);
                        this.addStep(node.line, 'input', `Read input: ${target.name} = ${parsedVal}`, target.name);
                    } else if (target.type === 'ArrayAccess') {
                        const name = target.object.name;
                        const index = this.evaluate(target.index);
                        const v = this.getVariable(name);
                        
                        let parsedVal = token;
                        const t = (v.type || '').toLowerCase();
                        if (t.includes('int') || t.includes('long')) parsedVal = parseInt(token, 10);
                        else if (t.includes('double') || t.includes('float')) parsedVal = parseFloat(token);
                        
                        v.value[index] = parsedVal;
                        this.addStep(node.line, 'input', `Read input: ${name}[${index}] = ${parsedVal}`, name, index);
                    }
                }
                break;
                
            case 'CoutStatement': {
                let combinedOutput = '';
                for (const expr of node.expressions) {
                    if (expr.type === 'Identifier' && expr.name === 'endl') {
                        this.output += '\n';
                        combinedOutput += '\\n';
                    } else {
                        const val = this.evaluate(expr);
                        this.output += String(val);
                        combinedOutput += String(val);
                    }
                }
                this.addStep(node.line, 'output', `Output: ${combinedOutput}`);
                break;
            }
                
            case 'Assignment':
                this.executeAssignment(node.target, node.operator, node.value, node.line);
                break;
                
            case 'ExpressionStatement':
                this.evaluate(node.expression);
                break;
                
            case 'IfStatement': {
                const cond = this.evaluate(node.condition);
                if (cond) {
                    this.addStep(node.line, 'condition-true', `If condition → true`);
                    this.execute(node.consequent);
                } else {
                    this.addStep(node.line, 'condition-false', `If condition → false`);
                    if (node.alternate) {
                        this.execute(node.alternate);
                    }
                }
                break;
            }
                
            
            case 'RangeForStatement': {
                const containerVar = this.evaluate(node.container);
                // in some cases evaluate() might return the variable's value array/object, 
                // but let's check what evaluate() actually returns.
                // Oh wait, for node.container, evaluate() returns the value of the container.
                // If it's a map or set or vector, evaluate() returns the .value array or object.
                let items = [];
                if (Array.isArray(containerVar)) {
                    items = containerVar;
                } else if (containerVar && typeof containerVar === 'object') {
                    for (let key in containerVar) {
                        items.push({ first: isNaN(Number(key)) ? key : Number(key), second: containerVar[key] });
                    }
                }

                this.pushScope();
                try {
                    for (let i = 0; i < items.length; i++) {
                        const item = items[i];
                        // If it's a map pair, it might need to act as an object
                        this.declareVariable(node.variableName, node.variableType, item, false);
                        this.addStep(node.line, 'loop-check', `Range for: ${node.variableName}`);
                        
                        try {
                            this.execute(node.body);
                        } catch (e) {
                            if (e === this.BREAK) break;
                            if (e === this.CONTINUE) { /* fall through */ }
                            else throw e;
                        }
                    }
                } finally {
                    this.popScope();
                }
                break;
            }
            case 'ForStatement':
                this.pushScope();
                try {
                    if (node.init) this.execute(node.init);
                    
                    while (true) {
                        let cond = true;
                        if (node.condition) {
                            cond = this.evaluate(node.condition);
                            this.addStep(node.condition.line || node.line, 'loop-check', `For loop: condition → ${cond}`);
                        }
                        if (!cond) break;
                        
                        try {
                            this.execute(node.body);
                        } catch (e) {
                            if (e === this.BREAK) break;
                            if (e === this.CONTINUE) { /* fall through to update */ }
                            else throw e;
                        }
                        
                        if (node.update) {
                            this.evaluate(node.update);
                            this.addStep(node.update.line || node.line, 'loop-update', `For loop: update`);
                        }
                    }
                } finally {
                    this.popScope();
                }
                break;
                
            case 'WhileStatement':
                while (true) {
                    const cond = this.evaluate(node.condition);
                    this.addStep(node.line, 'loop-check', `While: condition → ${cond}`);
                    if (!cond) break;
                    
                    try {
                        this.execute(node.body);
                    } catch (e) {
                        if (e === this.BREAK) break;
                        if (e === this.CONTINUE) continue;
                        throw e;
                    }
                }
                break;
                
            case 'ReturnStatement':
                if (node.value) {
                    this.returnValue = this.evaluate(node.value);
                } else {
                    this.returnValue = null;
                }
                this.addStep(node.line, 'return', `Return ${this.returnValue !== null ? this.returnValue : ''}`);
                throw this.RETURN;
                
            case 'BreakStatement':
                throw this.BREAK;
                
            case 'ContinueStatement':
                throw this.CONTINUE;
        }
    }

    executeAssignment(target, operator, valueNode, line) {
        const val = this.evaluate(valueNode);
        
        if (target.type === 'Identifier') {
            let v;
            try {
                v = this.getVariable(target.name);
            } catch (e) {
                // Auto-declare (Python style)
                this.declareVariable(target.name, 'auto', val);
                this.addStep(line, 'assign', `${target.name} = ${val}`, target.name);
                return val;
            }
            let newVal = val;
            if (operator === '+=') newVal = v.value + val;
            else if (operator === '-=') newVal = v.value - val;
            else if (operator === '*=') newVal = v.value * val;
            else if (operator === '/=') newVal = (typeof v.value === 'number' && Number.isInteger(v.value)) ? Math.trunc(v.value / val) : v.value / val;
            else if (operator === '%=') newVal = v.value % val;
            
            this.updateVariable(target.name, newVal);
            this.addStep(line, 'assign', `${target.name} = ${newVal}`, target.name);
            return newVal;
        } else if (target.type === 'ArrayAccess') {
            const name = target.object.name;
            const index = this.evaluate(target.index);
            const v = this.getVariable(name);
            
            // Map/dict access via [] operator
            if (v.isMap) {
                let newVal = val;
                if (operator === '+=') newVal = (v.value[index] || 0) + val;
                else if (operator === '-=') newVal = (v.value[index] || 0) - val;
                else if (operator === '*=') newVal = (v.value[index] || 0) * val;
                v.value[String(index)] = newVal;
                this.addStep(line, 'assign', `${name}[${index}] = ${newVal}`, name);
                return newVal;
            }
            
            let newVal = val;
            if (operator === '+=') newVal = v.value[index] + val;
            else if (operator === '-=') newVal = v.value[index] - val;
            else if (operator === '*=') newVal = v.value[index] * val;
            else if (operator === '/=') newVal = Math.trunc(v.value[index] / val);
            else if (operator === '%=') newVal = v.value[index] % val;
            
            v.value[index] = newVal;
            this.addStep(line, 'assign', `${name}[${index}] = ${newVal}`, name, index);
            return newVal;
        }
        throw new Error("Invalid assignment target");
    }

    evaluate(node) {
        if (!node) return null;
        
        switch (node.type) {
            case 'NumericLiteral':
            case 'StringLiteral':
            case 'BooleanLiteral':
            case 'CharLiteral':
            case 'NullLiteral':
                return node.value;
                
            case 'Identifier':
                try {
                    return this.getVariable(node.name).value;
                } catch {
                    return null;
                }
                
            
            case 'MemberAccess': {
                const obj = this.evaluate(node.object);
                if (obj && typeof obj === 'object') {
                    return obj[node.member];
                }
                if (typeof obj === 'string' && node.member === 'length') return obj.length;
                return null;
            }
            case 'ArrayAccess': {
                const index = this.evaluate(node.index);
                if (node.object.type === 'Identifier') {
                    try {
                        const v = this.getVariable(node.object.name);
                        // Map [] lookup
                        if (v.isMap) {
                            return v.value[String(index)] ?? 0;
                        }
                        return v.value[index];
                    } catch (e) {
                        return null;
                    }
                }
                const arr = this.evaluate(node.object);
                if (Array.isArray(arr)) return arr[index];
                throw new Error("Invalid array access");
            }
                
            case 'BinaryExpression': {
                const left = this.evaluate(node.left);
                const right = this.evaluate(node.right);
                switch (node.operator) {
                    case '+': return left + right;
                    case '-': return left - right;
                    case '*': return left * right;
                    case '/': return (typeof left === 'number' && Number.isInteger(left) && typeof right === 'number' && Number.isInteger(right)) ? Math.trunc(left / right) : left / right;
                    case '%': return left % right;
                    case '==': return left == right;
                    case '!=': return left != right;
                    case '<': return left < right;
                    case '>': return left > right;
                    case '<=': return left <= right;
                    case '>=': return left >= right;
                    case '&&': return left && right;
                    case '||': return left || right;
                    case '&': return left & right;
                    case '|': return left | right;
                    case '^': return left ^ right;
                    case '<<': return left << right;
                    case '>>': return left >> right;
                }
                throw new Error(`Unknown operator ${node.operator}`);
            }
                
            case 'UnaryExpression': {
                const op = this.evaluate(node.operand);
                if (node.operator === '-') return -op;
                if (node.operator === '+') return +op;
                if (node.operator === '!') return !op;
                if (node.operator === '~') return ~op;
                throw new Error(`Unknown unary operator ${node.operator}`);
            }
                
            case 'UpdateExpression': {
                if (node.argument.type === 'Identifier') {
                    const name = node.argument.name;
                    const v = this.getVariable(name);
                    const oldVal = v.value;
                    const newVal = node.operator === '++' ? oldVal + 1 : oldVal - 1;
                    this.updateVariable(name, newVal);
                    return node.prefix ? newVal : oldVal;
                } else if (node.argument.type === 'ArrayAccess') {
                    const name = node.argument.object.name;
                    const index = String(this.evaluate(node.argument.index));
                    const v = this.getVariable(name);
                    let oldVal = v.isMap ? (v.value[index] || 0) : v.value[index];
                    const newVal = node.operator === '++' ? oldVal + 1 : oldVal - 1;
                    v.value[index] = newVal;
                    return node.prefix ? newVal : oldVal;
                }
                throw new Error("Invalid update target");
            }
                
            case 'AssignmentExpression':
                return this.executeAssignment(node.target, node.operator, node.value, node.line);
                
            case 'FunctionCall': {
                const callee = node.callee;
                const args = node.arguments;
                
                // Built-in: sort
                if (callee === 'sort') {
                    let arrName = null;
                    if (args[0] && args[0].type === 'MethodCall') arrName = args[0].object.name;
                    else if (args[0] && args[0].type === 'Identifier') arrName = args[0].name;
                    if (arrName) {
                        try {
                            const v = this.getVariable(arrName);
                            if (v.isArray) {
                                v.value.sort((a, b) => a - b);
                                this.addStep(node.line, 'assign', `Sorted ${arrName}`, arrName);
                            }
                        } catch(e) {}
                    }
                    return null;
                }
                
                // Built-in: swap
                if (callee === 'swap') {
                    if (args.length === 2) {
                        let refA = this.resolveReference(args[0]);
                        let refB = this.resolveReference(args[1]);
                        if (refA && refB) {
                            let temp = refA.get();
                            refA.set(refB.get());
                            refB.set(temp);
                            this.addStep(node.line, 'assign', `Swapped ${refA.name} ↔ ${refB.name}`);
                        }
                    }
                    return null;
                }
                
                // Built-in: max, min, abs, sqrt, pow, ceil, floor, log
                if (callee === 'max' && args.length >= 2) return Math.max(this.evaluate(args[0]), this.evaluate(args[1]));
                if (callee === 'min' && args.length >= 2) return Math.min(this.evaluate(args[0]), this.evaluate(args[1]));
                if (callee === 'abs' && args.length === 1) return Math.abs(this.evaluate(args[0]));
                if (callee === 'sqrt') return Math.sqrt(this.evaluate(args[0]));
                if (callee === 'pow') return Math.pow(this.evaluate(args[0]), this.evaluate(args[1]));
                if (callee === 'ceil') return Math.ceil(this.evaluate(args[0]));
                if (callee === 'floor') return Math.floor(this.evaluate(args[0]));
                if (callee === 'log') return Math.log(this.evaluate(args[0]));
                if (callee === 'log2') return Math.log2(this.evaluate(args[0]));
                if (callee === '__gcd' || callee === 'gcd') {
                    let a = Math.abs(this.evaluate(args[0])), b = Math.abs(this.evaluate(args[1]));
                    while (b) { [a, b] = [b, a % b]; }
                    return a;
                }

                // User-defined function
                if (this.functions.has(callee)) {
                    const func = this.functions.get(callee);
                    const evalArgs = args.map(a => this.evaluate(a));
                    
                    const callSig = `${callee}(${evalArgs.join(', ')})`;
                    this.callStack.push(callSig);
                    
                    this.pushScope();
                    for (let i = 0; i < func.params.length; i++) {
                        const pName = func.params[i].name;
                        const pType = func.params[i].type;
                        const pVal = i < evalArgs.length ? evalArgs[i] : this.getDefaultValue(pType);
                        this.declareVariable(pName, pType, pVal);
                    }
                    
                    this.addStep(node.line, 'call', `Calling ${callSig}`);
                    
                    // ── BUG FIX: save/restore returnValue so recursive calls don't clobber it ──
                    const savedReturnValue = this.returnValue;
                    this.returnValue = null;
                    
                    try {
                        this.execute(func.body);
                    } catch (e) {
                        if (e === this.RETURN) {
                            const ret = this.returnValue;
                            this.popScope();
                            this.callStack.pop();
                            this.addStep(node.line, 'call-return', `${callee}() returned ${ret !== null ? ret : 'void'}`);
                            this.returnValue = savedReturnValue; // restore parent frame's value
                            return ret;
                        }
                        this.returnValue = savedReturnValue;
                        throw e;
                    }
                    
                    this.popScope();
                    this.callStack.pop();
                    this.addStep(node.line, 'call-return', `${callee}() returned`);
                    this.returnValue = savedReturnValue;
                    return null;
                }
                
                // Unknown functions — skip silently
                return null;
            }
            
            case 'MethodCall': {
                if (node.object.type === 'Identifier') {
                    const objName = node.object.name;
                    const method = node.method;
                    try {
                        const v = this.getVariable(objName);

                        // ── Stack methods ─────────────────────────────────────────
                        if (v.isStack) {
                            if (method === 'push') {
                                const val = this.evaluate(node.arguments[0]);
                                v.value.push(val);
                                v.size = v.value.length;
                                this.addStep(node.line, 'assign', `${objName}.push(${val})`, objName);
                                return null;
                            } else if (method === 'pop') {
                                v.value.pop();
                                v.size = v.value.length;
                                this.addStep(node.line, 'assign', `${objName}.pop()`, objName);
                                return null;
                            } else if (method === 'top') {
                                return v.value.length > 0 ? v.value[v.value.length - 1] : null;
                            } else if (method === 'empty') {
                                return v.value.length === 0;
                            } else if (method === 'size') {
                                return v.value.length;
                            }
                        }

                        // ── Queue methods ─────────────────────────────────────────
                        if (v.isQueue) {
                            if (method === 'push') {
                                const val = this.evaluate(node.arguments[0]);
                                v.value.push(val);
                                v.size = v.value.length;
                                this.addStep(node.line, 'assign', `${objName}.push(${val})`, objName);
                                return null;
                            } else if (method === 'pop') {
                                v.value.shift();
                                v.size = v.value.length;
                                this.addStep(node.line, 'assign', `${objName}.pop()`, objName);
                                return null;
                            } else if (method === 'front') {
                                return v.value.length > 0 ? v.value[0] : null;
                            } else if (method === 'back') {
                                return v.value.length > 0 ? v.value[v.value.length - 1] : null;
                            } else if (method === 'empty') {
                                return v.value.length === 0;
                            } else if (method === 'size') {
                                return v.value.length;
                            }
                        }

                        // ── Set methods ───────────────────────────────────────────
                        if (v.isSet) {
                            if (method === 'insert') {
                                const val = this.evaluate(node.arguments[0]);
                                if (!v.value.includes(val)) {
                                    v.value.push(val);
                                    v.value.sort((a, b) => a - b);
                                }
                                v.size = v.value.length;
                                this.addStep(node.line, 'assign', `${objName}.insert(${val})`, objName);
                                return null;
                            } else if (method === 'erase') {
                                const val = this.evaluate(node.arguments[0]);
                                const idx = v.value.indexOf(val);
                                if (idx !== -1) v.value.splice(idx, 1);
                                v.size = v.value.length;
                                this.addStep(node.line, 'assign', `${objName}.erase(${val})`, objName);
                                return null;
                            } else if (method === 'count' || method === 'find') {
                                const val = this.evaluate(node.arguments[0]);
                                return v.value.includes(val) ? 1 : 0;
                            } else if (method === 'size') {
                                return v.value.length;
                            } else if (method === 'empty') {
                                return v.value.length === 0;
                            }
                        }

                        // ── Map methods ───────────────────────────────────────────
                        if (v.isMap) {
                            if (method === 'count' || method === 'find') {
                                const key = String(this.evaluate(node.arguments[0]));
                                return key in v.value ? 1 : 0;
                            } else if (method === 'erase') {
                                const key = String(this.evaluate(node.arguments[0]));
                                delete v.value[key];
                                this.addStep(node.line, 'assign', `${objName}.erase(${key})`, objName);
                                return null;
                            } else if (method === 'size') {
                                return Object.keys(v.value).length;
                            } else if (method === 'empty') {
                                return Object.keys(v.value).length === 0;
                            } else if (method === 'clear') {
                                v.value = {};
                                this.addStep(node.line, 'assign', `${objName}.clear()`, objName);
                                return null;
                            }
                        }

                        // ── Vector/Array methods ──────────────────────────────────
                        if (v.isArray) {
                            if (method === 'push_back' || method === 'pb') {
                                const val = this.evaluate(node.arguments[0]);
                                v.value.push(val);
                                v.size = v.value.length;
                                this.addStep(node.line, 'assign', `${objName}.push_back(${val})`, objName, v.size - 1);
                                return null;
                            } else if (method === 'pop_back') {
                                v.value.pop();
                                v.size = v.value.length;
                                this.addStep(node.line, 'assign', `${objName}.pop_back()`, objName);
                                return null;
                            } else if (method === 'size') {
                                return v.value.length;
                            } else if (method === 'clear') {
                                v.value = [];
                                v.size = 0;
                                this.addStep(node.line, 'assign', `${objName}.clear()`, objName);
                                return null;
                            } else if (method === 'empty') {
                                return v.value.length === 0;
                            } else if (method === 'back') {
                                return v.value[v.value.length - 1];
                            } else if (method === 'front') {
                                return v.value[0];
                            } else if (method === 'begin' || method === 'end') {
                                return null;
                            }
                        }
                    } catch (e) {}
                }
                return null;
            }
        }
        throw new Error(`Unknown expression type: ${node.type}`);
    }

    resolveReference(node) {
        if (node.type === 'Identifier') {
            return {
                name: node.name,
                get: () => this.getVariable(node.name).value,
                set: (val) => this.updateVariable(node.name, val)
            };
        }
        if (node.type === 'ArrayAccess' && node.object.type === 'Identifier') {
            const arrName = node.object.name;
            const index = this.evaluate(node.index);
            return {
                name: `${arrName}[${index}]`,
                get: () => this.getVariable(arrName).value[index],
                set: (val) => { this.getVariable(arrName).value[index] = val; }
            };
        }
        return null;
    }
}

module.exports = { Interpreter };
