/**
 * Python Tokenizer and Parser for DryRun CP Visualizer
 * Converts a subset of Python (CP/DSA) into an AST compatible with the DryRun C++ visualizer.
 */

// --- TOKENIZER ---

const TokenType = {
    IDENTIFIER: 'IDENTIFIER',
    NUMBER: 'NUMBER',
    STRING: 'STRING',
    OPERATOR: 'OPERATOR',
    PUNCTUATION: 'PUNCTUATION',
    KEYWORD: 'KEYWORD',
    NEWLINE: 'NEWLINE',
    INDENT: 'INDENT',
    DEDENT: 'DEDENT',
    EOF: 'EOF'
};

const KEYWORDS = new Set([
    'def', 'return', 'if', 'elif', 'else', 'while', 'for', 'in',
    'break', 'continue', 'pass', 'and', 'or', 'not', 'True', 'False', 'None'
]);

const OPERATORS = new Set([
    '+', '-', '*', '/', '//', '%', '**', '=', '==', '!=', '<', '>', '<=', '>=',
    '+=', '-=', '*=', '/=', '//=', '%='
]);

function tokenize(code) {
    const tokens = [];
    const lines = code.split(/\r?\n/);
    const indentStack = [0];
    
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        let line = lines[lineNum];
        const lineIdx = lineNum + 1;
        
        // Remove comments
        const commentIdx = line.indexOf('#');
        if (commentIdx !== -1) {
            line = line.substring(0, commentIdx);
        }
        
        if (line.trim() === '') {
            continue;
        }

        const indentMatch = line.match(/^[ \t]*/);
        const indentStr = indentMatch ? indentMatch[0] : '';
        let indentLevel = 0;
        for (let i = 0; i < indentStr.length; i++) {
            if (indentStr[i] === '\t') indentLevel += 4;
            else indentLevel += 1;
        }

        const currentIndent = indentStack[indentStack.length - 1];
        if (indentLevel > currentIndent) {
            indentStack.push(indentLevel);
            tokens.push({ type: TokenType.INDENT, value: '', line: lineIdx });
        } else if (indentLevel < currentIndent) {
            while (indentStack.length > 1 && indentStack[indentStack.length - 1] > indentLevel) {
                indentStack.pop();
                tokens.push({ type: TokenType.DEDENT, value: '', line: lineIdx });
            }
        }

        let pos = indentStr.length;
        while (pos < line.length) {
            const char = line[pos];

            if (/\s/.test(char)) {
                pos++;
                continue;
            }

            if (char === '"' || char === "'") {
                const quote = char;
                let str = '';
                pos++;
                while (pos < line.length && line[pos] !== quote) {
                    if (line[pos] === '\\') {
                        str += line[pos + 1] || '';
                        pos += 2;
                    } else {
                        str += line[pos];
                        pos++;
                    }
                }
                pos++; // skip closing quote
                tokens.push({ type: TokenType.STRING, value: str, line: lineIdx });
                continue;
            }

            if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(line[pos + 1]))) {
                let numStr = '';
                while (pos < line.length && /[0-9.]/.test(line[pos])) {
                    numStr += line[pos];
                    pos++;
                }
                tokens.push({ type: TokenType.NUMBER, value: parseFloat(numStr), line: lineIdx });
                continue;
            }

            if (/[a-zA-Z_]/.test(char)) {
                let idStr = '';
                while (pos < line.length && /[a-zA-Z0-9_]/.test(line[pos])) {
                    idStr += line[pos];
                    pos++;
                }
                if (KEYWORDS.has(idStr)) {
                    tokens.push({ type: TokenType.KEYWORD, value: idStr, line: lineIdx });
                } else {
                    tokens.push({ type: TokenType.IDENTIFIER, value: idStr, line: lineIdx });
                }
                continue;
            }

            let opMatched = false;
            for (let len = 3; len >= 1; len--) {
                const op = line.substr(pos, len);
                if (OPERATORS.has(op)) {
                    tokens.push({ type: TokenType.OPERATOR, value: op, line: lineIdx });
                    pos += len;
                    opMatched = true;
                    break;
                }
            }
            if (opMatched) continue;

            if (/[(){}\[\],:;.]/.test(char)) {
                tokens.push({ type: TokenType.PUNCTUATION, value: char, line: lineIdx });
                pos++;
                continue;
            }

            pos++;
        }

        tokens.push({ type: TokenType.NEWLINE, value: '\n', line: lineIdx });
    }

    while (indentStack.length > 1) {
        indentStack.pop();
        tokens.push({ type: TokenType.DEDENT, value: '', line: lines.length });
    }

    tokens.push({ type: TokenType.EOF, value: '', line: lines.length });
    return tokens;
}

// --- PARSER ---

class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
        this.declaredVars = new Set();
    }

    peek(offset = 0) {
        if (this.pos + offset >= this.tokens.length) return this.tokens[this.tokens.length - 1];
        return this.tokens[this.pos + offset];
    }

    consume() {
        if (this.pos >= this.tokens.length) return this.tokens[this.tokens.length - 1];
        return this.tokens[this.pos++];
    }

    match(type, value = null) {
        const token = this.peek();
        if (token.type === type && (value === null || token.value === value)) {
            return this.consume();
        }
        return null;
    }

    expect(type, value = null) {
        const token = this.consume();
        if (token.type !== type || (value !== null && token.value !== value)) {
            throw new Error(`Expected ${type}${value ? ' ' + value : ''}, got ${token.type} '${token.value}' at line ${token.line}`);
        }
        return token;
    }

    skipNewlines() {
        while (this.match(TokenType.NEWLINE)) {}
    }

    parse() {
        const statements = [];
        this.skipNewlines();

        while (this.peek().type !== TokenType.EOF) {
            try {
                const stmt = this.parseStatement();
                if (stmt) {
                    statements.push(stmt);
                }
                this.skipNewlines();
            } catch (e) {
                while (this.peek().type !== TokenType.NEWLINE && this.peek().type !== TokenType.EOF) {
                    this.consume();
                }
                this.skipNewlines();
            }
        }

        const functions = [];
        const mainBody = [];
        
        for (const stmt of statements) {
            if (stmt.type === 'FunctionDeclaration') {
                functions.push(stmt);
            } else if (stmt.type === 'IfStatement' && 
                       stmt.condition.type === 'BinaryExpression' &&
                       stmt.condition.left.name === '__name__' &&
                       stmt.condition.right.value === '__main__') {
                mainBody.push(...stmt.consequent.body);
            } else {
                mainBody.push(stmt);
            }
        }

        const programBody = [...functions];

        if (mainBody.length > 0) {
            programBody.push({
                type: 'FunctionDeclaration',
                returnType: 'auto',
                name: 'main',
                params: [],
                body: {
                    type: 'Block',
                    body: mainBody,
                    line: mainBody[0] ? mainBody[0].line : 1
                },
                line: mainBody[0] ? mainBody[0].line : 1
            });
        }

        return {
            type: 'Program',
            body: programBody,
            line: 1
        };
    }

    parseBlock() {
        const stmts = [];
        const line = this.peek().line;
        
        this.skipNewlines();
        
        if (this.match(TokenType.INDENT)) {
            while (this.peek().type !== TokenType.DEDENT && this.peek().type !== TokenType.EOF) {
                try {
                    const stmt = this.parseStatement();
                    if (stmt) stmts.push(stmt);
                    this.skipNewlines();
                } catch(e) {
                    while (this.peek().type !== TokenType.NEWLINE && this.peek().type !== TokenType.EOF) {
                        this.consume();
                    }
                    this.skipNewlines();
                }
            }
            this.expect(TokenType.DEDENT);
        } else {
            const stmt = this.parseStatement();
            if (stmt) stmts.push(stmt);
        }
        
        return {
            type: 'Block',
            body: stmts,
            line
        };
    }

    parseStatement() {
        this.skipNewlines();
        const token = this.peek();
        
        if (token.type === TokenType.KEYWORD) {
            switch (token.value) {
                case 'def': return this.parseFunctionDeclaration();
                case 'if': return this.parseIfStatement();
                case 'while': return this.parseWhileStatement();
                case 'for': return this.parseForStatement();
                case 'return': return this.parseReturnStatement();
                case 'break': 
                    this.consume(); 
                    return { type: 'BreakStatement', line: token.line };
                case 'continue': 
                    this.consume(); 
                    return { type: 'ContinueStatement', line: token.line };
                case 'pass': 
                    this.consume(); 
                    return null; 
            }
        }
        
        return this.parseExpressionOrAssignment();
    }

    parseFunctionDeclaration() {
        const line = this.consume().line;
        const nameToken = this.expect(TokenType.IDENTIFIER);
        this.expect(TokenType.PUNCTUATION, '(');
        
        const params = [];
        if (!this.match(TokenType.PUNCTUATION, ')')) {
            do {
                const paramToken = this.expect(TokenType.IDENTIFIER);
                params.push({ type: 'auto', name: paramToken.value });
                this.declaredVars.add(paramToken.value);
            } while (this.match(TokenType.PUNCTUATION, ','));
            this.expect(TokenType.PUNCTUATION, ')');
        }
        
        this.expect(TokenType.PUNCTUATION, ':');
        const body = this.parseBlock();
        
        return {
            type: 'FunctionDeclaration',
            returnType: 'auto',
            name: nameToken.value,
            params,
            body,
            line
        };
    }

    parseIfStatement() {
        const line = this.consume().line;
        const condition = this.parseExpression();
        this.expect(TokenType.PUNCTUATION, ':');
        const consequent = this.parseBlock();
        
        let alternate = null;
        this.skipNewlines();
        
        if (this.match(TokenType.KEYWORD, 'elif')) {
            this.pos--; 
            this.tokens[this.pos].value = 'if'; 
            alternate = this.parseIfStatement();
            this.tokens[this.pos].value = 'elif';
        } else if (this.match(TokenType.KEYWORD, 'else')) {
            this.expect(TokenType.PUNCTUATION, ':');
            const elseBody = this.parseBlock();
            alternate = elseBody;
        }
        
        return {
            type: 'IfStatement',
            condition,
            consequent,
            alternate,
            line
        };
    }

    parseWhileStatement() {
        const line = this.consume().line;
        const condition = this.parseExpression();
        this.expect(TokenType.PUNCTUATION, ':');
        const body = this.parseBlock();
        
        return {
            type: 'WhileStatement',
            condition,
            body,
            line
        };
    }

    parseForStatement() {
        const line = this.consume().line;
        
        const loopVars = [];
        do {
            loopVars.push(this.expect(TokenType.IDENTIFIER).value);
        } while (this.match(TokenType.PUNCTUATION, ','));
        
        this.expect(TokenType.KEYWORD, 'in');
        const iterExpr = this.parseExpression();
        this.expect(TokenType.PUNCTUATION, ':');
        
        let init = null;
        let condition = null;
        let update = null;
        const body = this.parseBlock();

        const loopVar = loopVars[0];
        this.declaredVars.add(loopVar);

        if (iterExpr.type === 'FunctionCall' && iterExpr.callee === 'range') {
            const args = iterExpr.arguments;
            let start = { type: 'NumericLiteral', value: 0, line: iterExpr.line };
            let end = null;
            let step = { type: 'NumericLiteral', value: 1, line: iterExpr.line };

            if (args.length === 1) {
                end = args[0];
            } else if (args.length === 2) {
                start = args[0];
                end = args[1];
            } else if (args.length >= 3) {
                start = args[0];
                end = args[1];
                step = args[2];
            }

            init = {
                type: 'VariableDeclaration',
                dataType: 'auto',
                declarations: [{ name: loopVar, initializer: start }],
                line
            };

            condition = {
                type: 'BinaryExpression',
                operator: '<',
                left: { type: 'Identifier', name: loopVar, line },
                right: end,
                line
            };

            if (step.type === 'NumericLiteral' && step.value === 1) {
                update = {
                    type: 'UpdateExpression', 
                    operator: '++', 
                    argument: { type: 'Identifier', name: loopVar, line },
                    prefix: false,
                    line
                };
            } else {
                update = {
                    type: 'Assignment',
                    target: { type: 'Identifier', name: loopVar, line },
                    operator: '+=',
                    value: step,
                    line
                };
            }

        } else {
            const idxVar = `_idx_${loopVar}`;
            this.declaredVars.add(idxVar);
            
            init = {
                type: 'VariableDeclaration',
                dataType: 'int',
                declarations: [{
                    name: loopVar,
                    initializer: null
                }, {
                    name: idxVar,
                    initializer: { type: 'NumericLiteral', value: 0, line }
                }],
                line
            };
            
            condition = {
                type: 'BinaryExpression',
                operator: '<',
                left: { type: 'Identifier', name: idxVar, line },
                right: {
                    type: 'FunctionCall',
                    callee: 'len',
                    arguments: [iterExpr],
                    line
                },
                line
            };
            
            update = {
                type: 'UpdateExpression',
                operator: '++',
                argument: { type: 'Identifier', name: idxVar, line },
                prefix: false,
                line
            };
            
            const assignLoopVar = {
                type: 'Assignment',
                target: { type: 'Identifier', name: loopVar, line },
                operator: '=',
                value: {
                    type: 'ArrayAccess',
                    object: iterExpr,
                    index: { type: 'Identifier', name: idxVar, line },
                    line
                },
                line
            };
            
            body.body.unshift(assignLoopVar);
        }

        return {
            type: 'ForStatement',
            init,
            condition,
            update,
            body,
            line
        };
    }

    parseReturnStatement() {
        const line = this.consume().line;
        let value = null;
        if (this.peek().type !== TokenType.NEWLINE && this.peek().type !== TokenType.EOF && this.peek().type !== TokenType.DEDENT) {
            value = this.parseExpression();
        }
        return {
            type: 'ReturnStatement',
            value,
            line
        };
    }

    parseExpressionOrAssignment() {
        const line = this.peek().line;
        
        let isUnpacking = false;
        let pos = this.pos;
        let hasComma = false;
        while (this.tokens[pos] && this.tokens[pos].type !== TokenType.NEWLINE && this.tokens[pos].type !== TokenType.EOF) {
            if (this.tokens[pos].type === TokenType.OPERATOR && this.tokens[pos].value === '=') {
                if (hasComma) isUnpacking = true;
                break;
            }
            if (this.tokens[pos].type === TokenType.PUNCTUATION && this.tokens[pos].value === ',') {
                hasComma = true;
            }
            pos++;
        }

        if (isUnpacking) {
            const targets = [];
            do {
                targets.push(this.expect(TokenType.IDENTIFIER).value);
            } while (this.match(TokenType.PUNCTUATION, ','));
            
            this.expect(TokenType.OPERATOR, '=');
            
            const rightLine = this.peek().line;
            const rightExpr = this.parseExpression();

            if (this.isInputCall(rightExpr)) {
                targets.forEach(t => this.declaredVars.add(t));
                return {
                    type: 'CinStatement',
                    targets: targets.map(t => ({ type: 'Identifier', name: t })),
                    line
                };
            }
            
            const declarations = [];
            for (let i = 0; i < targets.length; i++) {
                const target = targets[i];
                let val = rightExpr;
                if (rightExpr.type === 'ArrayLiteral') {
                    val = rightExpr.elements[i] || { type: 'NullLiteral', value: null, line: rightLine };
                }
                
                if (!this.declaredVars.has(target)) {
                    this.declaredVars.add(target);
                    declarations.push({ name: target, initializer: val });
                }
            }
            return {
                type: 'VariableDeclaration',
                dataType: 'auto',
                declarations,
                line
            };
        }

        const expr = this.parseExpression();

        if (this.match(TokenType.OPERATOR, '=')) {
            const value = this.parseExpression();
            
            let targetName = null;
            if (expr.type === 'Identifier') {
                targetName = expr.name;
            }

            if (targetName && this.isInputCall(value)) {
                if (!this.declaredVars.has(targetName)) {
                    this.declaredVars.add(targetName);
                }
                
                if (this.isListMapInputSplit(value)) {
                    return {
                        type: 'Block',
                        body: [
                            {
                                type: 'VectorDeclaration',
                                elementType: 'int',
                                name: targetName,
                                sizeExpr: null,
                                fillExpr: null,
                                initList: null,
                                line
                            },
                            {
                                type: 'CinStatement',
                                targets: [{ type: 'Identifier', name: targetName }],
                                line
                            }
                        ],
                        line
                    };
                }

                return {
                    type: 'Block',
                    body: [
                        {
                            type: 'VariableDeclaration',
                            dataType: 'auto',
                            declarations: [{ name: targetName, initializer: null }],
                            line
                        },
                        {
                            type: 'CinStatement',
                            targets: [{ type: 'Identifier', name: targetName }],
                            line
                        }
                    ],
                    line
                };
            }

            if (targetName && value.type === 'BinaryExpression' && value.operator === '*') {
                if (value.left.type === 'ArrayLiteral' && value.left.elements.length === 1) {
                    if (!this.declaredVars.has(targetName)) this.declaredVars.add(targetName);
                    return {
                        type: 'VectorDeclaration',
                        elementType: 'int',
                        name: targetName,
                        sizeExpr: value.right,
                        fillExpr: value.left.elements[0],
                        initList: null,
                        line
                    };
                }
            }
            
            if (targetName) {
                if (value.type === 'ObjectLiteral' || (value.type === 'FunctionCall' && value.callee === 'dict')) {
                    this.declaredVars.add(targetName);
                    return {
                        type: 'VariableDeclaration',
                        dataType: 'dict',
                        declarations: [{ name: targetName, initializer: value }],
                        line
                    };
                }
                if (value.type === 'FunctionCall' && value.callee === 'set') {
                    this.declaredVars.add(targetName);
                    return {
                        type: 'VariableDeclaration',
                        dataType: 'set',
                        declarations: [{ name: targetName, initializer: value }],
                        line
                    };
                }
            }

            if (targetName && !this.declaredVars.has(targetName)) {
                this.declaredVars.add(targetName);
                
                if (value.type === 'ArrayLiteral') {
                    return {
                        type: 'VectorDeclaration',
                        elementType: 'auto',
                        name: targetName,
                        sizeExpr: null,
                        fillExpr: null,
                        initList: value.elements,
                        line
                    };
                }
                
                return {
                    type: 'VariableDeclaration',
                    dataType: 'auto',
                    declarations: [{ name: targetName, initializer: value }],
                    line
                };
            } else {
                return {
                    type: 'Assignment',
                    target: expr,
                    operator: '=',
                    value,
                    line
                };
            }
        } else if (this.peek().type === TokenType.OPERATOR && ['+=', '-=', '*=', '/=', '//=', '%='].includes(this.peek().value)) {
            const opToken = this.consume();
            const value = this.parseExpression();
            return {
                type: 'Assignment',
                target: expr,
                operator: opToken.value,
                value,
                line
            };
        }

        if (expr.type === 'FunctionCall' && expr.callee === 'print') {
            const expressions = [];
            let endsWithEndl = true;
            let sep = { type: 'StringLiteral', value: ' ', line };
            
            for (let i = 0; i < expr.arguments.length; i++) {
                const arg = expr.arguments[i];
                if (arg.type === 'Assignment' && arg.target.type === 'Identifier') {
                    if (arg.target.name === 'end') {
                        endsWithEndl = arg.value.value === '\n';
                    } else if (arg.target.name === 'sep') {
                        sep = arg.value;
                    }
                    continue;
                }
                
                if (i > 0 && expressions.length > 0) {
                    expressions.push(sep);
                }
                expressions.push(arg);
            }
            
            if (endsWithEndl) {
                expressions.push({ type: 'Identifier', name: 'endl', line });
            }
            
            return {
                type: 'CoutStatement',
                expressions,
                line
            };
        }

        if (expr.type === 'MethodCall') {
            return {
                type: 'ExpressionStatement',
                expression: expr,
                line
            };
        }

        return {
            type: 'ExpressionStatement',
            expression: expr,
            line
        };
    }

    isInputCall(expr) {
        if (!expr) return false;
        if (expr.type === 'FunctionCall' && expr.callee === 'input') return true;
        if (expr.type === 'FunctionCall' && expr.callee === 'int' && expr.arguments[0] && this.isInputCall(expr.arguments[0])) return true;
        if (this.isListMapInputSplit(expr)) return true;
        if (expr.type === 'MethodCall' && expr.method === 'split' && this.isInputCall(expr.object)) return true;
        if (expr.type === 'FunctionCall' && expr.callee === 'map' && expr.arguments[1] && this.isInputCall(expr.arguments[1])) return true;
        return false;
    }

    isListMapInputSplit(expr) {
        if (!expr) return false;
        if (expr.type === 'FunctionCall' && expr.callee === 'list') {
            const mapCall = expr.arguments[0];
            if (mapCall && mapCall.type === 'FunctionCall' && mapCall.callee === 'map') {
                return true;
            }
        }
        return false;
    }

    parseExpression() {
        return this.parseLogicalOr();
    }

    parseLogicalOr() {
        let left = this.parseLogicalAnd();
        while (this.match(TokenType.KEYWORD, 'or')) {
            const line = this.tokens[this.pos - 1].line;
            const right = this.parseLogicalAnd();
            left = {
                type: 'BinaryExpression',
                operator: '||',
                left,
                right,
                line
            };
        }
        return left;
    }

    parseLogicalAnd() {
        let left = this.parseEquality();
        while (this.match(TokenType.KEYWORD, 'and')) {
            const line = this.tokens[this.pos - 1].line;
            const right = this.parseEquality();
            left = {
                type: 'BinaryExpression',
                operator: '&&',
                left,
                right,
                line
            };
        }
        return left;
    }

    parseEquality() {
        let left = this.parseRelational();
        while (true) {
            const token = this.peek();
            if (token.type === TokenType.OPERATOR && (token.value === '==' || token.value === '!=')) {
                this.consume();
                const right = this.parseRelational();
                left = {
                    type: 'BinaryExpression',
                    operator: token.value,
                    left,
                    right,
                    line: token.line
                };
            } else {
                break;
            }
        }
        return left;
    }

    parseRelational() {
        let left = this.parseAdditive();
        while (true) {
            const token = this.peek();
            if (token.type === TokenType.OPERATOR && ['<', '>', '<=', '>='].includes(token.value)) {
                this.consume();
                const right = this.parseAdditive();
                left = {
                    type: 'BinaryExpression',
                    operator: token.value,
                    left,
                    right,
                    line: token.line
                };
            } else if (token.type === TokenType.KEYWORD && token.value === 'in') {
                this.consume();
                const right = this.parseAdditive();
                left = {
                    type: 'BinaryExpression',
                    operator: 'in',
                    left,
                    right,
                    line: token.line
                };
            } else {
                break;
            }
        }
        return left;
    }

    parseAdditive() {
        let left = this.parseMultiplicative();
        while (true) {
            const token = this.peek();
            if (token.type === TokenType.OPERATOR && (token.value === '+' || token.value === '-')) {
                this.consume();
                const right = this.parseMultiplicative();
                left = {
                    type: 'BinaryExpression',
                    operator: token.value,
                    left,
                    right,
                    line: token.line
                };
            } else {
                break;
            }
        }
        return left;
    }

    parseMultiplicative() {
        let left = this.parseUnary();
        while (true) {
            const token = this.peek();
            if (token.type === TokenType.OPERATOR && ['*', '/', '//', '%', '**'].includes(token.value)) {
                this.consume();
                const right = this.parseUnary();
                left = {
                    type: 'BinaryExpression',
                    operator: token.value === '//' ? '/' : token.value,
                    left,
                    right,
                    line: token.line
                };
            } else {
                break;
            }
        }
        return left;
    }

    parseUnary() {
        const token = this.peek();
        if ((token.type === TokenType.OPERATOR && (token.value === '+' || token.value === '-')) || 
            (token.type === TokenType.KEYWORD && token.value === 'not')) {
            this.consume();
            const operand = this.parseUnary();
            return {
                type: 'UnaryExpression',
                operator: token.value === 'not' ? '!' : token.value,
                operand,
                prefix: true,
                line: token.line
            };
        }
        return this.parsePrimary();
    }

    parsePrimary() {
        const token = this.consume();

        if (token.type === TokenType.NUMBER) {
            return { type: 'NumericLiteral', value: token.value, line: token.line };
        }
        
        if (token.type === TokenType.STRING) {
            return { type: 'StringLiteral', value: token.value, line: token.line };
        }
        
        if (token.type === TokenType.KEYWORD) {
            if (token.value === 'True') return { type: 'BooleanLiteral', value: true, line: token.line };
            if (token.value === 'False') return { type: 'BooleanLiteral', value: false, line: token.line };
            if (token.value === 'None') return { type: 'NullLiteral', value: null, line: token.line };
        }

        if (token.type === TokenType.IDENTIFIER) {
            let node = { type: 'Identifier', name: token.value, line: token.line };
            
            while (true) {
                const next = this.peek();
                if (next.type === TokenType.PUNCTUATION && next.value === '(') {
                    this.consume();
                    const args = [];
                    if (this.peek().value !== ')') {
                        do {
                            if (this.peek().type === TokenType.IDENTIFIER && this.peek(1).type === TokenType.OPERATOR && this.peek(1).value === '=') {
                                const kwName = this.consume();
                                const eq = this.consume();
                                const val = this.parseExpression();
                                args.push({
                                    type: 'Assignment',
                                    target: { type: 'Identifier', name: kwName.value, line: kwName.line },
                                    operator: '=',
                                    value: val,
                                    line: kwName.line
                                });
                            } else {
                                args.push(this.parseExpression());
                            }
                        } while (this.match(TokenType.PUNCTUATION, ','));
                    }
                    this.expect(TokenType.PUNCTUATION, ')');
                    
                    if (node.type === 'MemberExpression') {
                        node = {
                            type: 'MethodCall',
                            object: node.object,
                            method: node.property.name,
                            arguments: args,
                            line: node.line
                        };
                    } else {
                        node = {
                            type: 'FunctionCall',
                            callee: node.name,
                            arguments: args,
                            line: node.line
                        };
                    }
                } else if (next.type === TokenType.PUNCTUATION && next.value === '[') {
                    this.consume();
                    const index = this.parseExpression();
                    this.expect(TokenType.PUNCTUATION, ']');
                    node = {
                        type: 'ArrayAccess',
                        object: node,
                        index,
                        line: node.line
                    };
                } else if (next.type === TokenType.PUNCTUATION && next.value === '.') {
                    this.consume();
                    const prop = this.expect(TokenType.IDENTIFIER);
                    node = {
                        type: 'MemberExpression',
                        object: node,
                        property: { type: 'Identifier', name: prop.value, line: prop.line },
                        line: node.line
                    };
                } else {
                    break;
                }
            }
            return node;
        }

        if (token.type === TokenType.PUNCTUATION && token.value === '[') {
            const elements = [];
            if (this.peek().value !== ']') {
                do {
                    elements.push(this.parseExpression());
                } while (this.match(TokenType.PUNCTUATION, ','));
            }
            this.expect(TokenType.PUNCTUATION, ']');
            return {
                type: 'ArrayLiteral',
                elements,
                line: token.line
            };
        }

        if (token.type === TokenType.PUNCTUATION && token.value === '{') {
            const elements = [];
            let isDict = false;
            if (this.peek().value !== '}') {
                do {
                    const key = this.parseExpression();
                    if (this.match(TokenType.PUNCTUATION, ':')) {
                        isDict = true;
                        const value = this.parseExpression();
                        elements.push({ key, value });
                    } else {
                        elements.push(key);
                    }
                } while (this.match(TokenType.PUNCTUATION, ','));
            }
            this.expect(TokenType.PUNCTUATION, '}');
            
            if (isDict || elements.length === 0) {
                return {
                    type: 'ObjectLiteral',
                    properties: elements,
                    line: token.line
                };
            } else {
                return {
                    type: 'SetLiteral',
                    elements,
                    line: token.line
                };
            }
        }

        if (token.type === TokenType.PUNCTUATION && token.value === '(') {
            const expr = this.parseExpression();
            this.expect(TokenType.PUNCTUATION, ')');
            return expr;
        }

        throw new Error(`Unexpected token ${token.type} '${token.value}' at line ${token.line}`);
    }
}

function parse(sourceCode) {
    const tokens = tokenize(sourceCode);
    const parser = new Parser(tokens);
    return parser.parse();
}

module.exports = { parse, tokenize };
