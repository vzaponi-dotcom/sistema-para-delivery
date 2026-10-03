# UI de equipe, atividades e autenticação — aprovada

## Decisão

Victor aprovou a proposta visual de 01/10/2026, escolheu **Lista compacta** e aprovou o login com o logo Mesiva. Implementar as cinco telas e validar desktop/celular antes de integrar a issue 44. A aprovação não inclui merge ou produção.

Referências locais: `mesiva-acessos-proposta.html` e `mesiva-login-proposta.html`, no diretório de visualizações da conversa. Referência externa: [Sign In Split Screen](https://docs.21st.dev/@felipemenezes098/components/sign-in-6). O código dessa referência requer assinatura; implementar o desenho aprovado com os componentes atuais, sem importar código da biblioteca.

## Requisitos

- Login e ativação compartilham painel de marca e formulário. Usar `/brand/mesiva-logo-dark.svg` sobre azul-marinho, botão turquesa e detalhe amarelo. No celular, painel vira cabeçalho com logo, sem texto promocional grande.
- Login mantém os modos legacy/enrollment/user_only e o contrato atual. Identificador aparece como **Usuário de acesso**, com ajuda para diferenciá-lo do código do convite. Mostrar/ocultar senha, checkbox de dispositivo pessoal (padrão compartilhado 12h, pessoal sete dias), acesso por `/ativar-conta` e ajuda para redefinição pelo gerente.
- Ativação pede código, senha e confirmação; valida confirmação antes de chamar API. Após sucesso, apaga campos e apresenta próximo passo de login, sem autenticar automaticamente. Nenhum token na URL ou persistência.
- Equipe: lista primeiro, nome/usuário/perfil/estado/último acesso; busca e estado locais; ações em menu por pessoa. Convidar abre painel/modal, com Operador como padrão quando disponível, ajuda de identificador e descrição dos perfis fixos. Desativar e redefinir exigem confirmação. Último gerente com acesso ativo não pode ser desativado/rebaixado pela UI; servidor continua autoridade. Convite mostra usuário e código separadamente, instruções de ativação, validade e cópia; só no resultado efêmero.
- Atividades: filtros horizontais com rótulos, reflow no celular, grupos por dia, ação/ator/resultado/hora legíveis. IDs técnicos aparecem apenas ao expandir referência. Detalhe operacional permanece limitado pelo resolvedor de recursos existente; não inventar número de pedido indisponível na API.
- Minha conta: resumo da identidade, formulário separado com senha atual/nova/confirmação, mostrar/ocultar e explicação sobre revogar outras sessões. Preservar coordenador de troca de credenciais.
- Preservar `useAccessRequest`, capabilities, isolamento por sessão, bloqueio de escritas e handlers de erro. Modal compartilhado garante foco/Escape; sem alteração de Worker, migrations, grants, duração de sessão ou endpoints.
- Sem novas dependências. Paleta/tema e componentes existentes. Larguras 320/390/768/1280, texto e controles sem corte/rolagem horizontal; toque mínimo 44px. Tema claro/escuro.

## Validação

Testes dos fluxos de convite, confirmação, filtros, sessão e navegação; suite Node completa, lint, fronteiras e build. Inspeção em navegador do código real com fixtures exclusivamente locais e sem requisições a staging, seguida de screenshots desktop/celular.
