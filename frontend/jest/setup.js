// Reanimated 4.7 (SDK 58): o resolver do package.json (`react-native-reanimated/jest/resolver`)
// faz o Jest usar a versão web do Reanimated e do Worklets, que são nativos. Aqui só ligamos
// o `setUpTests` do Reanimated (timers de animação e matchers).
require('react-native-reanimated').setUpTests();
