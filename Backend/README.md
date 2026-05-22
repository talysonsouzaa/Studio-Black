# Studio Black – Borel Barber 🪒

Site completo com sistema de agendamento online integrado ao WhatsApp.

---

## 📁 Estrutura do Projeto

```
/frontend
  index.html   → Página principal
  style.css    → Estilos (tema preto/amarelo/branco)
  script.js    → Lógica do agendamento e integração com backend

/backend
  app.py       → API Flask (rotas /horarios e /agendar)
  db.py        → Conexão e inicialização do banco MySQL
  requirements.txt
```

---

## 🚀 Como Rodar

### 1. Pré-requisitos

- Python 3.9+
- MySQL 8.0+ instalado e rodando
- Navegador moderno

---

### 2. Configurar o Backend

#### Instalar dependências Python

```bash
cd backend
pip install -r requirements.txt
```

#### Configurar credenciais MySQL

Abra `backend/db.py` e edite:

```python
DB_CONFIG = {
    'host':     'localhost',
    'port':     3306,
    'user':     'root',       # seu usuário MySQL
    'password': 'sua_senha',  # sua senha MySQL
    'database': 'studio_black',
}
```

#### Iniciar o servidor

```bash
cd backend
python app.py
```

O backend sobe em `http://localhost:5000`.

> O banco `studio_black` e a tabela `agendamentos` são criados automaticamente na primeira execução.

---

### 3. Abrir o Frontend

Abra o arquivo `frontend/index.html` diretamente no navegador, ou sirva via servidor local:

```bash
cd frontend
python -m http.server 8080
# Acesse: http://localhost:8080
```

> Se o backend não estiver disponível, o site funciona em **modo fallback** — abre o WhatsApp diretamente sem salvar no banco.

---

## 🔌 Endpoints da API

### `GET /horarios`
Retorna horários ocupados para um barbeiro em uma data.

**Query params:** `barbeiro`, `data` (formato `YYYY-MM-DD`)

**Resposta:**
```json
{ "ocupados": ["09:00:00", "10:30:00"] }
```

---

### `POST /agendar`
Salva um agendamento se não houver conflito.

**Body JSON:**
```json
{
  "barbeiro": "Borel Barber",
  "servico":  "Corte",
  "data":     "2024-08-15",
  "horario":  "10:00:00"
}
```

**Respostas:**
- `201` → Agendamento salvo
- `409` → Horário já ocupado
- `400` → Dados inválidos

---

### `GET /health`
Verifica se a API está no ar.

---

## 🗄️ Banco de Dados

**Tabela:** `agendamentos`

| Campo    | Tipo         | Descrição              |
|----------|--------------|------------------------|
| id       | INT PK AUTO  | Identificador único    |
| barbeiro | VARCHAR(100) | Nome do barbeiro       |
| servico  | VARCHAR(150) | Nome do serviço        |
| data     | DATE         | Data do agendamento    |
| horario  | TIME         | Horário do agendamento |
| criado_em| TIMESTAMP    | Data/hora de criação   |

---

## 📲 WhatsApp

A lógica de redirecionamento é automática:

| Barbeiro      | Número          |
|---------------|-----------------|
| Borel Barber  | +55 31 8112-6249 |
| Junior Barber | +55 31 9202-7328 |

A mensagem enviada ao WhatsApp segue o formato:

```
Olá! Quero agendar:
Barbeiro: Borel Barber
Serviço: Corte
Data: Segunda, 15/08/2024
Horário: 10:00
```

---

## 🎨 Design

- **Cores:** Preto `#0a0a0a`, Ouro `#d4a843`, Branco `#f5f5f0`
- **Fontes:** Bebas Neue (display), Playfair Display (títulos), DM Sans (corpo)
- **Animação:** Loader inicial + fade-in por seção
- **Responsivo:** Mobile-first

---

## ✅ Funcionalidades

- [x] Loader animado na entrada
- [x] Header fixo com scroll effect
- [x] Hero com animações reveal
- [x] Seção "Sobre a Studio Black"
- [x] Vitrine de serviços com preços
- [x] Seleção de barbeiro (cards interativos)
- [x] Seleção de serviço
- [x] Calendário dinâmico (7 dias, sem domingo)
- [x] Horários disponíveis (09:00–17:30, 30min)
- [x] Bloqueio de horários passados no dia atual
- [x] Verificação de conflito no backend
- [x] Agendamento no MySQL com UNIQUE constraint
- [x] Redirecionamento ao WhatsApp correto
- [x] Modo fallback (sem backend)
- [x] Feedback visual em cada etapa
- [x] Layout responsivo (mobile/desktop)
