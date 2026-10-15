import { z } from 'zod';

/**
 * Placa no padrão antigo (ABC-1234) ou Mercosul (ABC1D23). Usada no cadastro de veículo
 * pelo admin e pelo próprio motorista. Sai normalizada (maiúsculas, sem hífen) para que a
 * restrição UNIQUE do banco valha para "abc-1234" e "ABC1234" ao mesmo tempo.
 */
export const placaSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/, 'Placa inválida')
  .transform((placa) => placa.replace('-', ''));
