import { Alert } from 'react-native';

import * as nativo from '@/lib/dialogo';
import * as web from '@/lib/dialogo.web';

afterEach(() => jest.restoreAllMocks());

describe('web (o Alert do React Native não faz nada no navegador)', () => {
  // O ambiente do Jest é o do React Native: não há window.confirm/alert para espiar.
  const confirm = jest.fn<boolean, [string]>();
  const alert = jest.fn<void, [string]>();
  beforeEach(() => {
    confirm.mockReset();
    alert.mockReset();
    Object.assign(window, { confirm, alert });
  });

  test('regressão: confirmar abre o diálogo do navegador e segue se a pessoa aceitar', () => {
    confirm.mockReturnValue(true);
    const aoConfirmar = jest.fn();
    web.confirmar('Finalizar viagem?', 'Sem volta.', 'Finalizar', aoConfirmar);
    expect(confirm).toHaveBeenCalledWith('Finalizar viagem?\n\nSem volta.');
    expect(aoConfirmar).toHaveBeenCalledTimes(1);
  });

  test('confirmar não segue se a pessoa cancelar', () => {
    confirm.mockReturnValue(false);
    const aoConfirmar = jest.fn();
    web.confirmar('Finalizar viagem?', 'Sem volta.', 'Finalizar', aoConfirmar);
    expect(aoConfirmar).not.toHaveBeenCalled();
  });

  test('avisar mostra título e mensagem', () => {
    web.avisar('Não foi possível concluir', 'Sem conexão.');
    expect(alert).toHaveBeenCalledWith('Não foi possível concluir\n\nSem conexão.');
  });
});

describe('nativo', () => {
  test('confirmar usa o Alert com Cancelar e o botão de confirmação', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const aoConfirmar = jest.fn();
    nativo.confirmar('Finalizar viagem?', 'Sem volta.', 'Finalizar', aoConfirmar);

    const botoes = alert.mock.calls[0]?.[2] ?? [];
    expect(botoes.map((b) => b.text)).toEqual(['Cancelar', 'Finalizar']);
    expect(aoConfirmar).not.toHaveBeenCalled();
    botoes[1]?.onPress?.();
    expect(aoConfirmar).toHaveBeenCalledTimes(1);
  });
});
