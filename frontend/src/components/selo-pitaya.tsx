import { StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Selo da fruta (casca magenta, miolo claro com sementes e folha verde).
// Desenho decorativo: quem usa decide o rótulo para o leitor de tela.
// As medidas são proporcionais ao `tamanho` para o selo servir na marca e na animação.
export function SeloPitaya({ tamanho = 72 }: { tamanho?: number }) {
  const theme = useTheme();
  const escala = tamanho / 72;
  const miolo = 40 * escala;
  const semente = Math.max(3, 4 * escala);

  return (
    <View
      style={[styles.selo, { width: tamanho, height: tamanho, backgroundColor: theme.primary }]}>
      <View
        style={[
          styles.miolo,
          { width: miolo, height: miolo, gap: 5 * escala, backgroundColor: theme.background },
        ]}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.semente,
              { width: semente, height: semente, backgroundColor: theme.text },
            ]}
          />
        ))}
      </View>
      <View
        style={[
          styles.folha,
          {
            top: -6 * escala,
            right: 8 * escala,
            width: 18 * escala,
            height: 10 * escala,
            backgroundColor: theme.secondary,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  selo: { borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  miolo: {
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  semente: { borderRadius: Radius.pill },
  folha: { position: 'absolute', borderRadius: Radius.pill, transform: [{ rotate: '-35deg' }] },
});
