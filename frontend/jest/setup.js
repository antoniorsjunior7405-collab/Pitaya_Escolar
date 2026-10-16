/* global jest */
// Reanimated 4 roda sobre o react-native-worklets, que é nativo: no Jest usamos o mock
// oficial dele e o `setUpTests` do Reanimated (timers de animação e matchers).
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

require('react-native-reanimated').setUpTests();
