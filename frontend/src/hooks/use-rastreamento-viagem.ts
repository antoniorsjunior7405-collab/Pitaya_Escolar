import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { enviarPosicao } from '@/services/motorista';
import type { Coordenada } from '@/types';

/** Intervalo mínimo entre envios: economiza bateria, dados e respeita o rate limit da API. */
const INTERVALO_ENVIO_MS = 10_000;

export type EstadoRastreamento =
  | 'inativo' // sem viagem em andamento
  | 'aguardando-gps' // permissão ok, esperando a primeira posição
  | 'ativo' // última posição enviada com sucesso
  | 'sem-permissao' // a pessoa negou a localização
  | 'erro'; // falha ao obter ou enviar a posição (tenta de novo na próxima leitura)

export type Rastreamento = {
  estado: EstadoRastreamento;
  /** Última posição lida pelo GPS nesta viagem (para o mapa do motorista); null até a primeira. */
  posicao: Coordenada | null;
};

/**
 * Envia a posição do veículo enquanto houver uma viagem em andamento (viagemId != null).
 *
 * Limitação atual (MVP): rastreamento em PRIMEIRO PLANO. Funciona com o app aberto;
 * com a tela bloqueada ou o app em segundo plano, o sistema pausa o GPS. Rastrear em
 * segundo plano exige development build + permissão "sempre" + aprovação da Google Play
 * (ver docs/BOAS_PRATICAS.md, seção Localização).
 */
export function useRastreamentoViagem(viagemId: string | null): Rastreamento {
  const [estado, setEstado] = useState<EstadoRastreamento>('aguardando-gps');
  // Guardamos a viagem junto da posição: ao iniciar outra viagem, a posição da anterior
  // deixa de valer sem precisar limpar o estado dentro do efeito.
  const [leitura, setLeitura] = useState<{ viagemId: string; posicao: Coordenada } | null>(null);

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
          if (!ativo) return;
          // O mapa local acompanha toda leitura; o envio ao servidor continua limitado.
          setLeitura({
            viagemId: id,
            posicao: { latitude: coords.latitude, longitude: coords.longitude },
          });
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

  if (!viagemId) return { estado: 'inativo', posicao: null };
  return { estado, posicao: leitura?.viagemId === viagemId ? leitura.posicao : null };
}
