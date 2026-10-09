import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import n from 'eslint-plugin-n';
import security from 'eslint-plugin-security';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'drizzle/**', 'node_modules/**', 'eslint.config.js', 'drizzle.config.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  security.configs.recommended,
  n.configs['flat/recommended-module'],
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Plugins do Fastify precisam ser async mesmo sem await (contrato do framework).
      '@typescript-eslint/require-await': 'off',
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      // TypeScript já resolve imports; o plugin n não entende o sufixo .js -> .ts.
      'n/no-missing-import': 'off',
      'n/no-unpublished-import': 'off',
      // Node 24 tem tudo isto; evita falso positivo de "recurso não suportado".
      'n/no-unsupported-features/node-builtins': 'off',
    },
  },
  {
    // Ponto de entrada e scripts de linha de comando controlam o código de saída do processo.
    files: ['src/server.ts', 'src/scripts/**'],
    rules: { 'n/no-process-exit': 'off' },
  },
  {
    // Scripts de linha de comando podem usar console.
    files: ['src/scripts/**'],
    rules: { 'no-console': 'off' },
  },
  {
    // Testes: node:test devolve promises que o runner já acompanha; respostas JSON são dinâmicas;
    // o repositório falso implementa uma interface assíncrona sem precisar de await.
    files: ['**/*.test.ts', 'src/test-utils/**'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  prettier,
);
