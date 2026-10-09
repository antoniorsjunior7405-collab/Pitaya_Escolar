import { StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { StatusAluno, StatusViagem } from '@/types';

type Status = StatusViagem | StatusAluno;
type Tom = 'Neutro' | 'Marca' | 'Sucesso' | 'Atencao';

// Um único lugar define rótulo e tom de cada status. As cores vêm do tema (claro/escuro).
// O status nunca é transmitido só pela cor: sempre há o rótulo em texto.
const STATUS: Record<Status, { rotulo: string; tom: Tom }> = {
  PLANEJADA: { rotulo: 'Planejada', tom: 'Neutro' },
  EM_ANDAMENTO: { rotulo: 'Em andamento', tom: 'Marca' },
  FINALIZADA: { rotulo: 'Finalizada', tom: 'Sucesso' },
  AGUARDANDO: { rotulo: 'Aguardando', tom: 'Neutro' },
  EMBARCADO: { rotulo: 'Embarcado', tom: 'Atencao' },
  ENTREGUE: { rotulo: 'Entregue', tom: 'Sucesso' },
};

export function StatusBadge({ status }: { status: Status }) {
  const theme = useTheme();
  const { rotulo, tom } = STATUS[status];

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Status: ${rotulo}`}
      style={[styles.badge, { backgroundColor: theme[`status${tom}Bg`] }]}>
      <View style={[styles.ponto, { backgroundColor: theme[`status${tom}Text`] }]} />
      <Text style={[styles.texto, { color: theme[`status${tom}Text`] }]}>{rotulo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ponto: { width: 8, height: 8, borderRadius: Radius.pill },
  texto: { fontSize: 13, fontWeight: '600' },
});
