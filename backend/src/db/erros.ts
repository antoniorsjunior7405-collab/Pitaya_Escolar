/** O Drizzle embrulha o erro do driver em `cause`; o código 23505 é violação de UNIQUE no Postgres. */
export function ehViolacaoUnica(erro: unknown): boolean {
  const codigo = (e: unknown) =>
    typeof e === 'object' && e !== null && 'code' in e ? e.code : undefined;
  const causa =
    typeof erro === 'object' && erro !== null && 'cause' in erro ? erro.cause : undefined;
  return codigo(erro) === '23505' || codigo(causa) === '23505';
}
