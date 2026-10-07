const TokenType = {
    NUMBER: 'NUMBER', STRING_LITERAL: 'STRING_LITERAL', CHAR_LITERAL: 'CHAR_LITERAL', IDENTIFIER: 'IDENTIFIER',
    INT: 'INT', LONG: 'LONG', DOUBLE: 'DOUBLE', FLOAT: 'FLOAT', CHAR: 'CHAR', STRING: 'STRING', BOOL: 'BOOL', VOID: 'VOID',
    SIGNED: 'SIGNED', UNSIGNED: 'UNSIGNED', CONST: 'CONST',
    VECTOR: 'VECTOR', PAIR: 'PAIR', MAP: 'MAP', SET: 'SET', AUTO: 'AUTO',
    IF: 'IF', ELSE: 'ELSE', FOR: 'FOR', WHILE: 'WHILE', DO: 'DO', BREAK: 'BREAK', CONTINUE: 'CONTINUE', RETURN: 'RETURN', TRUE: 'TRUE', FALSE: 'FALSE',
    CIN: 'CIN', COUT: 'COUT', ENDL: 'ENDL', USING: 'USING', NAMESPACE: 'NAMESPACE',
    DEFINE: 'DEFINE', NULLPTR: 'NULLPTR',
    PLUS: 'PLUS', MINUS: 'MINUS', STAR: 'STAR', SLASH: 'SLASH', PERCENT: 'PERCENT',
    ASSIGN: 'ASSIGN', EQUALS: 'EQUALS', NOT_EQUALS: 'NOT_EQUALS', LESS: 'LESS', GREATER: 'GREATER', LESS_EQUAL: 'LESS_EQUAL', GREATER_EQUAL: 'GREATER_EQUAL',
    AND: 'AND', OR: 'OR', NOT: 'NOT', BITWISE_AND: 'BITWISE_AND', BITWISE_OR: 'BITWISE_OR', BITWISE_XOR: 'BITWISE_XOR',
    TILDE: 'TILDE',
    INCREMENT: 'INCREMENT', DECREMENT: 'DECREMENT',
    PLUS_ASSIGN: 'PLUS_ASSIGN', MINUS_ASSIGN: 'MINUS_ASSIGN', STAR_ASSIGN: 'STAR_ASSIGN', SLASH_ASSIGN: 'SLASH_ASSIGN', PERCENT_ASSIGN: 'PERCENT_ASSIGN',
    AND_ASSIGN: 'AND_ASSIGN', OR_ASSIGN: 'OR_ASSIGN', XOR_ASSIGN: 'XOR_ASSIGN',
    LEFT_SHIFT: 'LEFT_SHIFT', RIGHT_SHIFT: 'RIGHT_SHIFT',
    LPAREN: 'LPAREN', RPAREN: 'RPAREN', LBRACE: 'LBRACE', RBRACE: 'RBRACE', LBRACKET: 'LBRACKET', RBRACKET: 'RBRACKET',
    SEMICOLON: 'SEMICOLON', COMMA: 'COMMA', DOT: 'DOT', SCOPE: 'SCOPE', HASH: 'HASH', QUESTION: 'QUESTION', COLON: 'COLON',
    EOF: 'EOF'
};

const KEYWORDS = {
    'int': TokenType.INT, 'long': TokenType.LONG, 'double': TokenType.DOUBLE, 'float': TokenType.FLOAT,
    'char': TokenType.CHAR, 'string': TokenType.STRING, 'bool': TokenType.BOOL, 'void': TokenType.VOID,
    'signed': TokenType.SIGNED, 'unsigned': TokenType.UNSIGNED, 'const': TokenType.CONST,
    'vector': TokenType.VECTOR, 'pair': TokenType.PAIR, 'map': TokenType.MAP, 'set': TokenType.SET, 'auto': TokenType.AUTO,
    'mt19937': TokenType.AUTO, 'mt19937_64': TokenType.AUTO,
    'if': TokenType.IF, 'else': TokenType.ELSE, 'for': TokenType.FOR, 'while': TokenType.WHILE, 'do': TokenType.DO,
    'break': TokenType.BREAK, 'continue': TokenType.CONTINUE, 'return': TokenType.RETURN,
    'true': TokenType.TRUE, 'false': TokenType.FALSE,
    'cin': TokenType.CIN, 'cout': TokenType.COUT, 'endl': TokenType.ENDL,
    'using': TokenType.USING, 'namespace': TokenType.NAMESPACE,
    'define': TokenType.DEFINE,
    'NULL': TokenType.NULLPTR, 'nullptr': TokenType.NULLPTR,
};

function tokenize(sourceCode) {
    const tokens = [];
    let pos = 0;
    let line = 1;
    let col = 1;

    function advance() {
        if (pos >= sourceCode.length) return null;
        const char = sourceCode[pos];
        if (char === '\n') {
            line++;
            col = 1;
        } else {
            col++;
        }
        pos++;
        return char;
    }

    function peek(offset = 0) {
        if (pos + offset >= sourceCode.length) return null;
        return sourceCode[pos + offset];
    }

    function addToken(type, value, tLine, tCol) {
        tokens.push({ type, value, line: tLine, col: tCol });
    }

    function skipWhitespace() {
        while (pos < sourceCode.length) {
            const char = peek();
            if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
                advance();
            } else {
                break;
            }
        }
    }

    function skipComments() {
        while (pos < sourceCode.length) {
            if (peek() === '/' && peek(1) === '/') {
                while (pos < sourceCode.length && peek() !== '\n') {
                    advance();
                }
            } else if (peek() === '/' && peek(1) === '*') {
                advance();
                advance();
                while (pos < sourceCode.length) {
                    if (peek() === '*' && peek(1) === '/') {
                        advance();
                        advance();
                        break;
                    }
                    advance();
                }
            } else {
                break;
            }
            skipWhitespace();
        }
    }

    while (pos < sourceCode.length) {
        skipWhitespace();
        skipComments();
        if (pos >= sourceCode.length) break;

        const startLine = line;
        const startCol = col;
        const char = peek();

        // Identifiers and Keywords
        if (/[a-zA-Z_]/.test(char)) {
            let value = '';
            while (pos < sourceCode.length && /[a-zA-Z0-9_]/.test(peek())) {
                value += advance();
            }
            const type = KEYWORDS[value] || TokenType.IDENTIFIER;
            addToken(type, value, startLine, startCol);
            continue;
        }

        // Numbers
        if (/[0-9]/.test(char)) {
            let value = '';
            let hasDot = false;
            while (pos < sourceCode.length && (/[0-9]/.test(peek()) || (!hasDot && peek() === '.'))) {
                if (peek() === '.') hasDot = true;
                value += advance();
            }
            addToken(TokenType.NUMBER, value, startLine, startCol);
            continue;
        }

        // String Literals
        if (char === '"') {
            advance(); // skip quote
            let value = '';
            while (pos < sourceCode.length && peek() !== '"') {
                if (peek() === '\\') {
                    advance();
                    const escape = advance();
                    if (escape === 'n') value += '\n';
                    else if (escape === 't') value += '\t';
                    else if (escape === '"') value += '"';
                    else if (escape === '\\') value += '\\';
                    else value += escape;
                } else {
                    value += advance();
                }
            }
            advance(); // skip quote
            addToken(TokenType.STRING_LITERAL, value, startLine, startCol);
            continue;
        }

        // Char Literals
        if (char === "'") {
            advance(); // skip quote
            let value = '';
            if (peek() === '\\') {
                advance();
                const escape = advance();
                if (escape === 'n') value = '\n';
                else if (escape === 't') value = '\t';
                else if (escape === "'") value = "'";
                else if (escape === '\\') value = '\\';
                else if (escape === '0') value = '\0';
                else value = escape;
            } else {
                value = advance();
            }
            advance(); // skip quote
            addToken(TokenType.CHAR_LITERAL, value, startLine, startCol);
            continue;
        }

        // Multi-char operators and single chars
        let opValue = '';
        if (pos + 1 < sourceCode.length) {
            opValue = char + peek(1);
        }

        if (opValue === '==') { addToken(TokenType.EQUALS, opValue, startLine, startCol); advance(); advance(); continue; }
        if (opValue === '!=') { addToken(TokenType.NOT_EQUALS, opValue, startLine, startCol); advance(); advance(); continue; }
        if (opValue === '<=') { addToken(TokenType.LESS_EQUAL, opValue, startLine, startCol); advance(); advance(); continue; }
        if (opValue === '>=') { addToken(TokenType.GREATER_EQUAL, opValue, startLine, startCol); advance(); advance(); continue; }
        if (opValue === '&&') { addToken(TokenType.AND, opValue, startLine, startCol); advance(); advance(); continue; }
        if (opValue === '||') { addToken(TokenType.OR, opValue, startLine, startCol); advance(); advance(); continue; }
        if (opValue === '++') { addToken(TokenType.INCREMENT, opValue, startLine, startCol); advance(); advance(); continue; }
        if (opValue === '--') { addToken(TokenType.DECREMENT, opValue, startLine, startCol); advance(); advance(); continue; }
        if (opValue === '+=') { addToken(TokenType.PLUS_ASSIGN, opValue, startLine, startCol); advance(); advance(); continue; }
        if (opValue === '-=') { addToken(TokenType.MINUS_ASSIGN, opValue, startLine, startCol); advance(); advance(); continue; }
        if (opValue === '*=') { addToken(TokenType.STAR_ASSIGN, opValue, startLine, startCol); advance(); advance(); continue; }
        if (opValue === '/=') { addToken(TokenType.SLASH_ASSIGN, opValue, startLine, startCol); advance(); advance(); continue; }
        if (opValue === '%=') { addToken(TokenType.PERCENT_ASSIGN, opValue, startLine, startCol); advance(); advance(); continue; }
        if (opValue === '<<') { addToken(TokenType.LEFT_SHIFT, opValue, startLine, startCol); advance(); advance(); continue; }
        if (opValue === '>>') { addToken(TokenType.RIGHT_SHIFT, opValue, startLine, startCol); advance(); advance(); continue; }
        if (opValue === '::') { addToken(TokenType.SCOPE, opValue, startLine, startCol); advance(); advance(); continue; }

        // Single-char tokens
        advance();
        switch (char) {
            case '+': addToken(TokenType.PLUS, char, startLine, startCol); break;
            case '-': addToken(TokenType.MINUS, char, startLine, startCol); break;
            case '*': addToken(TokenType.STAR, char, startLine, startCol); break;
            case '/': addToken(TokenType.SLASH, char, startLine, startCol); break;
            case '%': addToken(TokenType.PERCENT, char, startLine, startCol); break;
            case '=': addToken(TokenType.ASSIGN, char, startLine, startCol); break;
            case '<': addToken(TokenType.LESS, char, startLine, startCol); break;
            case '>': addToken(TokenType.GREATER, char, startLine, startCol); break;
            case '!': addToken(TokenType.NOT, char, startLine, startCol); break;
            case '&': addToken(TokenType.BITWISE_AND, char, startLine, startCol); break;
            case '|': addToken(TokenType.BITWISE_OR, char, startLine, startCol); break;
            case '^': addToken(TokenType.BITWISE_XOR, char, startLine, startCol); break;
            case '(': addToken(TokenType.LPAREN, char, startLine, startCol); break;
            case ')': addToken(TokenType.RPAREN, char, startLine, startCol); break;
            case '{': addToken(TokenType.LBRACE, char, startLine, startCol); break;
            case '}': addToken(TokenType.RBRACE, char, startLine, startCol); break;
            case '[': addToken(TokenType.LBRACKET, char, startLine, startCol); break;
            case ']': addToken(TokenType.RBRACKET, char, startLine, startCol); break;
            case ';': addToken(TokenType.SEMICOLON, char, startLine, startCol); break;
            case ',': addToken(TokenType.COMMA, char, startLine, startCol); break;
            case '.': addToken(TokenType.DOT, char, startLine, startCol); break;
            case '#': addToken(TokenType.HASH, char, startLine, startCol); break;
            case '?': addToken(TokenType.QUESTION, char, startLine, startCol); break;
            case ':': addToken(TokenType.COLON, char, startLine, startCol); break;
            default:
                // Skip unknown characters silently as per standard robust tokenizers or log error
                break;
        }
    }

    addToken(TokenType.EOF, 'EOF', line, col);
    return tokens;
}

module.exports = { TokenType, tokenize };
