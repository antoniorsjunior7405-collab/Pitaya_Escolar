import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { enviarPosicao } from '@/services/motorista';

/** Intervalo mínimo entre envios: economiza bateria, dados e respeita o rate limit da API. */
const INTERVALO_ENVIO_MS = 10_000;

export type EstadoRastreamento =
  | 'inativo' // sem viagem em andamento
  | 'aguardando-gps' // permissão ok, esperando a primeira posição
  | 'ativo' // última posição enviada com sucesso
  | 'sem-permissao' // a pessoa negou a localização
  | 'erro'; // falha ao obter ou enviar a posição (tenta de novo na próxima leitura)

/**
 * Envia a posição do veículo enquanto houver uma viagem em andamento (viagemId != null).
 *
 * Limitação atual (MVP): rastreamento em PRIMEIRO PLANO. Funciona com o app aberto;
 * com a tela bloqueada ou o app em segundo plano, o sistema pausa o GPS. Rastrear em
 * segundo plano exige development build + permissão "sempre" + aprovação da Google Play
 * (ver docs/BOAS_PRATICAS.md, seção Localização).
 */
export function useRastreamentoViagem(viagemId: string | null): EstadoRastreamento {
  const [estado, setEstado] = useState<EstadoRastreamento>('aguardando-gps');

  useEffect(() => {
    if (!viagemId) return;
    let ativo = true;
    let assinatura: Location.LocationSubscription | undefined;
    let ultimoEnvio = 0;

    async function iniciar(id: string) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!ativo) return;
      if (status !== Location.PermissionStatus.GRANTED) {
        setEstado('sem-permissao');
        return;
      }
      setEstado('aguardando-gps');

      assinatura = await Location.watchPositionAsync(
        {
          // Balanced (~100 m, sem forçar GPS o tempo todo) já basta para "onde está a van"
          // e gasta bem menos bateria que High.
          accuracy: Location.Accuracy.Balanced,
          timeInterval: INTERVALO_ENVIO_MS,
          distanceInterval: 20,
        },
        ({ coords }) => {
          const agora = Date.now();
          if (agora - ultimoEnvio < INTERVALO_ENVIO_MS) return;
          ultimoEnvio = agora;
          enviarPosicao(id, {
            latitude: coords.latitude,
            longitude: coords.longitude,
            // O GPS informa velocidade negativa/nula quando não sabe.
            velocidade: coords.speed !== null && coords.speed >= 0 ? coords.speed : null,
          })
            .then(() => ativo && setEstado('ativo'))
            .catch(() => ativo && setEstado('erro'));
        },
        () => ativo && setEstado('erro'),
      );
      // Se a tela saiu enquanto esperávamos a assinatura, encerramos já.
      if (!ativo) assinatura.remove();
    }

    iniciar(viagemId).catch(() => ativo && setEstado('erro'));

    return () => {
      ativo = false;
      assinatura?.remove();
    };
  }, [viagemId]);

  return viagemId ? estado : 'inativo';
}
