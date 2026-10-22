import { api } from '@/lib/api';
import { aprovarMotorista, revogarAprovacao } from '@/services/admin';

jest.mock('@/lib/api', () => ({ api: jest.fn() }));

const apiMock = jest.mocked(api);

beforeEach(() => jest.clearAllMocks());

test('aprovar motorista: PUT na aprovação, com o id codificado na URL', async () => {
  apiMock.mockResolvedValue({ motoristaId: 'm1', aprovadoEm: '2026-10-22T12:00:00.000Z' });

  await aprovarMotorista('m1/../x');

  expect(apiMock).toHaveBeenCalledWith('/v1/admin/motoristas/m1%2F..%2Fx/aprovacao', {
    method: 'PUT',
  });
});

test('revogar aprovação: DELETE na mesma URL', async () => {
  apiMock.mockResolvedValue({ motoristaId: 'm1', aprovadoEm: null });

  await revogarAprovacao('m1');

  expect(apiMock).toHaveBeenCalledWith('/v1/admin/motoristas/m1/aprovacao', {
    method: 'DELETE',
  });
});
