# QA da UI de acesso — 01/10/2026

## Escopo e aprovação

Refinamento aprovado pelo Victor: lista compacta de equipe, atividades, Minha conta, login Mesiva inspirado no Sign In Split Screen e ativação. Sem importação do código pago do 21st.dev ou dependências adicionais.

## Evidências locais

- Baseline: 32 testes de acesso/shell passaram.
- Login/senhas: três testes novos falharam antes da implementação e passaram depois. Confirmações divergentes não chamam API/coordenador; segredo apagado no sucesso; ativação requer ação explícita de voltar ao login.
- Equipe: três testes novos RED → GREEN. Convite abre sob demanda, payload usa Operador, filtro é local, reset só envia após confirmação, cancelar não envia, último gerente utilizável protegido na UI. Testes anteriores continuam verificando conflito autoritativo e ownership.
- Atividades: referência começa recolhida; contrato dos filtros, cursor e abertura permitida preservado. Seis testes passaram.
- Integração de sessão: cenário existente de rotação foi atualizado para preencher a nova confirmação, mantendo asserções de bloqueio da troca durante rotação/verificação. Suite focada: 45 testes passaram.
- Suite completa: **3.165 passaram, zero falhas**, zero skips, 134,7s. Primeiro run encontrou somente fixture de rotação sem a nova confirmação; corrigida no segundo run.
- Architecture OK. Lint sem erros (avisos já existentes em runtime/testes). Build passou; aviso existente de chunks grandes.

## Inspeção visual do código real

Fixtures e API injetada exclusivamente locais, sem requisições a staging ou mutação de dados externos.

- 1280px: login, equipe compacta e atividades, tema claro.
- 390px: convite em modal, Minha conta, login e ativação. Login escuro: largura útil/content ambos 375px; logo carregado; sem overflow de componentes.
- 320px: atividades; campos de data passaram a uma coluna no limite de 400px e respeitam largura do contêiner. No navegador desktop com scrollbar, a largura mínima global de 320px preexistente é maior que a área útil de 305px; isso não foi alterado por esta UI. Em 390px a largura do documento coincide com a área útil.
- 768px: ativação em duas colunas, tema escuro; área útil/content ambos 753px.
- Rótulos dos selects são visíveis e usam SystemSelect existente (inclui seletor móvel). Senhas têm controles de 44px e campos de 16px no celular. Modal existente mantém foco/Escape.

Screenshots locais na pasta de visualizações da conversa: `mesiva-login-implementado-desktop.png` e `mesiva-login-implementado-celular.png`.

## Limites

Esta validação visual usa Chrome do navegador local; não substitui aparelhos físicos/Safari nem os testes operacionais de impressão registrados na QA original. Minha conta mostra nome/perfil retornados pela sessão; identificador só aparece se disponível no contexto, sem inventar ou obter dados gerenciais para um operador.

## Integração

Revisão independente e deploy em staging serão registrados após sua conclusão. Sem merge ou produção.
