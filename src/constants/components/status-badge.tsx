import { StyleSheet, Text, View } from 'react-native';

import type { StatusAluno, StatusViagem } from '@/types';

type Status = StatusViagem | StatusAluno;

// Um único lugar define o texto e as cores de cada status.
const ESTILOS: Record<Status, { rotulo: string; fundo: string; texto: string }> = {
  PLANEJADA: { rotulo: 'Planejada', fundo: '#E5E7EB', texto: '#374151' },
  EM_ANDAMENTO: { rotulo: 'Em andamento', fundo: '#DBEAFE', texto: '#1E40AF' },
  FINALIZADA: { rotulo: 'Finalizada', fundo: '#D1FAE5', texto: '#065F46' },
  AGUARDANDO: { rotulo: 'Aguardando', fundo: '#E5E7EB', texto: '#374151' },
  EMBARCADO: { rotulo: 'Embarcado', fundo: '#FEF3C7', texto: '#92400E' },
  ENTREGUE: { rotulo: 'Entregue', fundo: '#D1FAE5', texto: '#065F46' },
};

export function StatusBadge({ status }: { status: Status }) {
  const estilo = ESTILOS[status];
  return (
    <View style={[styles.badge, { backgroundColor: estilo.fundo }]}>
      <Text style={[styles.texto, { color: estilo.texto }]}>{estilo.rotulo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  texto: {
    fontSize: 12,
    fontWeight: '600',
  },
});
