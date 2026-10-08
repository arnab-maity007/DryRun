export default [{
    files: ["**/*.js"],
    languageOptions: {
        globals: {
            require: "readonly",
            module: "readonly",
            exports: "readonly",
            console: "readonly",
            process: "readonly",
            __dirname: "readonly",
            suite: "readonly",
            test: "readonly"
        },
        ecmaVersion: 2022,
        sourceType: "commonjs",
    },

    rules: {
        "no-const-assign": "warn",
        "no-this-before-super": "warn",
        "no-undef": "warn",
        "no-unreachable": "warn",
        "no-unused-vars": "warn",
        "constructor-super": "warn",
        "valid-typeof": "warn",
    },
}];