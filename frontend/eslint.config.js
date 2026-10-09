const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

// prettier por último: desliga regras de formatação do ESLint (quem formata é o Prettier).
module.exports = defineConfig([globalIgnores(['dist/*', '.expo/*']), expoConfig, prettier]);
