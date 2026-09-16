# Agente de IA — SAC WhatsApp do CHZN

Agente que tira dúvidas de pacientes usando a base de conhecimento oficial dos
SACs (Psicologia, Nutrição, Hospital Dia, Centro Cirúrgico) e encaminha para o
setor responsável, via WhatsApp, quando necessário.

## Estrutura do projeto

```
src/
  knowledgeBase.json   -> Base de conhecimento (perguntas/respostas por setor)
  knowledgeBase.js      -> Carrega e formata a base de conhecimento
  systemPrompt.js        -> A "constituição" do agente
  tools.js                -> Ferramentas: buscar_conhecimento, encaminhar_setor
  memory.js               -> Memória de curto prazo por paciente (em RAM)
  llamaAgent.js            -> Loop de integração com o Llama via API da Groq
  llamaTools.js            -> Adapta as ferramentas para o formato de tool calling da Groq
  claudeAgent.js           -> (alternativa) mesmo loop usando a API do Claude, caso queira comparar
  whatsapp.js              -> Envio de mensagens via WhatsApp Cloud API
  server.js                -> Webhook (recebe e responde mensagens)
  testar.js                -> Script de teste pelo terminal, sem WhatsApp
```

## 1. Instalação

```bash
npm install
cp .env.example .env
```

Preencha o `.env` com:
- `GROQ_API_KEY` — sua chave da API da Groq (console.groq.com/keys)
- `GROQ_MODEL` — opcional, padrão é `llama-3.3-70b-versatile` (confira em console.groq.com/docs/models se o nome ainda está disponível)
- `KNOWLEDGE_BASE_URL` — opcional, URL que retorna o JSON da biblioteca de conhecimento. Para a biblioteca CHZN: `https://chzn-biblioteca-de-con-p18acds.verdent.app/api/base-conhecimento.json`
- `WHATSAPP_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID` — do seu app configurado no Meta for Developers
- `WHATSAPP_VERIFY_TOKEN` — uma frase secreta escolhida por você, usada só na verificação do webhook
- `NUMERO_PSICOLOGIA`, `NUMERO_NUTRICAO`, `NUMERO_HOSPITAL_DIA`, `NUMERO_CENTRO_CIRURGICO`, etc. — números internos (com WhatsApp) de cada setor, no formato `5592999999999`

Quando `KNOWLEDGE_BASE_URL` estiver configurada, o agente carrega essa fonte ao
iniciar. Ele aceita JSON no formato atual (`setores`) ou uma lista de `cards`.
Quando os cards tiverem `status`, somente os cards com status `publicado` serão
usados. Se a URL falhar ou não tiver cards válidos, o agente usa a base local
em `src/knowledgeBase.json`.

A URL da página da biblioteca (`https://chzn-biblioteca-de-con-p18acds.verdent.app/`)
é HTML e não deve ser usada diretamente nessa variável. Use a rota JSON:
`https://chzn-biblioteca-de-con-p18acds.verdent.app/api/base-conhecimento.json`.

## 2. Testar o "cérebro" do agente (sem WhatsApp ainda)

Isso já funciona só com a `GROQ_API_KEY` preenchida:

```bash
node src/testar.js "Posso receber alimentos trazidos por familiares?"
node src/testar.js "Quero cancelar minha cirurgia de amanhã"
node src/testar.js "Estou com falta de ar, o que eu faço?"
```

Teste principalmente:
- Perguntas que estão exatamente na base → deve responder direto.
- Perguntas parecidas mas não idênticas → deve adaptar a redação, sem inventar.
- Pedidos de ação (agendar, cancelar, reclamar) → deve encaminhar ao setor certo.
- Uma emergência simulada → deve orientar a procurar o PS/SAMU e também encaminhar.
- Perguntas fora do escopo (ex: "qual o resultado do meu exame?") → não deve inventar, deve encaminhar.

## 3. Subir o servidor e conectar ao WhatsApp de verdade

```bash
npm start
```

Isso sobe o servidor na porta definida em `PORT` (padrão 3000). Para a Meta
conseguir chamar seu webhook, ele precisa estar acessível publicamente. Para
testar localmente antes de colocar em um servidor de verdade, use um túnel
(ex: `ngrok http 3000`) e use a URL gerada + `/webhook` como "Callback URL" no
painel do WhatsApp (Meta for Developers > seu app > WhatsApp > Configuration).
Use o mesmo valor de `WHATSAPP_VERIFY_TOKEN` do seu `.env` no campo "Verify Token".

## 4. Próximos passos (fora do escopo deste projeto inicial)

- Trocar a memória em RAM (`memory.js`) por um banco de dados, se o servidor for reiniciar com frequência.
- Adicionar transcrição de áudio (hoje o agente só avisa que recebeu um áudio e, seguindo o prompt, tende a encaminhar).
- Um painel simples para acompanhar os encaminhamentos feitos (hoje eles só chegam como mensagem de WhatsApp pro setor).
- Testes automatizados simulando um "paciente chato" (outro agente de IA fazendo perguntas difíceis em sequência), pra achar falhas antes de colocar em produção — foi o que gerou os melhores ajustes de prompt no vídeo que você me mostrou.