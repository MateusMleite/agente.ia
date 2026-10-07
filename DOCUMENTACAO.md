# Manual Técnico e Arquitetura do Sistema — Agente IA SAC CHZN

Este documento é a documentação técnica oficial da aplicação **Agente IA — SAC CHZN**, contendo os detalhes de arquitetura, fluxo de mensagens, integração de inteligência artificial, persistência de dados, APIs e instruções de deploy.

---

## 1. Visão Geral do Sistema

O **Agente IA SAC CHZN** é um assistente virtual de atendimento ao usuário/paciente do Complexo Hospitalar Zona Norte (CHZN). Seu objetivo é responder a dúvidas sobre os diversos setores do hospital (como Pronto Socorro, Centro Cirúrgico, Nutrição, Psicologia, Ouvidoria/SAU, entre outros) de forma humanizada, ágil e baseada exclusivamente na base de conhecimento oficial.

### Principais Funcionalidades:
- **Atendimento Automatizado via IA**: Processamento de linguagem natural utilizando o modelo Llama alimentado pela infraestrutura da Groq.
- **Consulta Dinâmica à Base de Conhecimento**: O agente utiliza a ferramenta (*tool*) `buscar_conhecimento` para validar respostas antes de enviá-las.
- **Suporte Multicanal**: Integrado com WhatsApp Cloud API, Plataforma Fortics (SZ.chat) e Widget de Chat Web incorporável.
- **Painel de Métricas e Avaliações**: Coleta de contagem de acessos, feedback do usuário (notas de 1 a 5 estrelas) com suporte a persistência híbrida (Memória / Arquivo JSON / Banco de Dados MySQL).

---

## 2. Arquitetura da Solução

O sistema é construído em **Node.js (ES Modules)** utilizando o framework **Express**.

```mermaid
flowchart TD
    subgraph Canais de Entrada
        WA[WhatsApp Cloud API]
        SZ[Fortics / SZ.chat]
        WIDGET[Widget Chat Web]
    end

    subgraph Servidor Express (server.js)
        WH_WA[/webhook Meta/]
        WH_SZ[/fortics-webhook/]
        API_WIDGET[/api/chat & /metricas/]
    end

    subgraph Núcleo de Inteligência (llamaAgent.js)
        SP[System Prompt - systemPrompt.js]
        MEM[Memória em RAM - memory.js]
        GROQ[API Groq - Llama 3.3 / GPT-OSS]
        TOOLS[Ferramentas - tools.js]
        KB[Base de Conhecimento - knowledgeBase.js]
    end

    subgraph Persistência & Métricas
        DB[(MySQL HostGator / Railway)]
        METRICAS[metricas.json / metricas.js]
    end

    WA --> WH_WA
    SZ --> WH_SZ
    WIDGET --> API_WIDGET

    WH_WA --> llamaAgent.js
    WH_SZ --> llamaAgent.js
    API_WIDGET --> llamaAgent.js

    SP --> GROQ
    MEM --> GROQ
    GROQ <-->|Tool Call| TOOLS
    TOOLS <--> KB
    
    server.js --> DB
    server.js --> METRICAS
```

---

## 3. Fluxo de Atendimento e Inteligência Artificial

### 3.1. Integração com a API Groq (`src/llamaAgent.js`)
O núcleo do agente (`responderPaciente`) processa cada mensagem recebida através da API REST da **Groq**:
- **URL Base**: `https://api.groq.com/openai/v1/chat/completions`
- **Fallback Automático de Modelos**: Se um modelo atingir o limite de requisições (HTTP status `429`), o sistema alterna automaticamente para o próximo modelo da lista:
  1. Modelo customizado em `GROQ_MODEL` ou `openai/gpt-oss-120b`
  2. `openai/gpt-oss-20b`
  3. `qwen/qwen3.8-27b`
  4. `groq/compound-mini`

### 3.2. Constitucionalidade / Prompt do Sistema (`src/systemPrompt.js`)
O `montarSystemPrompt()` injeta regras rigorosas:
- **Respostas Baseadas em Fatos**: O agente é instruído a utilizar a ferramenta `buscar_conhecimento` para verificar dados antes de responder.
- **Escopo Restrito**: Impede o agente de inventar dados sobre exames, diagnósticos médicos ou agendamentos diretos.
- **Redirecionamento para o SAU**: Dúvidas fora do escopo são encaminhadas para o Serviço de Atendimento ao Usuário (SAU).

### 3.3. Gestão de Memória (`src/memory.js`)
- Armazena as últimas mensagens trocadas com cada paciente (indexadas por número de telefone ou `sessionId`).
- Mantém o contexto fluido da conversa sem ultrapassar os limites de janela de contexto do modelo.

### 3.4. Tool Calling (`src/tools.js` e `src/llamaTools.js`)
- **`buscar_conhecimento`**: O modelo invoca esta função passando o `setor_id` desejado. O retorno entrega as perguntas, respostas e avisos oficiais cadastrados para aquele setor.

---

## 4. Estrutura de Arquivos do Projeto

```
projeto_agente/
├── .env                       # Variáveis de ambiente secretas (chaves, DB, etc.)
├── .env.example               # Modelo de variáveis de ambiente
├── bd_avaliacao.sql           # Schema SQL para criação das tabelas MySQL
├── HOSTGATOR_DATABASE.md      # Instruções de configuração MySQL no cPanel HostGator
├── DOCUMENTACAO.md            # Este manual técnico
├── README.md                  # Visão geral rápida do projeto
├── package.json               # Dependências do projeto Node.js
├── railway.json               # Configurações de deploy na plataforma Railway
├── chat-widget/               # Interface Web estática (HTML/CSS/JS do Widget)
│   ├── index.html
│   ├── style.css
│   └── script.js
└── src/                       # Código-fonte principal
    ├── server.js              # Servidor HTTP Express e roteamento de Webhooks
    ├── llamaAgent.js          # Loop principal da IA via Groq
    ├── systemPrompt.js        # Definição das regras do sistema para a IA
    ├── tools.js               # Implementação das ferramentas do agente
    ├── llamaTools.js          # Definição das schemas de ferramentas formato OpenAI/Groq
    ├── knowledgeBase.js       # Leitor e buscador da base de conhecimento
    ├── knowledgeBase.json     # Base de dados em formato JSON dos setores/perguntas
    ├── memory.js              # Gerenciador de histórico de conversa em memória
    ├── database.js            # Conector de banco de dados MySQL (`mysql2/promise`)
    ├── metricas.js            # Lógica de cálculo e registro de métricas/avaliações
    ├── metricas.json          # Armazenamento local de backup de métricas
    ├── whatsapp.js            # Integração oficial WhatsApp Cloud API (Meta)
    ├── fortics.js             # Integração com API da plataforma Fortics (SZ.chat)
    ├── whatsappWeb.js         # (Opcional) Integração via whatsapp-web.js
    └── testar.js              # Script utilitário para testar o agente via Terminal
```

---

## 5. Endpoints da API REST (`src/server.js`)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/` | Endpoint de verificação de integridade (*Healthcheck*). |
| `GET` | `/webhook` | Validação de Webhook da Meta/WhatsApp Cloud API. |
| `POST` | `/webhook` | Recebimento de mensagens recebidas via WhatsApp Meta. |
| `POST` | `/fortics-webhook` | Recebimento de mensagens vindas da plataforma Fortics (SZ.chat). |
| `POST` | `/api/chat` | Rota direta para o Widget de Chat Web enviar e receber mensagens. |
| `POST` | `/metricas/acesso` | Registra uma nova sessão/acesso no sistema. |
| `POST` | `/metricas/avaliacao` | Registra a nota (1 a 5) e comentário deixado pelo usuário. |
| `GET` | `/metricas` | Retorna o painel com total de acessos, avaliações e média atual. |
| `GET` | `/widget/*` | Serve os arquivos estáticos do Widget de Chat Web. |

---

## 6. Banco de Dados e Persistência (`bd_avaliacao.sql` & `src/database.js`)

O sistema conta com um modelo de persistência híbrido:
1. Se as variáveis de conexão MySQL estiverem preenchidas no `.env`, as estatísticas e avaliações são salvas diretamente no banco de dados **MySQL**.
2. Caso o banco não esteja configurado, o sistema utiliza o arquivo de fallback `src/metricas.json`.

### Estrutura do Banco de Dados (`bd_avaliacao.sql`):
```sql
CREATE TABLE IF NOT EXISTS acessos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    identificador VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS avaliacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nota INT NOT NULL,
    comentario TEXT NULL,
    identificador VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 7. Variáveis de Ambiente (`.env`)

As variáveis exigidas para a operação completa do sistema incluem:

```env
# Servidor
PORT=3000

# Chave API da Groq (IA)
GROQ_API_KEY=gsk_sua_chave_groq_aqui
GROQ_MODEL=openai/gpt-oss-120b

# WhatsApp Cloud API (Meta)
WHATSAPP_TOKEN=EAAG...
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_VERIFY_TOKEN=sua_frase_secreta_webhook

# Conexão Banco de Dados MySQL (HostGator ou Railway)
DB_HOST=localhost
DB_PORT=3306
DB_NAME=seu_usuario_agente_sac
DB_USER=seu_usuario_dbuser
DB_PASSWORD=sua_senha_segura
# Ou através de URL única:
# DATABASE_URL=mysql://usuario:senha@host:3306/nome_banco

# Configurações Fortics / SZ.chat (Opcional)
FORTICS_API_URL=https://api.sz.chat
FORTICS_API_TOKEN=seu_token_fortics
```

---

## 8. Guia de Deploy

### 8.1. Deploy na Railway
1. Conecte seu repositório GitHub à plataforma **Railway**.
2. O arquivo `railway.json` indicará automaticamente o comando de start (`npm start`).
3. Adicione as variáveis de ambiente no painel **Variables** da Railway.

### 8.2. Deploy na HostGator (Node.js App + MySQL)
1. Crie o banco de dados MySQL via cPanel conforme as instruções detalhadas em [`HOSTGATOR_DATABASE.md`](file:///c:/Users/mmleite/Desktop/projeto_agente/HOSTGATOR_DATABASE.md).
2. Suba o script SQL `bd_avaliacao.sql` no **phpMyAdmin**.
3. Configure a aplicação em **Setup Node.js App** no cPanel e adicione as variáveis no arquivo `.env`.

---

## 9. Como Executar e Testar Localmente

### Instalação de Dependências:
```bash
npm install
```

### Testando o Cérebro do Agente (Terminal):
Para testar como o agente responde sem precisar integrar com WhatsApp ou Webhook:
```bash
node src/testar.js "Quais são os horários de visita do Pronto Socorro?"
```

### Subindo o Servidor HTTP:
```bash
npm start
```
O servidor estará rodando em `http://localhost:3000`. O widget de chat pode ser acessado em `http://localhost:3000/widget`.
