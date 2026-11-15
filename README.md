# GameFeed AI — MVP com autenticação e administração

## O que foi implementado

- Feed jogável com 4 minijogos de demonstração, além de jogos criados com Groq.
- Login Google via Supabase Auth (OAuth PKCE), sessão persistente no navegador.
- Backend valida token Google/Supabase em toda operação protegida.
- Criar, testar e publicar minijogos 2D usando `openai/gpt-oss-120b` via Groq.
- Banco Postgres Supabase para usuários, jogos, prompts, comentários, curtidas e ações de moderação.
- `/admin`: acesso restrito a e-mails listados em `ADMIN_EMAILS` no servidor. Lista de usuários, prompts por severidade **leve, médio e perigo**, advertência, ban temporário/permanente e reversão, trilha de auditoria.
- Contagem de solicitações e tokens informados pela Groq das últimas 300 gerações (não substitui o faturamento do provedor).
- Rate limit simples em memória por ID de usuário; proteção básica. Antes de tráfego real, colocar rate limiting compartilhado no edge/Redis, CAPTCHA e alertas de consumo.

## Configuração para colocar no ar

1. Crie um projeto Supabase em https://supabase.com e execute `sql/001_schema.sql` no **SQL Editor**.
2. No Supabase > Authentication > Providers, habilite **Google**, criando OAuth Client ID/secret no Google Cloud Console. Configure URLs de callback indicadas pelo Supabase. Configure Site URL igual ao domínio final (Render) e Redirect URLs apropriadas.
3. Copie `.env.example` para `.env` localmente. No Render adicione cada chave em **Environment** (não faça commit de `.env`). Informe `ADMIN_EMAILS` com a conta Google do administrador. Não existe senha de administrador hardcoded.
4. Execute `npm start`, acesse `http://localhost:3000`. No Render, publique repositório Git usando Blueprint `render.yaml` ou serviço Node (`npm install`, `npm start`).
5. Teste login Google, geração, publicação e painel `/admin`, incluindo acesso negado a usuário comum, antes de anunciar o domínio.

## Segurança e limitações

- Chaves privadas (`GROQ_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) apenas no backend. A chave anônima Supabase é pública por design.
- Supabase SQL mantém RLS habilitada e remove acesso direto `anon/authenticated` às tabelas. Toda operação passa pelo backend com verificação de sessão, ban e administrador.
- O gerador produz **configurações de jogos** para um motor fechado. **Não executa código arbitrário da IA**, evitando uma grande classe de ataques.
- Triagem de conteúdo é **heurística básica**, não detector confiável de risco. Revisão humana é necessária; risco de falso positivo/negativo.
- `allow` na triagem só altera o status do pedido — **não executa geração retrospectiva**. O usuário precisa enviar pedido novo.
- O painel registra texto completo dos prompts para moderação. Isso são **dados pessoais potenciais**: publicar uma política de privacidade, fixar retenção, mecanismo de exclusão e procedimento de atendimento LGPD antes do lançamento público.
- Uso exibido é parcial (últimas 300 solicitações e tokens disponíveis); para cobrança/confirmação consulte o dashboard da Groq.
- Ban é aplicado em operações autenticadas, não impede acesso a conteúdo público. Outros métodos de abuso precisam de proteção adicional.
- Criação local demonstrativa anterior não é modo de produção. Sem Supabase o feed demo abre, mas operações protegidas e admin não funcionam.
- Faltam testes automatizados de integração com Supabase e Google, controle de fraudes avançado, paginação adequada, segurança de CDN e observabilidade; **não afirmar que houve auditoria completa de segurança**.

## Executar

```bash
npm start
npm test
```
