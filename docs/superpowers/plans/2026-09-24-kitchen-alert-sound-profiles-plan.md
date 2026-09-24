# Alertas sonoros configuráveis — Plano de implementação

**Spec:** `docs/superpowers/specs/2026-09-24-kitchen-alert-sound-profiles-design.md`  
**Branch:** `feature/kitchen-alert-sound-profiles`  
**Base:** `master@b82406e41ac62560d6ed61acb31c4b18a53d30ae`

## Regras

- TDD RED → GREEN.
- Sem produção.
- Sem biblioteca de áudio nova.
- Preservar `kitchen-sound-enabled`.
- Preservar compatibilidade Kitchen TV `chrome69`.
- Staging somente depois dos gates automatizados.
- Merge somente após homologação manual e autorização explícita.

## Task 1 — catálogo compartilhado e player Web Audio

Criar:

- `src/shared/utils/kitchenAlertCatalog.js`;
- `src/shared/utils/kitchenAlertCatalog.test.js`;
- `src/infrastructure/audio/kitchenAlertPlayer.js`;
- `src/infrastructure/audio/kitchenAlertPlayer.test.js`.

Modificar:

- `src/domains/orders/infrastructure/browserOrderAlert.js`;
- `src/kitchen-display/kitchenDisplayAudio.js`;
- testes dos dois adapters.

RED:

- exigir cinco perfis;
- exigir defaults Admin/TV;
- exigir três volumes;
- exigir player compartilhado;
- exigir sequência mais longa que o bip atual nos perfis novos;
- exigir fallback e áudio bloqueado sem throw.

GREEN:

- catálogo plain-data;
- player compartilhado;
- adapters finos;
- nenhum pacote novo.

## Task 2 — persistência local de perfil e volume

Modificar:

- `src/infrastructure/storage/kitchenSoundPreference.js`;
- `src/infrastructure/storage/kitchenSoundPreference.test.js`.

RED:

- novas chaves;
- defaults;
- normalização de valor inválido;
- leitura/escrita de perfil e volume;
- preservação da chave booleana existente.

GREEN:

- helpers independentes;
- storage failure seguro;
- nenhum migration/backend.

## Task 3 — Admin/Cozinha consome perfil e volume

Modificar:

- `src/App.jsx`;
- `src/domains/orders/application/useOrderArrivals.js`;
- testes de realtime/alerta existentes.

RED:

- chegada repassa `profile` e `volume` ao player;
- preview aceita override;
- habilitar som continua tocando prévia;
- estado local inicializa dos helpers.

GREEN:

- sem mudar polling/detecção;
- sem duplicar alertas;
- reset atual preservado.

## Task 4 — UI de Preferências deste dispositivo

Modificar:

- `src/app/surfaces/settings/SettingsSurface.jsx`;
- `src/app/surfaces/settings/local/DevicePreferences.jsx`;
- `src/settings.css`;
- testes da tela/preferências.

RED:

- cinco opções;
- botão Ouvir por opção;
- volume Normal / Alto / Máximo;
- callbacks de save e preview;
- mobile sem corte estrutural.

GREEN:

- lista acessível;
- autosave existente;
- feedback de persistência;
- tokens dos temas existentes.

## Task 5 — seletor local na Kitchen TV

Modificar:

- `src/kitchen-display/KitchenDisplayApp.jsx`;
- `src/kitchen-display/kitchen-display.css`;
- `src/kitchen-display/KitchenDisplayApp.test.js`;
- `src/kitchen-display/kitchenDisplayBoundary.test.js`.

RED:

- defaults `kitchen-strong/max`;
- seletor e preview em `start-required`;
- persistência local;
- chegada usa escolha atual;
- boundary continua sem chunks administrativos.

GREEN:

- controles simples compatíveis com remote/legado;
- preview no gesto;
- fullscreen/pairing inalterados.

## Task 6 — gates finais e staging

1. Atualizar trigger de staging para a branch da feature.
2. Rodar Validate completo:
   - testes;
   - architecture;
   - lint;
   - build;
   - Worker production/staging dry-run;
   - D1 local/gates existentes.
3. Publicar staging.
4. Smoke:
   - login;
   - `/configuracoes/dispositivo` se houver deep link canônico aplicável;
   - `/cozinha-tv`.

## Task 7 — homologação manual

Admin desktop/mobile:

- alternar on/off;
- ouvir cada um dos cinco perfis;
- trocar volume;
- confirmar persistência após F5;
- confirmar que preview não muda seleção;
- criar/receber novo pedido e confirmar som uma vez.

Kitchen TV moderna:

- seleção;
- preview;
- volume;
- iniciar painel;
- alerta de nova chegada.

Samsung UN32T4300AG / Tizen legado:

- pareamento;
- tela pronta;
- seleção;
- preview;
- volume;
- iniciar painel/fullscreen;
- renderização dos pedidos;
- novo pedido com alerta audível;
- sem fechamento silencioso.

## Task 8 — fechamento

- registrar matriz QA;
- atualizar body da PR;
- Validate documental final;
- manter PR sem merge até autorização explícita;
- produção continua separada.
