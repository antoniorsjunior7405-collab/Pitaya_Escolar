import { act, render, screen } from '@testing-library/react-native';

import { MapaVeiculo } from '@/components/mapa-veiculo';
import { MENSAGEM_ERRO_MAPA } from '@/lib/mapa-html';

// A WebView é nativa: no Jest vira uma View que guarda as props e registra o JS injetado.
const mockInjectJavaScript = jest.fn();
jest.mock('react-native-webview', () => {
  const { useImperativeHandle } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  function WebView({ ref, ...props }: { ref: unknown }) {
    useImperativeHandle(ref, () => ({ injectJavaScript: mockInjectJavaScript }));
    return <View testID="webview" {...props} />;
  }
  return { WebView };
});

const posicao = { latitude: -23.55052, longitude: -46.633308 };
const webView = () => screen.getByTestId('webview');

test('mostra o mapa numa WebView, descrito para o leitor de tela', async () => {
  await render(<MapaVeiculo posicao={posicao} titulo="Van (ABC1D23)" />);
  expect(screen.getByLabelText('Mapa com a posição atual do veículo: Van (ABC1D23)')).toBeTruthy();
  expect(webView().props.source.html).toContain('[-46.633308,-23.55052]');
});

test('nova posição move o marcador sem recarregar a página do mapa', async () => {
  await render(<MapaVeiculo posicao={posicao} titulo="Van" />);
  const htmlInicial = webView().props.source.html;
  await screen.rerender(
    <MapaVeiculo posicao={{ latitude: -23.56, longitude: -46.64 }} titulo="Van" />,
  );
  expect(webView().props.source.html).toBe(htmlInicial);
  expect(mockInjectJavaScript).toHaveBeenLastCalledWith(
    expect.stringContaining('window.atualizarPosicao(-46.64, -23.56)'),
  );
});

test('se o mapa não carregar (ex.: sem internet), troca por um aviso em vez de ficar em branco', async () => {
  await render(<MapaVeiculo posicao={posicao} titulo="Van" />);
  await act(() => webView().props.onMessage({ nativeEvent: { data: MENSAGEM_ERRO_MAPA } }));
  expect(screen.getByText(/Não foi possível carregar o mapa/)).toBeTruthy();
  expect(screen.queryByTestId('webview')).toBeNull();
});

test('links da página (ex.: crédito do mapa) não navegam dentro do mapa', async () => {
  await render(<MapaVeiculo posicao={posicao} titulo="Van" />);
  const permitir = webView().props.onShouldStartLoadWithRequest;
  expect(permitir({ url: 'about:blank' })).toBe(true);
  expect(permitir({ url: 'https://www.openstreetmap.org/copyright' })).toBe(false);
});
