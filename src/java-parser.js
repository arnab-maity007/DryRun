class Tokenizer {
    constructor(input) {
        this.input = input;
        this.pos = 0;
        this.line = 1;
        this.tokens = [];
        this.tokenize();
    }

    tokenize() {
        while (this.pos < this.input.length) {
            let char = this.input[this.pos];

            if (/\s/.test(char)) {
                if (char === '\n') this.line++;
                this.pos++;
                continue;
            }

            if (char === '/' && this.input[this.pos + 1] === '/') {
                while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
                    this.pos++;
                }
                continue;
            }

            if (char === '/' && this.input[this.pos + 1] === '*') {
                this.pos += 2;
                while (this.pos < this.input.length && !(this.input[this.pos] === '*' && this.input[this.pos + 1] === '/')) {
                    if (this.input[this.pos] === '\n') this.line++;
                    this.pos++;
                }
                this.pos += 2;
                continue;
            }

            if (/[a-zA-Z_$]/.test(char)) {
                let start = this.pos;
                while (this.pos < this.input.length && /[a-zA-Z0-9_$]/.test(this.input[this.pos])) {
                    this.pos++;
                }
                let value = this.input.substring(start, this.pos);
                this.tokens.push({ type: 'Identifier', value, line: this.line });
                continue;
            }

            if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(this.input[this.pos + 1]))) {
                let start = this.pos;
                while (this.pos < this.input.length && /[0-9.efEFxXlLbB]/.test(this.input[this.pos])) {
                    this.pos++;
                }
                let value = this.input.substring(start, this.pos);
                this.tokens.push({ type: 'Number', value, line: this.line });
                continue;
            }

            if (char === '"' || char === "'") {
                let quote = char;
                let start = this.pos;
                this.pos++;
                while (this.pos < this.input.length && this.input[this.pos] !== quote) {
                    if (this.input[this.pos] === '\\') this.pos++;
                    this.pos++;
                }
                this.pos++;
                let value = this.input.substring(start, this.pos);
                this.tokens.push({ type: 'String', value, line: this.line });
                continue;
            }

            // Two-character operators
            let twoChar = this.input.substring(this.pos, this.pos + 2);
            let twoCharOps = ['==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '%='];
            if (twoCharOps.includes(twoChar)) {
                this.tokens.push({ type: 'Operator', value: twoChar, line: this.line });
                this.pos += 2;
                continue;
            }

            // Single character tokens
            if ('+-*/%=<>!&|^~?'.includes(char)) {
                this.tokens.push({ type: 'Operator', value: char, line: this.line });
                this.pos++;
                continue;
            }

            if ('(){}[].,;:'.includes(char)) {
                this.tokens.push({ type: 'Punctuation', value: char, line: this.line });
                this.pos++;
                continue;
            }

            // Unknown character
            this.pos++;
        }
        this.tokens.push({ type: 'EOF', value: 'EOF', line: this.line });
    }
}

class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
        this.scanners = new Set();
    }

    peek(offset = 0) {
        if (this.pos + offset >= this.tokens.length) return this.tokens[this.tokens.length - 1];
        return this.tokens[this.pos + offset];
    }

    consume() {
        if (this.pos < this.tokens.length) return this.tokens[this.pos++];
        return this.tokens[this.tokens.length - 1];
    }

    match(type, value = null) {
        let t = this.peek();
        if (t.type === type && (value === null || t.value === value)) {
            return true;
        }
        return false;
    }

    expect(type, value = null) {
        let t = this.peek();
        if (t.type === type && (value === null || t.value === value)) {
            return this.consume();
        }
        // Recover gracefully
        return { type: 'Error', value: 'Error', line: t.line };
    }

    parseProgram() {
        let body = [];
        let pLine = this.peek().line;
        
        while (!this.match('EOF')) {
            try {
                if (this.match('Identifier', 'import') || this.match('Identifier', 'package')) {
                    while (!this.match('Punctuation', ';') && !this.match('EOF')) {
                        this.consume();
                    }
                    this.consume(); // consume ';'
                    continue;
                }

                // Skip modifiers
                while (this.match('Identifier', 'public') || this.match('Identifier', 'private') || 
                       this.match('Identifier', 'protected') || this.match('Identifier', 'static') ||
                       this.match('Identifier', 'final')) {
                    this.consume();
                }

                if (this.match('Identifier', 'class')) {
                    this.consume(); // 'class'
                    this.consume(); // name
                    if (this.match('Punctuation', '{')) {
                        this.consume();
                        let methods = this.parseClassBody();
                        body.push(...methods);
                        continue;
                    }
                }
                
                // Unhandled token at top level
                this.consume();
            } catch (e) {
                // simple recovery
                this.consume();
            }
        }
        return { type: 'Program', body, line: pLine };
    }

    parseClassBody() {
        let methods = [];
        while (!this.match('Punctuation', '}') && !this.match('EOF')) {
            try {
                // Skip modifiers
                while (this.match('Identifier', 'public') || this.match('Identifier', 'private') || 
                       this.match('Identifier', 'protected') || this.match('Identifier', 'static') ||
                       this.match('Identifier', 'final')) {
                    this.consume();
                }

                if (this.match('Identifier', 'class')) {
                    // inner class, skip for now
                    while (!this.match('Punctuation', '}') && !this.match('EOF')) this.consume();
                    if (this.match('Punctuation', '}')) this.consume();
                    continue;
                }
                
                // Function or field
                let type = this.parseType();
                if (!type) {
                    this.consume();
                    continue;
                }
                
                let name = this.consume().value;
                if (this.match('Punctuation', '(')) {
                    // Function
                    let func = this.parseFunction(type, name);
                    if (func) methods.push(func);
                } else {
                    // Field, skip for now
                    while (!this.match('Punctuation', ';') && !this.match('EOF')) this.consume();
                    if (this.match('Punctuation', ';')) this.consume();
                }
            } catch (e) {
                this.consume();
            }
        }
        if (this.match('Punctuation', '}')) this.consume();
        return methods;
    }
    
    parseType() {
        if (this.match('Identifier')) {
            let t = this.consume().value;
            if (this.match('Operator', '<')) {
                // Generics
                this.consume(); // <
                while (!this.match('Operator', '>') && !this.match('EOF')) {
                    this.consume();
                }
                if (this.match('Operator', '>')) this.consume();
            }
            while (this.match('Punctuation', '[')) {
                this.consume(); // [
                if (this.match('Punctuation', ']')) this.consume(); // ]
                t += '[]';
            }
            return t;
        }
        return null;
    }

    parseFunction(returnType, name) {
        let line = this.peek().line;
        this.expect('Punctuation', '(');
        let params = [];
        if (!this.match('Punctuation', ')')) {
            while (!this.match('EOF')) {
                let pType = this.parseType();
                let pName = this.consume().value;
                params.push({ type: pType, name: pName });
                if (this.match('Punctuation', ',')) {
                    this.consume();
                } else {
                    break;
                }
            }
        }
        this.expect('Punctuation', ')');
        
        let throwsBlock = false;
        if (this.match('Identifier', 'throws')) {
            this.consume();
            while(!this.match('Punctuation', '{') && !this.match('EOF')) this.consume();
        }

        let body = this.parseBlock();
        return {
            type: 'FunctionDeclaration',
            returnType,
            name,
            params,
            body,
            line
        };
    }

    parseBlock() {
        let line = this.peek().line;
        this.expect('Punctuation', '{');
        let body = [];
        while (!this.match('Punctuation', '}') && !this.match('EOF')) {
            let stmt = this.parseStatement();
            if (stmt) {
                if (Array.isArray(stmt)) body.push(...stmt);
                else body.push(stmt);
            }
        }
        this.expect('Punctuation', '}');
        return { type: 'Block', body, line };
    }

    parseStatement() {
        try {
            if (this.match('Punctuation', '{')) return this.parseBlock();
            
            if (this.match('Identifier', 'if')) return this.parseIf();
            if (this.match('Identifier', 'while')) return this.parseWhile();
            if (this.match('Identifier', 'for')) return this.parseFor();
            if (this.match('Identifier', 'do')) return this.parseDoWhile();
            if (this.match('Identifier', 'return')) return this.parseReturn();
            if (this.match('Identifier', 'break')) {
                let line = this.consume().line;
                this.expect('Punctuation', ';');
                return { type: 'BreakStatement', line };
            }
            if (this.match('Identifier', 'continue')) {
                let line = this.consume().line;
                this.expect('Punctuation', ';');
                return { type: 'ContinueStatement', line };
            }

            // Try parsing declaration
            let lookahead = this.pos;
            let isDecl = false;
            let t = this.parseType();
            if (t && this.match('Identifier')) {
                let n = this.peek().value;
                isDecl = true;
                this.pos = lookahead;
            } else {
                this.pos = lookahead;
            }

            if (isDecl) {
                return this.parseDeclaration();
            }

            // System.out.print / println
            if (this.match('Identifier', 'System')) {
                if (this.peek(1).value === '.' && this.peek(2).value === 'out') {
                    return this.parsePrint();
                }
            }
            
            // Expression statement
            let line = this.peek().line;
            let expr = this.parseExpression();
            this.expect('Punctuation', ';');
            return { type: 'ExpressionStatement', expression: expr, line };
            
        } catch (e) {
            while (!this.match('Punctuation', ';') && !this.match('Punctuation', '}') && !this.match('EOF')) {
                this.consume();
            }
            if (this.match('Punctuation', ';')) this.consume();
            return null;
        }
    }

    parseDeclaration() {
        let line = this.peek().line;
        let type = this.parseType();
        let name = this.expect('Identifier').value;
        
        let initializer = null;
        if (this.match('Operator', '=')) {
            this.consume(); // =
            
            // Scanner handling
            if (this.match('Identifier', 'new') && this.peek(1).value === 'Scanner') {
                this.scanners.add(name);
                while (!this.match('Punctuation', ';') && !this.match('EOF')) this.consume();
                this.consume(); // ;
                return null;
            }
            
            initializer = this.parseExpression();
        }
        
        this.expect('Punctuation', ';');
        
        // Handle input conversion: int n = sc.nextInt(); -> VarDecl(no init) + Cin
        if (initializer && initializer.type === 'MethodCall' && 
            this.scanners.has(initializer.callee.object.name)) {
            let method = initializer.callee.property.name;
            if (method.startsWith('next')) {
                return [
                    {
                        type: 'VariableDeclaration',
                        dataType: type,
                        declarations: [{ name, initializer: null }],
                        line
                    },
                    {
                        type: 'CinStatement',
                        targets: [{ type: 'Identifier', name: name, line }],
                        line
                    }
                ];
            }
        }
        
        // Handle new Array
        if (initializer && initializer.type === 'NewArray') {
             return {
                 type: 'ArrayDeclaration',
                 elementType: initializer.elementType,
                 name: name,
                 sizeExpr: initializer.sizeExpr,
                 line
             };
        }

        // Handle Vector/ArrayList
        if (type.includes('ArrayList') || type.includes('Queue') || type.includes('Stack') || type.includes('List')) {
             return {
                 type: 'VectorDeclaration',
                 elementType: 'auto',
                 name: name,
                 sizeExpr: null,
                 fillExpr: null,
                 initList: null,
                 line
             };
        }

        let baseType = type.toLowerCase();
        if (baseType.includes('map')) baseType = 'map';
        if (baseType.includes('set')) baseType = 'set';

        return {
            type: 'VariableDeclaration',
            dataType: baseType,
            declarations: [{ name, initializer }],
            line
        };
    }

    parsePrint() {
        let line = this.peek().line;
        this.consume(); // System
        this.consume(); // .
        this.consume(); // out
        this.consume(); // .
        let method = this.consume().value; // print or println
        this.expect('Punctuation', '(');
        
        let expressions = [];
        if (!this.match('Punctuation', ')')) {
            expressions.push(this.parseExpression());
        }
        if (method === 'println') {
            expressions.push({ type: 'Identifier', name: 'endl', line });
        }
        
        this.expect('Punctuation', ')');
        this.expect('Punctuation', ';');
        
        return {
            type: 'CoutStatement',
            expressions,
            line
        };
    }

    parseIf() {
        let line = this.peek().line;
        this.consume(); // if
        this.expect('Punctuation', '(');
        let condition = this.parseExpression();
        this.expect('Punctuation', ')');
        let consequent = this.parseStatement();
        let alternate = null;
        if (this.match('Identifier', 'else')) {
            this.consume();
            alternate = this.parseStatement();
        }
        return { type: 'IfStatement', condition, consequent, alternate, line };
    }

    parseWhile() {
        let line = this.peek().line;
        this.consume(); // while
        this.expect('Punctuation', '(');
        let condition = this.parseExpression();
        this.expect('Punctuation', ')');
        let body = this.parseStatement();
        return { type: 'WhileStatement', condition, body, line };
    }
    
    parseDoWhile() {
        let line = this.peek().line;
        this.consume(); // do
        let body = this.parseStatement();
        this.expect('Identifier', 'while');
        this.expect('Punctuation', '(');
        let condition = this.parseExpression();
        this.expect('Punctuation', ')');
        this.expect('Punctuation', ';');
        return { type: 'WhileStatement', condition, body, line }; // mapped to normal while for AST compatibility if needed or block
    }

    parseFor() {
        let line = this.peek().line;
        this.consume(); // for
        this.expect('Punctuation', '(');
        
        let isEnhanced = false;
        let lookahead = this.pos;
        let t = this.parseType();
        if (t && this.match('Identifier') && this.peek(1).value === ':') {
            isEnhanced = true;
        }
        this.pos = lookahead;

        if (isEnhanced) {
            let type = this.parseType();
            let name = this.consume().value;
            this.expect('Punctuation', ':');
            let array = this.parseExpression();
            this.expect('Punctuation', ')');
            let body = this.parseStatement();
            
            // Map enhanced for loop to traditional for loop
            let iName = '_i_' + name;
            let init = {
                type: 'VariableDeclaration',
                dataType: 'int',
                declarations: [{name: iName, initializer: { type: 'NumericLiteral', value: '0', line }}],
                line
            };
            let condition = {
                type: 'BinaryExpression',
                operator: '<',
                left: { type: 'Identifier', name: iName, line },
                right: { type: 'Identifier', name: array.name + '.length', line },
                line
            };
            let update = {
                type: 'UpdateExpression',
                operator: '++',
                argument: { type: 'Identifier', name: iName, line },
                prefix: false,
                line
            };
            let assign = {
                type: 'VariableDeclaration',
                dataType: type,
                declarations: [{
                    name: name,
                    initializer: { type: 'ArrayAccess', object: array, index: { type: 'Identifier', name: iName, line }, line }
                }],
                line
            };
            
            let newBody = {
                type: 'Block',
                body: [assign],
                line
            };
            if (body.type === 'Block') {
                newBody.body.push(...body.body);
            } else {
                newBody.body.push(body);
            }
            
            return { type: 'ForStatement', init, condition, update, body: newBody, line };
        }
        
        let init = null;
        if (!this.match('Punctuation', ';')) {
            init = this.parseDeclarationOrExpression();
        } else {
            this.consume(); // ;
        }
        
        let condition = null;
        if (!this.match('Punctuation', ';')) {
            condition = this.parseExpression();
        }
        this.expect('Punctuation', ';');
        
        let update = null;
        if (!this.match('Punctuation', ')')) {
            update = this.parseExpression();
        }
        this.expect('Punctuation', ')');
        
        let body = this.parseStatement();
        return { type: 'ForStatement', init, condition, update, body, line };
    }

    parseDeclarationOrExpression() {
        let lookahead = this.pos;
        let t = this.parseType();
        if (t && this.match('Identifier')) {
            this.pos = lookahead;
            return this.parseDeclaration();
        }
        this.pos = lookahead;
        let expr = this.parseExpression();
        this.expect('Punctuation', ';');
        return { type: 'ExpressionStatement', expression: expr, line: expr.line };
    }

    parseReturn() {
        let line = this.peek().line;
        this.consume();
        let value = null;
        if (!this.match('Punctuation', ';')) {
            value = this.parseExpression();
        }
        this.expect('Punctuation', ';');
        return { type: 'ReturnStatement', value, line };
    }

    // Expression parsing (recursive descent)
    parseExpression() {
        return this.parseAssignment();
    }

    parseAssignment() {
        let left = this.parseLogicalOr();
        if (this.match('Operator', '=') || this.match('Operator', '+=') || this.match('Operator', '-=') ||
            this.match('Operator', '*=') || this.match('Operator', '/=') || this.match('Operator', '%=')) {
            let line = this.peek().line;
            let op = this.consume().value;
            
            // Scanner support for assignment
            if (op === '=' && this.match('Identifier')) {
                let rightId = this.peek().value;
                if (this.scanners.has(rightId) && this.peek(1).value === '.' && this.peek(2).value.startsWith('next')) {
                    this.consume(); // scanner name
                    this.consume(); // .
                    this.consume(); // method
                    this.consume(); // (
                    this.consume(); // )
                    return {
                        type: 'CinStatement',
                        targets: [left],
                        line
                    };
                }
            }
            
            let right = this.parseAssignment();
            return { type: 'AssignmentExpression', target: left, operator: op, value: right, line: left.line };
        }
        return left;
    }

    parseLogicalOr() {
        let left = this.parseLogicalAnd();
        while (this.match('Operator', '||')) {
            let op = this.consume().value;
            let right = this.parseLogicalAnd();
            left = { type: 'BinaryExpression', operator: op, left, right, line: left.line };
        }
        return left;
    }

    parseLogicalAnd() {
        let left = this.parseEquality();
        while (this.match('Operator', '&&')) {
            let op = this.consume().value;
            let right = this.parseEquality();
            left = { type: 'BinaryExpression', operator: op, left, right, line: left.line };
        }
        return left;
    }

    parseEquality() {
        let left = this.parseRelational();
        while (this.match('Operator', '==') || this.match('Operator', '!=')) {
            let op = this.consume().value;
            let right = this.parseRelational();
            left = { type: 'BinaryExpression', operator: op, left, right, line: left.line };
        }
        return left;
    }

    parseRelational() {
        let left = this.parseAdditive();
        while (this.match('Operator', '<') || this.match('Operator', '>') ||
               this.match('Operator', '<=') || this.match('Operator', '>=')) {
            let op = this.consume().value;
            let right = this.parseAdditive();
            left = { type: 'BinaryExpression', operator: op, left, right, line: left.line };
        }
        return left;
    }

    parseAdditive() {
        let left = this.parseMultiplicative();
        while (this.match('Operator', '+') || this.match('Operator', '-')) {
            let op = this.consume().value;
            let right = this.parseMultiplicative();
            left = { type: 'BinaryExpression', operator: op, left, right, line: left.line };
        }
        return left;
    }

    parseMultiplicative() {
        let left = this.parseUnary();
        while (this.match('Operator', '*') || this.match('Operator', '/') || this.match('Operator', '%')) {
            let op = this.consume().value;
            let right = this.parseUnary();
            left = { type: 'BinaryExpression', operator: op, left, right, line: left.line };
        }
        return left;
    }

    parseUnary() {
        if (this.match('Operator', '++') || this.match('Operator', '--')) {
            let op = this.consume().value;
            let arg = this.parseUnary();
            return { type: 'UpdateExpression', operator: op, argument: arg, prefix: true, line: arg.line };
        }
        if (this.match('Operator', '+') || this.match('Operator', '-') || this.match('Operator', '!')) {
            let op = this.consume().value;
            let arg = this.parseUnary();
            return { type: 'UnaryExpression', operator: op, argument: arg, line: arg.line };
        }
        return this.parsePostfix();
    }

    parsePostfix() {
        let left = this.parsePrimary();
        if (this.match('Operator', '++') || this.match('Operator', '--')) {
            let op = this.consume().value;
            return { type: 'UpdateExpression', operator: op, argument: left, prefix: false, line: left.line };
        }
        return left;
    }

    parsePrimary() {
        let t = this.peek();
        
        if (this.match('Identifier', 'new')) {
            let line = t.line;
            this.consume();
            let type = this.parseType();
            
            if (this.match('Punctuation', '[')) {
                this.consume(); // [
                let sizeExpr = this.parseExpression();
                this.expect('Punctuation', ']');
                // Could be multi-dim, ignore for now
                return { type: 'NewArray', elementType: type, sizeExpr, line };
            }
            if (this.match('Punctuation', '(')) {
                this.consume(); // (
                this.expect('Punctuation', ')');
                return { type: 'NewObject', objectType: type, line };
            }
        }
        
        if (this.match('Number')) {
            let line = t.line;
            return { type: 'NumericLiteral', value: this.consume().value, line };
        }
        if (this.match('String')) {
            let line = t.line;
            let str = this.consume().value;
            return { type: 'StringLiteral', value: str, line };
        }
        if (this.match('Identifier', 'true') || this.match('Identifier', 'false')) {
            let line = t.line;
            let val = this.consume().value === 'true';
            return { type: 'BooleanLiteral', value: val, line };
        }
        if (this.match('Identifier', 'null')) {
            let line = t.line;
            this.consume();
            return { type: 'NullLiteral', line };
        }
        if (this.match('Punctuation', '(')) {
            this.consume();
            let expr = this.parseExpression();
            this.expect('Punctuation', ')');
            return expr;
        }

        let expr;
        if (this.match('Identifier')) {
            let line = t.line;
            expr = { type: 'Identifier', name: this.consume().value, line };
        } else {
            // Error recovery
            this.consume();
            return { type: 'Error', line: t.line };
        }

        // Handle accesses
        while (true) {
            if (this.match('Punctuation', '[')) {
                this.consume();
                let index = this.parseExpression();
                this.expect('Punctuation', ']');
                expr = { type: 'ArrayAccess', object: expr, index, line: expr.line };
            } else if (this.match('Punctuation', '.')) {
                this.consume();
                let prop = this.consume().value;
                if (this.match('Punctuation', '(')) {
                    this.consume(); // (
                    let args = [];
                    if (!this.match('Punctuation', ')')) {
                        args.push(this.parseExpression());
                        while (this.match('Punctuation', ',')) {
                            this.consume();
                            args.push(this.parseExpression());
                        }
                    }
                    this.expect('Punctuation', ')');
                    
                    // Remap Arrays.sort to sort
                    if (expr.name === 'Arrays' && prop === 'sort') {
                        expr = { type: 'FunctionCall', callee: 'sort', arguments: args, line: expr.line };
                    } 
                    // Remap Collections.sort to sort
                    else if (expr.name === 'Collections' && prop === 'sort') {
                        expr = { type: 'FunctionCall', callee: 'sort', arguments: args, line: expr.line };
                    }
                    // Remap Math.xxx to Math.xxx or xxx
                    else if (expr.name === 'Math') {
                        expr = { type: 'FunctionCall', callee: prop, arguments: args, line: expr.line };
                    }
                    else {
                        expr = { 
                            type: 'MethodCall', 
                            callee: { type: 'MemberExpression', object: expr, property: { type: 'Identifier', name: prop, line: expr.line } }, 
                            arguments: args, 
                            line: expr.line 
                        };
                    }
                } else {
                    expr = { type: 'MemberExpression', object: expr, property: { type: 'Identifier', name: prop, line: expr.line }, line: expr.line };
                }
            } else if (this.match('Punctuation', '(')) {
                // Function call
                this.consume(); // (
                let args = [];
                if (!this.match('Punctuation', ')')) {
                    args.push(this.parseExpression());
                    while (this.match('Punctuation', ',')) {
                        this.consume();
                        args.push(this.parseExpression());
                    }
                }
                this.expect('Punctuation', ')');
                expr = { type: 'FunctionCall', callee: expr.name, arguments: args, line: expr.line };
            } else {
                break;
            }
        }
        return expr;
    }
}

function parse(sourceCode) {
    let tokenizer = new Tokenizer(sourceCode);
    let parser = new Parser(tokenizer.tokens);
    return parser.parseProgram();
}

module.exports = { parse };
