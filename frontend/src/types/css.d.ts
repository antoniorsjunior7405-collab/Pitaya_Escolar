// Permite importar CSS (usado só na web, ex.: src/global.css com as fontes).
// O Expo gera uma declaração equivalente em expo-env.d.ts ao rodar `expo start`, mas esse
// arquivo não é versionado: sem esta declaração, um clone novo do repositório não compila.
declare module '*.css';
