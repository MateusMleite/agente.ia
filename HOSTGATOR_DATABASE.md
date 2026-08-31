# Configuração do Banco de Dados na HostGator

Este documento orienta sobre como configurar o banco de dados MySQL da aplicação na hospedagem HostGator.

## 1. Criação do Banco de Dados na HostGator
1. Acesse o seu **cPanel** da HostGator.
2. Vá em **Assistente de Banco de Dados MySQL** (MySQL Database Wizard).
3. **Nome do Banco:** Crie um nome (ex: `agente_sac`). *Nota: A HostGator adicionará um prefixo, ex: `usuario_agente_sac`*.
4. **Criar Usuário:** Defina um usuário e uma senha forte. Anote esses dados.
5. **Permissões:** Marque a opção **"Todos os Privilégios"** (ALL PRIVILEGES) para o usuário criado no banco.

## 2. Dados de Conexão (HostGator)
* **Host:** `localhost` (ou o endereço do servidor MySQL fornecido pelo cPanel da HostGator).
* **Porta:** `3306`
* **Nome do Banco:** `usuario_agente_sac` (com o prefixo da sua conta).
* **Usuário:** `usuario_dbuser` (com o prefixo da sua conta).
* **Senha:** A senha cadastrada no cPanel.

## 3. Configuração das Variáveis de Ambiente
Na raiz do seu projeto na hospedagem, certifique-se de configurar o arquivo `.env` (baseado no `.env.example`):

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=usuario_agente_sac
DB_USER=usuario_dbuser
DB_PASSWORD=sua_senha_segura