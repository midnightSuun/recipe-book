const js = require('@eslint/js')
const react = require('eslint-plugin-react')
const reactHooks = require('eslint-plugin-react-hooks')
const globals = require('globals')

module.exports = [
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'coverage/**',
            'lh-mobile.json',
        ],
    },
    {
        files: ['src/**/*.{js,jsx}'],
        ...js.configs.recommended,
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                ...globals.browser,
                ...globals.builtin,
            },
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
        },
    },
    {
        files: ['src/**/*.{js,jsx}'],
        ...react.configs.flat.recommended,
        ...react.configs.flat['jsx-runtime'],
        rules: {
            ...react.configs.flat.recommended.rules,
            ...react.configs.flat['jsx-runtime'].rules,
            'react/prop-types': 'off',
        },
    },
    {
        files: ['src/**/*.{js,jsx}'],
        ...reactHooks.configs.flat.recommended,
    },
    {
        files: ['vitest.config.mjs'],
        ...js.configs.recommended,
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...globals.builtin,
            },
        },
    },
    {
        files: ['webpack.config.js', 'babel.config.js', 'eslint.config.js'],
        ...js.configs.recommended,
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
                ...globals.builtin,
            },
        },
    },
]
