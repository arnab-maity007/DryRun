const { TokenType } = require('./tokenizer');

function parse(tokens) {
    let pos = 0;

    function peek(offset = 0) {
        if (pos + offset >= tokens.length) return tokens[tokens.length - 1];
        return tokens[pos + offset];
    }

    function match(...types) {
        const current = peek();
        if (types.includes(current.type)) {
            pos++;
            return current;
        }
        return null;
    }

    function consume(type, errMessage) {
        const token = match(type);
        if (!token) {
            throw new Error(`${errMessage} at line ${peek().line}, col ${peek().col}. Expected ${type}, got ${peek().type}`);
        }
        return token;
    }

    function parseProgram() {
        const statements = [];
        const line = peek().line;
        while (peek().type !== TokenType.EOF) {
            statements.push(parseTopLevelStatement());
        }
        return { type: 'Program', body: statements, line };
    }

    function parseTopLevelStatement() {
        if (peek().type === TokenType.HASH) {
            const line = peek().line;
            consume(TokenType.HASH);
            if (peek().type === TokenType.IDENTIFIER && peek().value === 'include') {
                consume(TokenType.IDENTIFIER);
                // skip until newline token is not supported since tokenizer skips newlines.
                // We'll skip tokens until the line changes.
                while (peek().type !== TokenType.EOF && peek().line === line) {
                    pos++;
                }
                return { type: 'IncludeDirective', line };
            }
        }

        if (peek().type === TokenType.USING) {
            const line = peek().line;
            consume(TokenType.USING);
            consume(TokenType.NAMESPACE);
            consume(TokenType.IDENTIFIER); // std
            consume(TokenType.SEMICOLON);
            return { type: 'UsingDirective', line };
        }

        // Could be function declaration or variable declaration
        let hasConst = false;
        if (peek().type === TokenType.CONST) {
            hasConst = true;
            pos++; // consume const just for checking, will be handled properly if we go down declaration
        }

        if (isType(peek())) {
            if (hasConst) pos--; // backtrack const so isType logic flow works
            
            const savedPos = pos;
            
            try {
                if (match(TokenType.CONST)) {} // consume const if present

                const typeStr = parseType();

                if (peek().type === TokenType.IDENTIFIER) {
                    const nameTok = consume(TokenType.IDENTIFIER, "Expected identifier");

                    if (peek().type === TokenType.LPAREN) {
                        // Function declaration with optional parameters
                        const line = nameTok.line;
                        consume(TokenType.LPAREN);
                        const params = [];
                        if (peek().type !== TokenType.RPAREN) {
                            // Parse parameter list
                            do {
                                const paramType = parseType();
                                const paramName = consume(TokenType.IDENTIFIER, "Expected parameter name");
                                params.push({ type: paramType, name: paramName.value });
                            } while (match(TokenType.COMMA));
                        }
                        consume(TokenType.RPAREN);
                        const body = parseBlock();
                        return { type: 'FunctionDeclaration', returnType: typeStr, name: nameTok.value, params, body, line };
                    } else {
                        // backtrack and parse as normal statement
                        pos = savedPos;
                        return parseStatement();
                    }
                } else {
                    pos = savedPos;
                    return parseStatement();
                }
            } catch (e) {
                // If it fails (e.g. it's a complex global initialization like mt19937 RNG(...)), skip it
                pos = savedPos;
                const line = peek().line;
                while (peek().type !== TokenType.EOF && peek().type !== TokenType.SEMICOLON) {
                    pos++;
                }
                if (peek().type === TokenType.SEMICOLON) pos++;
                return { type: 'ExpressionStatement', expression: { type: 'StringLiteral', value: 'skipped unparseable global' }, line };
            }
        }

        try {
            return parseStatement();
        } catch (e) {
            // Fallback for any other top-level unparseable statement
            const line = peek().line;
            while (peek().type !== TokenType.EOF && peek().type !== TokenType.SEMICOLON && peek().type !== TokenType.RBRACE) {
                pos++;
            }
            if (peek().type === TokenType.SEMICOLON || peek().type === TokenType.RBRACE) pos++;
            return { type: 'ExpressionStatement', expression: { type: 'StringLiteral', value: 'skipped unparseable statement' }, line };
        }
    }

    function isType(token) {
        if (token.type === TokenType.CONST) return true;
        return [
            TokenType.INT, TokenType.LONG, TokenType.DOUBLE, TokenType.FLOAT,
            TokenType.CHAR, TokenType.STRING, TokenType.BOOL, TokenType.VOID,
            TokenType.VECTOR, TokenType.AUTO, TokenType.SIGNED, TokenType.UNSIGNED,
            TokenType.MAP, TokenType.SET
        ].includes(token.type);
    }

    function parseType() {
        if (match(TokenType.CONST)) {} // Skip const modifier
        
        const typeTok = match(TokenType.INT, TokenType.LONG, TokenType.DOUBLE, TokenType.FLOAT,
            TokenType.CHAR, TokenType.STRING, TokenType.BOOL, TokenType.VOID,
            TokenType.AUTO, TokenType.VECTOR, TokenType.SIGNED, TokenType.UNSIGNED,
            TokenType.MAP, TokenType.SET);
        if (!typeTok) throw new Error("Expected type at line " + peek().line);

        // 'signed' alone → treat as 'int', 'signed main' → 'int'
        if (typeTok.type === TokenType.SIGNED) {
            if (peek().type === TokenType.INT) {
                consume(TokenType.INT);
                return 'int';
            }
            if (peek().type === TokenType.LONG) {
                consume(TokenType.LONG);
                if (peek().type === TokenType.LONG) {
                    consume(TokenType.LONG);
                    return 'long long';
                }
                return 'long';
            }
            return 'int'; // 'signed' alone means int
        }

        if (typeTok.type === TokenType.UNSIGNED) {
            if (peek().type === TokenType.INT) {
                consume(TokenType.INT);
                return 'unsigned int';
            }
            if (peek().type === TokenType.LONG) {
                consume(TokenType.LONG);
                if (peek().type === TokenType.LONG) {
                    consume(TokenType.LONG);
                    return 'unsigned long long';
                }
                return 'unsigned long';
            }
            return 'unsigned int';
        }

        if (typeTok.type === TokenType.LONG) {
            if (peek().type === TokenType.LONG) {
                consume(TokenType.LONG);
                return 'long long';
            }
            return 'long';
        }
        
        return typeTok.value;
    }

    function parseStatement() {
        const token = peek();
        
        if (token.type === TokenType.LBRACE) return parseBlock();
        if (token.type === TokenType.IF) return parseIfStatement();
        if (token.type === TokenType.FOR) return parseForStatement();
        if (token.type === TokenType.WHILE) return parseWhileStatement();
        if (token.type === TokenType.RETURN) return parseReturnStatement();
        if (token.type === TokenType.BREAK) return parseBreakStatement();
        if (token.type === TokenType.CONTINUE) return parseContinueStatement();
        if (token.type === TokenType.CIN) return parseCinStatement();
        if (token.type === TokenType.COUT) return parseCoutStatement();
        
        if (isType(token)) return parseDeclaration();

        // Could be expression statement or assignment
        const expr = parseExpression();
        if (match(TokenType.SEMICOLON)) {
            // Unpack AssignmentExpression to Assignment for statements
            if (expr.type === 'AssignmentExpression') {
                return { type: 'Assignment', target: expr.target, operator: expr.operator, value: expr.value, line: token.line };
            }
            return { type: 'ExpressionStatement', expression: expr, line: token.line };
        }
        
        throw new Error("Unexpected token " + peek().type + " at line " + peek().line);
    }

    function parseBlock() {
        const line = peek().line;
        consume(TokenType.LBRACE);
        const body = [];
        while (peek().type !== TokenType.RBRACE && peek().type !== TokenType.EOF) {
            try {
                body.push(parseStatement());
            } catch (e) {
                const errLine = peek().line;
                // Skip to next statement boundary
                while (peek().type !== TokenType.EOF && peek().type !== TokenType.SEMICOLON && peek().type !== TokenType.RBRACE) {
                    pos++;
                }
                if (peek().type === TokenType.SEMICOLON) pos++;
                body.push({ type: 'ExpressionStatement', expression: { type: 'StringLiteral', value: 'skipped inner statement' }, line: errLine });
            }
        }
        consume(TokenType.RBRACE);
        return { type: 'Block', body, line };
    }

    function parseIfStatement() {
        const line = peek().line;
        consume(TokenType.IF);
        consume(TokenType.LPAREN);
        const condition = parseExpression();
        consume(TokenType.RPAREN);
        const consequent = parseStatement();
        let alternate = null;
        if (match(TokenType.ELSE)) {
            alternate = parseStatement();
        }
        return { type: 'IfStatement', condition, consequent, alternate, line };
    }

    function parseForStatement() {
        const line = peek().line;
        consume(TokenType.FOR);
        consume(TokenType.LPAREN);
        
        // Peek ahead to check if range-based for loop
        let isRangeBased = false;
        let scanOffset = 0;
        while (peek(scanOffset).type !== TokenType.RPAREN && peek(scanOffset).type !== TokenType.EOF) {
            if (peek(scanOffset).type === TokenType.COLON) {
                isRangeBased = true;
                break;
            }
            if (peek(scanOffset).type === TokenType.SEMICOLON) {
                break;
            }
            scanOffset++;
        }

        if (isRangeBased) {
            if (match(TokenType.CONST)) {}
            const typeStr = parseType();
            
            let isReference = false;
            if (peek().type === TokenType.BITWISE_AND) {
                consume(TokenType.BITWISE_AND);
                isReference = true;
            }

            const nameTok = consume(TokenType.IDENTIFIER);
            consume(TokenType.COLON);
            const containerExpr = parseExpression();
            consume(TokenType.RPAREN);
            const body = parseStatement();
            return { type: 'RangeForStatement', variableType: typeStr, isReference, variableName: nameTok.value, container: containerExpr, body, line };
        }

        let init = null;
        if (peek().type !== TokenType.SEMICOLON) {
            if (isType(peek())) {
                init = parseDeclaration();
            } else {
                const expr = parseExpression();
                if (expr.type === 'AssignmentExpression') {
                    init = { type: 'Assignment', target: expr.target, operator: expr.operator, value: expr.value, line: expr.line };
                } else {
                    init = { type: 'ExpressionStatement', expression: expr, line: expr.line };
                }
                consume(TokenType.SEMICOLON);
            }
        } else {
            consume(TokenType.SEMICOLON);
        }

        let condition = null;
        if (peek().type !== TokenType.SEMICOLON) {
            condition = parseExpression();
        }
        consume(TokenType.SEMICOLON);

        let update = null;
        if (peek().type !== TokenType.RPAREN) {
            update = parseExpression();
        }
        consume(TokenType.RPAREN);

        const body = parseStatement();
        return { type: 'ForStatement', init, condition, update, body, line };
    }

    function parseWhileStatement() {
        const line = peek().line;
        consume(TokenType.WHILE);
        consume(TokenType.LPAREN);
        const condition = parseExpression();
        consume(TokenType.RPAREN);
        const body = parseStatement();
        return { type: 'WhileStatement', condition, body, line };
    }

    function parseReturnStatement() {
        const line = peek().line;
        consume(TokenType.RETURN);
        let value = null;
        if (peek().type !== TokenType.SEMICOLON) {
            value = parseExpression();
        }
        consume(TokenType.SEMICOLON);
        return { type: 'ReturnStatement', value, line };
    }

    function parseBreakStatement() {
        const line = peek().line;
        consume(TokenType.BREAK);
        consume(TokenType.SEMICOLON);
        return { type: 'BreakStatement', line };
    }

    function parseContinueStatement() {
        const line = peek().line;
        consume(TokenType.CONTINUE);
        consume(TokenType.SEMICOLON);
        return { type: 'ContinueStatement', line };
    }

    function parseCinStatement() {
        const line = peek().line;
        consume(TokenType.CIN);
        const targets = [];
        while (match(TokenType.RIGHT_SHIFT)) {
            targets.push(parseExpression());
        }
        consume(TokenType.SEMICOLON);
        return { type: 'CinStatement', targets, line };
    }

    function parseCoutStatement() {
        const line = peek().line;
        consume(TokenType.COUT);
        const expressions = [];
        while (match(TokenType.LEFT_SHIFT)) {
            if (peek().type === TokenType.ENDL) {
                consume(TokenType.ENDL);
                expressions.push({ type: 'Identifier', name: 'endl' });
            } else {
                expressions.push(parseExpression());
            }
        }
        consume(TokenType.SEMICOLON);
        return { type: 'CoutStatement', expressions, line };
    }

    function parseDeclaration() {
        const line = peek().line;
        const typeStr = parseType();

        // Container declarations (vector, stack, queue, deque, priority_queue, set, map)
        if (['vector', 'stack', 'queue', 'deque', 'priority_queue', 'set', 'map', 'unordered_map', 'unordered_set'].includes(typeStr)) {
            consume(TokenType.LESS);
            
            let elementType = null;
            let keyType = null;
            
            if (['map', 'unordered_map'].includes(typeStr)) {
                keyType = parseType();
                consume(TokenType.COMMA);
                elementType = parseType(); // this is the valueType
            } else {
                elementType = parseType();
            }
            
            consume(TokenType.GREATER);
            const nameTok = consume(TokenType.IDENTIFIER);
            
            let sizeExpr = null;
            let fillExpr = null;
            let initList = null;

            if (match(TokenType.LPAREN)) {
                sizeExpr = parseExpression();
                if (match(TokenType.COMMA)) {
                    fillExpr = parseExpression();
                }
                consume(TokenType.RPAREN);
            } else if (match(TokenType.ASSIGN)) {
                consume(TokenType.LBRACE);
                initList = [];
                if (peek().type !== TokenType.RBRACE) {
                    initList.push(parseExpression());
                    while (match(TokenType.COMMA)) {
                        initList.push(parseExpression());
                    }
                }
                consume(TokenType.RBRACE);
            }

            consume(TokenType.SEMICOLON);
            
            // Format type string for the interpreter's isStackType, isMapType etc.
            let fullTypeStr;
            if (['map', 'unordered_map'].includes(typeStr)) {
                fullTypeStr = `${typeStr}<${keyType},${elementType}>`;
            } else {
                fullTypeStr = `${typeStr}<${elementType}>`;
            }

            return { type: 'VectorDeclaration', containerType: fullTypeStr, elementType, name: nameTok.value, sizeExpr, fillExpr, initList, line };
        }

        const nameTok = consume(TokenType.IDENTIFIER);

        // Array declaration
        if (match(TokenType.LBRACKET)) {
            const sizeExpr = parseExpression();
            consume(TokenType.RBRACKET);
            consume(TokenType.SEMICOLON);
            return { type: 'ArrayDeclaration', elementType: typeStr, name: nameTok.value, sizeExpr, line };
        }

        // Variable declaration
        const declarations = [];
        let init = null;
        if (match(TokenType.ASSIGN)) {
            init = parseExpression();
        }
        declarations.push({ name: nameTok.value, initializer: init });

        while (match(TokenType.COMMA)) {
            const nextName = consume(TokenType.IDENTIFIER);
            let nextInit = null;
            if (match(TokenType.ASSIGN)) {
                nextInit = parseExpression();
            }
            declarations.push({ name: nextName.value, initializer: nextInit });
        }
        consume(TokenType.SEMICOLON);
        return { type: 'VariableDeclaration', dataType: typeStr, declarations, line };
    }

    function parseExpression() {
        return parseAssignment();
    }

    function parseAssignment() {
        const left = parseLogicalOr();
        const assignOp = match(TokenType.ASSIGN, TokenType.PLUS_ASSIGN, TokenType.MINUS_ASSIGN, TokenType.STAR_ASSIGN, TokenType.SLASH_ASSIGN, TokenType.PERCENT_ASSIGN);
        if (assignOp) {
            const right = parseAssignment();
            return { type: 'AssignmentExpression', target: left, operator: assignOp.value, value: right, line: left.line || assignOp.line };
        }
        return left;
    }

    function parseLogicalOr() {
        let left = parseLogicalAnd();
        while (match(TokenType.OR)) {
            const right = parseLogicalAnd();
            left = { type: 'BinaryExpression', operator: '||', left, right, line: left.line };
        }
        return left;
    }

    function parseLogicalAnd() {
        let left = parseEquality();
        while (match(TokenType.AND)) {
            const right = parseEquality();
            left = { type: 'BinaryExpression', operator: '&&', left, right, line: left.line };
        }
        return left;
    }

    function parseEquality() {
        let left = parseRelational();
        while (true) {
            const op = match(TokenType.EQUALS, TokenType.NOT_EQUALS);
            if (op) {
                const right = parseRelational();
                left = { type: 'BinaryExpression', operator: op.value, left, right, line: left.line };
            } else {
                break;
            }
        }
        return left;
    }

    function parseRelational() {
        let left = parseAdditive();
        while (true) {
            const op = match(TokenType.LESS, TokenType.LESS_EQUAL, TokenType.GREATER, TokenType.GREATER_EQUAL);
            if (op) {
                const right = parseAdditive();
                left = { type: 'BinaryExpression', operator: op.value, left, right, line: left.line };
            } else {
                break;
            }
        }
        return left;
    }

    function parseAdditive() {
        let left = parseMultiplicative();
        while (true) {
            const op = match(TokenType.PLUS, TokenType.MINUS);
            if (op) {
                const right = parseMultiplicative();
                left = { type: 'BinaryExpression', operator: op.value, left, right, line: left.line };
            } else {
                break;
            }
        }
        return left;
    }

    function parseMultiplicative() {
        let left = parseUnary();
        while (true) {
            const op = match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT);
            if (op) {
                const right = parseUnary();
                left = { type: 'BinaryExpression', operator: op.value, left, right, line: left.line };
            } else {
                break;
            }
        }
        return left;
    }

    function parseUnary() {
        const opTok = match(TokenType.PLUS, TokenType.MINUS, TokenType.NOT, TokenType.INCREMENT, TokenType.DECREMENT);
        if (opTok) {
            const operand = parseUnary();
            if (opTok.type === TokenType.INCREMENT || opTok.type === TokenType.DECREMENT) {
                return { type: 'UpdateExpression', operator: opTok.value, argument: operand, prefix: true, line: opTok.line };
            }
            return { type: 'UnaryExpression', operator: opTok.value, operand, prefix: true, line: opTok.line };
        }
        return parsePostfix();
    }

    function parsePostfix() {
        let expr = parsePrimary();
        while (true) {
            if (match(TokenType.LBRACKET)) {
                const index = parseExpression();
                consume(TokenType.RBRACKET);
                expr = { type: 'ArrayAccess', object: expr, index, line: expr.line };
            } else if (peek().type === TokenType.LPAREN && expr.type === 'Identifier') {
                // Function call: funcName(args...)
                consume(TokenType.LPAREN);
                const args = [];
                if (peek().type !== TokenType.RPAREN) {
                    args.push(parseExpression());
                    while (match(TokenType.COMMA)) {
                        args.push(parseExpression());
                    }
                }
                consume(TokenType.RPAREN);
                expr = { type: 'FunctionCall', callee: expr.name, arguments: args, line: expr.line };
            } else if (match(TokenType.DOT)) {
                // Member access: obj.method(args) or obj.property
                const member = consume(TokenType.IDENTIFIER, "Expected member name");
                if (peek().type === TokenType.LPAREN) {
                    // Method call: arr.push_back(x), arr.size(), etc.
                    consume(TokenType.LPAREN);
                    const args = [];
                    if (peek().type !== TokenType.RPAREN) {
                        args.push(parseExpression());
                        while (match(TokenType.COMMA)) {
                            args.push(parseExpression());
                        }
                    }
                    consume(TokenType.RPAREN);
                    expr = { type: 'MethodCall', object: expr, method: member.value, arguments: args, line: expr.line };
                } else {
                    expr = { type: 'MemberAccess', object: expr, member: member.value, line: expr.line };
                }
            } else if (match(TokenType.INCREMENT)) {
                expr = { type: 'UpdateExpression', operator: '++', argument: expr, prefix: false, line: expr.line };
            } else if (match(TokenType.DECREMENT)) {
                expr = { type: 'UpdateExpression', operator: '--', argument: expr, prefix: false, line: expr.line };
            } else {
                break;
            }
        }
        return expr;
    }

    function parsePrimary() {
        const token = peek();
        const line = token.line;
        
        if (match(TokenType.NUMBER)) {
            return { type: 'NumericLiteral', value: parseFloat(token.value), line };
        }
        if (match(TokenType.STRING_LITERAL)) {
            return { type: 'StringLiteral', value: token.value, line };
        }
        if (match(TokenType.CHAR_LITERAL)) {
            return { type: 'CharLiteral', value: token.value, line };
        }
        if (match(TokenType.TRUE)) {
            return { type: 'BooleanLiteral', value: true, line };
        }
        if (match(TokenType.FALSE)) {
            return { type: 'BooleanLiteral', value: false, line };
        }
        if (match(TokenType.NULLPTR)) {
            return { type: 'NullLiteral', value: null, line };
        }
        if (match(TokenType.IDENTIFIER)) {
            return { type: 'Identifier', name: token.value, line };
        }
        if (match(TokenType.LPAREN)) {
            const expr = parseExpression();
            consume(TokenType.RPAREN);
            return expr;
        }
        
        throw new Error("Unexpected token " + token.type + " at line " + token.line);
    }

    return parseProgram();
}

module.exports = { parse };
