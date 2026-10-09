-- LGPD: a posição do veículo só é guardada durante a viagem. Remove as que sobraram de
-- viagens já finalizadas antes desta regra existir.
DELETE FROM "posicoes_viagem"
WHERE "viagem_id" IN (SELECT "id" FROM "viagens" WHERE "status" <> 'EM_ANDAMENTO');
