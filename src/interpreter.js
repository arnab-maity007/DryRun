const { tokenize } = require('./tokenizer');
const { parse } = require('./parser');
const { preprocess } = require('./preprocessor');

class Interpreter {
    constructor(sourceCode, inputString) {
        this.originalSource = sourceCode;
        // Inject standard macros to make CP code work out of the box
        const standardMacros = `
#define vi vector<int>
#define vll vector<long long>
#define pii pair<int,int>
#define pll pair<long long, long long>
#define pb push_back
#define mp make_pair
#define all(x) x.begin(), x.end()
#define sz(x) (int)(x).size()
#define f(i,a,b) for(int i=a; i<b; i++)
#define rep(i,a,b) for(int i=a; i<b; i++)
`;
        this.processedSource = preprocess(standardMacros + "\n" + sourceCode);
        this.tokens = tokenize(this.processedSource);
        this.ast = parse(this.tokens);
        this.inputTokens = inputString.trim().split(/\s+/).filter(t => t.length > 0);
        this.inputPos = 0;
        
        this.scopes = [new Map()]; // Global scope
        this.output = "";
        this.steps = [];
        this.stepCount = 0;
        this.MAX_STEPS = 10000;
        
        this.functions = new Map();
        
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
                    value: Array.isArray(val.value) ? [...val.value] : val.value,
                    isArray: val.isArray,
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
            highlightIndex
        });
    }

    pushScope() {
        this.scopes.push(new Map());
    }

    popScope() {
        this.scopes.pop();
    }

    declareVariable(name, type, value, isArray = false, size = null) {
        this.scopes[this.scopes.length - 1].set(name, { type, value, isArray, size });
    }

    getVariable(name) {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            if (this.scopes[i].has(name)) {
                return this.scopes[i].get(name);
            }
        }
        throw new Error(`Variable ${name} is not defined`);
    }

    updateVariable(name, value) {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            if (this.scopes[i].has(name)) {
                const v = this.scopes[i].get(name);
                v.value = value;
                return;
            }
        }
        throw new Error(`Variable ${name} is not defined`);
    }

    getDefaultValue(type) {
        if (['int', 'long', 'long long', 'unsigned int', 'unsigned long', 'unsigned long long'].includes(type)) return 0;
        if (['double', 'float'].includes(type)) return 0.0;
        if (type === 'char') return '\0';
        if (type === 'string') return "";
        if (type === 'bool') return false;
        return null;
    }

    run() {
        this.execute(this.ast);
        // If main wasn't executed during global scope traversal, execute it
        if (!this.steps.some(s => s.description === 'Entering main()') && this.functions.has('main')) {
            const mainFunc = this.functions.get('main');
            this.addStep(mainFunc.line, 'skip', 'Entering main()');
            try {
                this.execute(mainFunc.body);
            } catch (e) {
                if (e !== this.RETURN) throw e;
            }
        }
        return this.steps;
    }

    execute(node) {
        if (!node) return;
        
        switch (node.type) {
            case 'Program':
                for (const stmt of node.body) {
                    this.execute(stmt);
                }
                break;
                
            case 'IncludeDirective':
                this.addStep(node.line, 'skip', 'Preprocessor directive');
                break;
                
            case 'UsingDirective':
                this.addStep(node.line, 'skip', 'Using namespace std');
                break;
                
            case 'FunctionDeclaration':
                this.functions.set(node.name, node);
                // We don't execute main inline anymore, we run it at the end to allow global functions before main
                break;
                
            case 'Block':
                this.pushScope();
                for (const stmt of node.body) {
                    this.execute(stmt);
                }
                this.popScope();
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
                
            case 'VectorDeclaration': {
                let size = 0;
                let fill = this.getDefaultValue(node.elementType);
                let valArray = [];
                
                if (node.sizeExpr) {
                    size = this.evaluate(node.sizeExpr);
                    if (node.fillExpr) {
                        fill = this.evaluate(node.fillExpr);
                    }
                    for (let i = 0; i < size; i++) valArray.push(fill);
                } else if (node.initList) {
                    size = node.initList.length;
                    valArray = node.initList.map(e => this.evaluate(e));
                }
                
                this.declareVariable(node.name, `vector<${node.elementType}>`, valArray, true, size);
                this.addStep(node.line, 'declare', `Declared vector<${node.elementType}> ${node.name} of size ${size}`, node.name);
                break;
            }
                
            case 'ArrayDeclaration': {
                const size = this.evaluate(node.sizeExpr);
                const fill = this.getDefaultValue(node.elementType);
                const valArray = new Array(size).fill(fill);
                
                this.declareVariable(node.name, `${node.elementType}[]`, valArray, true, size);
                this.addStep(node.line, 'declare', `Declared array ${node.name} of size ${size}`, node.name);
                break;
            }
                
            case 'CinStatement':
                for (const target of node.targets) {
                    if (this.inputPos >= this.inputTokens.length) {
                        // For CP, if no more input, they usually get 0 or keep going. We'll simulate 0.
                        this.inputTokens.push("0");
                    }
                    const token = this.inputTokens[this.inputPos++];
                    
                    if (target.type === 'Identifier') {
                        const v = this.getVariable(target.name);
                        let parsedVal = token;
                        if (v.type.includes('int') || v.type.includes('long')) parsedVal = parseInt(token, 10);
                        else if (['double', 'float'].includes(v.type)) parsedVal = parseFloat(token);
                        
                        this.updateVariable(target.name, parsedVal);
                        this.addStep(node.line, 'input', `Read input: ${target.name} = ${parsedVal}`, target.name);
                    } else if (target.type === 'ArrayAccess') {
                        const name = target.object.name;
                        const index = this.evaluate(target.index);
                        const v = this.getVariable(name);
                        
                        let parsedVal = token;
                        if (v.type.includes('int') || v.type.includes('long')) parsedVal = parseInt(token, 10);
                        else if (v.type.includes('double') || v.type.includes('float')) parsedVal = parseFloat(token);
                        
                        v.value[index] = parsedVal;
                        this.addStep(node.line, 'input', `Read input: ${name}[${index}] = ${parsedVal}`, name, index);
                    }
                }
                break;
                
            case 'CoutStatement':
                for (const expr of node.expressions) {
                    if (expr.type === 'Identifier' && expr.name === 'endl') {
                        this.output += '\n';
                        this.addStep(node.line, 'output', `Output: endl`);
                    } else {
                        const val = this.evaluate(expr);
                        this.output += val;
                        this.addStep(node.line, 'output', `Output: ${val}`);
                    }
                }
                break;
                
            case 'Assignment':
                this.executeAssignment(node.target, node.operator, node.value, node.line);
                break;
                
            case 'ExpressionStatement':
                this.evaluate(node.expression);
                break;
                
            case 'IfStatement': {
                const cond = this.evaluate(node.condition);
                if (cond) {
                    this.addStep(node.line, 'condition-true', `If condition true`);
                    this.execute(node.consequent);
                } else {
                    this.addStep(node.line, 'condition-false', `If condition false`);
                    if (node.alternate) {
                        this.execute(node.alternate);
                    }
                }
                break;
            }
                
            case 'ForStatement':
                this.pushScope();
                if (node.init) this.execute(node.init);
                
                while (true) {
                    let cond = true;
                    if (node.condition) {
                        cond = this.evaluate(node.condition);
                        this.addStep(node.condition.line || node.line, 'loop-check', `For loop: condition is ${cond}`);
                    }
                    if (!cond) break;
                    
                    try {
                        this.execute(node.body);
                    } catch (e) {
                        if (e === this.BREAK) break;
                        if (e === this.CONTINUE) {
                            // continue logic handles update below
                        } else {
                            throw e;
                        }
                    }
                    
                    if (node.update) {
                        this.evaluate(node.update);
                        this.addStep(node.update.line || node.line, 'loop-update', `For loop update`);
                    }
                }
                this.popScope();
                break;
                
            case 'WhileStatement':
                while (true) {
                    const cond = this.evaluate(node.condition);
                    this.addStep(node.line, 'loop-check', `While loop: condition is ${cond}`);
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
                this.addStep(node.line, 'skip', 'Break loop');
                throw this.BREAK;
                
            case 'ContinueStatement':
                this.addStep(node.line, 'skip', 'Continue loop');
                throw this.CONTINUE;
        }
    }

    executeAssignment(target, operator, valueNode, line) {
        const val = this.evaluate(valueNode);
        
        if (target.type === 'Identifier') {
            const v = this.getVariable(target.name);
            let newVal = val;
            if (operator === '+=') newVal = v.value + val;
            else if (operator === '-=') newVal = v.value - val;
            else if (operator === '*=') newVal = v.value * val;
            else if (operator === '/=') newVal = Math.floor(v.value / val);
            else if (operator === '%=') newVal = v.value % val;
            
            this.updateVariable(target.name, newVal);
            this.addStep(line, 'assign', `Set ${target.name} = ${newVal}`, target.name);
            return newVal;
        } else if (target.type === 'ArrayAccess') {
            const name = target.object.name;
            const index = this.evaluate(target.index);
            const v = this.getVariable(name);
            
            let newVal = val;
            if (operator === '+=') newVal = v.value[index] + val;
            else if (operator === '-=') newVal = v.value[index] - val;
            else if (operator === '*=') newVal = v.value[index] * val;
            else if (operator === '/=') newVal = Math.floor(v.value[index] / val);
            else if (operator === '%=') newVal = v.value[index] % val;
            
            v.value[index] = newVal;
            this.addStep(line, 'assign', `Set ${name}[${index}] = ${newVal}`, name, index);
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
                    // Preprocessor sometimes leaves unhandled stuff or functions used as pointers
                    return null; 
                }
                
            case 'ArrayAccess': {
                const arr = this.evaluate(node.object);
                const index = this.evaluate(node.index);
                if (Array.isArray(arr)) return arr[index];
                
                if (node.object.type === 'Identifier') {
                    const v = this.getVariable(node.object.name);
                    return v.value[index];
                }
                throw new Error("Invalid array access");
            }
                
            case 'BinaryExpression': {
                const left = this.evaluate(node.left);
                const right = this.evaluate(node.right);
                switch (node.operator) {
                    case '+': return left + right;
                    case '-': return left - right;
                    case '*': return left * right;
                    case '/': return Math.floor(left / right);
                    case '%': return left % right;
                    case '==': return left == right;
                    case '!=': return left != right;
                    case '<': return left < right;
                    case '>': return left > right;
                    case '<=': return left <= right;
                    case '>=': return left >= right;
                    case '&&': return left && right;
                    case '||': return left || right;
                }
                throw new Error(`Unknown operator ${node.operator}`);
            }
                
            case 'UnaryExpression': {
                const op = this.evaluate(node.operand);
                if (node.operator === '-') return -op;
                if (node.operator === '+') return +op;
                if (node.operator === '!') return !op;
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
                    const index = this.evaluate(node.argument.index);
                    const v = this.getVariable(name);
                    const oldVal = v.value[index];
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
                
                // Built-in sort: sort(all(arr)) usually evaluates to sort(arr.begin(), arr.end())
                if (callee === 'sort') {
                    // Heuristic: find the array name in the first argument
                    let arrName = null;
                    if (args[0] && args[0].type === 'MethodCall') {
                        arrName = args[0].object.name;
                    } else if (args[0] && args[0].type === 'Identifier') {
                        arrName = args[0].name;
                    }
                    if (arrName) {
                        try {
                            const v = this.getVariable(arrName);
                            if (v.isArray) {
                                v.value.sort((a, b) => a - b);
                                this.addStep(node.line, 'assign', `Sorted array ${arrName}`, arrName);
                            }
                        } catch(e) {}
                    }
                    return null;
                }
                
                // Built-in swap: swap(a, b)
                if (callee === 'swap') {
                    if (args.length === 2) {
                        let refA = this.resolveReference(args[0]);
                        let refB = this.resolveReference(args[1]);
                        if (refA && refB) {
                            let temp = refA.get();
                            refA.set(refB.get());
                            refB.set(temp);
                            this.addStep(node.line, 'assign', `Swapped ${refA.name} and ${refB.name}`);
                        }
                    }
                    return null;
                }
                
                // Built-in max/min
                if (callee === 'max' && args.length === 2) return Math.max(this.evaluate(args[0]), this.evaluate(args[1]));
                if (callee === 'min' && args.length === 2) return Math.min(this.evaluate(args[0]), this.evaluate(args[1]));
                if (callee === 'abs' && args.length === 1) return Math.abs(this.evaluate(args[0]));

                // User-defined function
                if (this.functions.has(callee)) {
                    const func = this.functions.get(callee);
                    const evalArgs = args.map(a => this.evaluate(a));
                    
                    this.pushScope();
                    for (let i = 0; i < func.params.length; i++) {
                        const pName = func.params[i].name;
                        const pType = func.params[i].type;
                        const pVal = i < evalArgs.length ? evalArgs[i] : this.getDefaultValue(pType);
                        this.declareVariable(pName, pType, pVal);
                    }
                    
                    this.addStep(node.line, 'skip', `Calling function ${callee}()`);
                    
                    try {
                        this.execute(func.body);
                    } catch (e) {
                        if (e === this.RETURN) {
                            const ret = this.returnValue;
                            this.popScope();
                            return ret;
                        }
                        throw e;
                    }
                    
                    this.popScope();
                    return null;
                }
                
                // Fallback for unknown functions
                this.addStep(node.line, 'skip', `Called unknown function ${callee}`);
                return null;
            }
            
            case 'MethodCall': {
                if (node.object.type === 'Identifier') {
                    const objName = node.object.name;
                    const method = node.method;
                    try {
                        const v = this.getVariable(objName);
                        if (v.isArray) {
                            if (method === 'push_back' || method === 'pb') {
                                const val = this.evaluate(node.arguments[0]);
                                v.value.push(val);
                                v.size = v.value.length;
                                this.addStep(node.line, 'assign', `Pushed ${val} to ${objName}`, objName, v.size - 1);
                                return null;
                            } else if (method === 'pop_back') {
                                v.value.pop();
                                v.size = v.value.length;
                                this.addStep(node.line, 'assign', `Popped from ${objName}`, objName);
                                return null;
                            } else if (method === 'size') {
                                return v.value.length;
                            } else if (method === 'begin' || method === 'end') {
                                return null; // Used in sort, handled directly there
                            }
                        }
                    } catch (e) {}
                }
                return null;
            }
        }
        throw new Error(`Unknown expression type ${node.type}`);
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
