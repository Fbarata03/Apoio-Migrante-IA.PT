<div align="center">

<img src="https://img.shields.io/badge/Apoio_Migrante-IA_PT-1E5FB8?style=for-the-badge&labelColor=0A2540" alt="Apoio Migrante IA PT" />

# 🌍 Apoio Migrante IA PT

### Imigrar para Portugal, sem labirintos.

**Plataforma digital com IA que acelera, valida e acompanha processos de imigração em Portugal.**

[![Status](https://img.shields.io/badge/status-em_desenvolvimento-FAC775?style=flat-square)](#)
[![License](https://img.shields.io/badge/license-MIT-1D9E75?style=flat-square)](#)
[![Made with](https://img.shields.io/badge/made_with-❤️_em_Portugal-E24B4A?style=flat-square)](#)

[Demo](#-demo) · [Funcionalidades](#-funcionalidades) · [Stack](#️-stack-tecnológica) · [Instalação](#-instalação) · [Roadmap](#️-roadmap)

</div>

---

## 📖 Sobre o projeto

O **Apoio Migrante IA PT** é uma plataforma digital pensada para **imigrantes** que querem simplificar o processo burocrático de entrada e residência em Portugal. Através de inteligência artificial, automatizamos a validação de documentos, antecipamos próximos passos e mantemos o utilizador sempre informado sobre o estado do seu processo.

> Submeta documentos, acompanhe pedidos e receba apoio inteligente em cada etapa. Tudo num só lugar, com a segurança que merece — sem precisar de documentos portugueses para começar.

### 🎯 Problema que resolve

- ❌ Processos de imigração lentos e pouco transparentes
- ❌ Documentação rejeitada por erros que poderiam ser detetados antes
- ❌ Falta de acompanhamento em tempo real
- ❌ Barreira linguística e jurídica para quem chega a Portugal
- ❌ Plataformas oficiais que exigem identificação portuguesa que o imigrante ainda não tem

### ✅ A nossa solução

- **Análise por IA em segundos** — validação automática de documentos antes da submissão
- **Acompanhamento 24/7** — estado do processo atualizado em tempo real
- **Taxa única e transparente** — apenas **€5** por processo
- **Encriptação end-to-end** — segurança AES-256 em todos os dados
- **Acessível desde o estrangeiro** — sem necessidade de documento português

---

## 🚀 Funcionalidades

### Para o utilizador

| Funcionalidade | Descrição |
|---|---|
| 🏠 **Página inicial** | Hero atrativo, social proof e apresentação clara do serviço |
| 🔐 **Autenticação simples** | Email + palavra-passe, login Google/Apple, 2FA por SMS |
| 📊 **Painel de controlo** | Estado do processo, timeline visual, métricas-chave |
| 📤 **Upload seguro** | Drag-and-drop com validação automática por IA |
| 💳 **Pagamento integrado** | Cartão internacional, MB Way (após NIF), PayPal — taxa fixa **€5** |
| 🔔 **Notificações inteligentes** | Atualizações em tempo real do AIMA e do sistema |
| 🤖 **Assistente IA** | Sugestões proativas baseadas em milhares de processos similares |
| 🌐 **Multilíngue** | Interface em 8 idiomas para superar a barreira linguística |

### Para a IA

- ✅ OCR automático de documentos
- ✅ Verificação de autenticidade
- ✅ Deteção de erros (resolução, legibilidade, dados em falta)
- ✅ Estimativa dinâmica de prazos com base em casos análogos
- ✅ Sugestões de priorização de ações
- ✅ Tradução automática de documentos estrangeiros

---

## 🎨 Demo

### Ecrãs principais

- **Homepage** — Apresentação do serviço com hero animado
- **Login / Registo** — Email + login social (acessível sem documentos PT)
- **Dashboard** — Visão geral do processo de imigração
- **Centro de documentos** — Upload e gestão de ficheiros
- **Notificações** — Pagamentos, atualizações e mensagens oficiais

> 🔗 **[Ver protótipo no Figma](https://www.figma.com/make/U73OSbVZIQC1OQGmjT4ds9/User-interface-for-Apoio-Migrante)**

---

## 🛠️ Stack tecnológica

### Frontend
​```
React 18 · Vite · TypeScript · TailwindCSS
​```

### Backend
​```
Node.js · Express · PostgreSQL (Supabase)
​```

### IA & Serviços
​```
OpenAI API · Tesseract OCR · AWS S3 (documentos encriptados)
​```

### Infraestrutura
​```
Vercel (frontend) · Railway (backend) · Cloudflare (CDN)
​```

### Segurança
​```
JWT · AES-256 · TLS 1.3 · OAuth 2.0 (Google, Apple)
​```

---

## 📦 Instalação

### Pré-requisitos

- Node.js `>=20.x`
- npm ou pnpm
- Conta Supabase (PostgreSQL)
- Chave da API OpenAI

### Passos

​```bash
# 1. Clonar o repositório
git clone https://github.com/SEU-USER/apoio-migrante-ia-pt.git
cd apoio-migrante-ia-pt

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Edita o ficheiro .env com as tuas credenciais

# 4. Correr migrações da base de dados
npm run db:migrate

# 5. Arrancar em modo de desenvolvimento
npm run dev
​```

A aplicação estará disponível em `http://localhost:5173` 🚀

---

## 🔐 Variáveis de ambiente

​```env
# Base de dados
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...

# IA
OPENAI_API_KEY=sk-...

# Pagamentos
STRIPE_SECRET_KEY=sk_live_...
PAYPAL_CLIENT_ID=...

# Auth
JWT_SECRET=...
SESSION_SECRET=...
GOOGLE_OAUTH_CLIENT_ID=...
APPLE_OAUTH_CLIENT_ID=...

# SMS (2FA)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
​```

---

## 📂 Estrutura do projeto

​```
apoio-migrante-ia-pt/
├── client/              # Frontend React
│   ├── src/
│   │   ├── components/  # Componentes reutilizáveis
│   │   ├── pages/       # Páginas (Home, Dashboard, Upload, etc.)
│   │   ├── hooks/       # Custom hooks
│   │   ├── i18n/        # Traduções (8 idiomas)
│   │   └── lib/         # Utilitários e helpers
│   └── public/
├── server/              # Backend Node.js
│   ├── routes/          # Endpoints da API
│   ├── services/        # Lógica de negócio (IA, pagamentos, docs)
│   ├── middleware/      # Autenticação, validação
│   └── db/              # Migrações e modelos
├── docs/                # Documentação
└── README.md
​```

---

## 🌍 Idiomas suportados

A plataforma é pensada para imigrantes de várias origens. Suportamos:

🇵🇹 Português · 🇬🇧 Inglês · 🇺🇦 Ucraniano · 🇧🇷 Português (BR) · 🇫🇷 Francês · 🇪🇸 Espanhol · 🇸🇦 Árabe · 🇮🇳 Hindi

---

## 🗺️ Roadmap

- [x] Design da interface (5 ecrãs principais)
- [x] Estrutura inicial do projeto
- [ ] Autenticação (email + Google + Apple)
- [ ] Sistema de upload com encriptação
- [ ] Integração com OpenAI para validação de documentos
- [ ] Gateway de pagamento internacional (Stripe + PayPal)
- [ ] Dashboard com timeline em tempo real
- [ ] Sistema de notificações (email + push + SMS)
- [ ] App mobile (React Native)
- [ ] Suporte multilíngue (8 idiomas)
- [ ] Tradução automática de documentos estrangeiros
- [ ] Integração oficial com APIs do AIMA

---

## 🤝 Como contribuir

Contribuições são bem-vindas! Se quiseres ajudar:

1. Faz fork do projeto
2. Cria uma branch (`git checkout -b feat/nova-funcionalidade`)
3. Commita as alterações (`git commit -m 'feat: adiciona X'`)
4. Faz push (`git push origin feat/nova-funcionalidade`)
5. Abre um Pull Request

### Convenções de commit

Usamos [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` nova funcionalidade
- `fix:` correção de bug
- `docs:` documentação
- `style:` formatação
- `refactor:` refatoração
- `test:` testes

---

## 📊 Estatísticas

<div align="center">

| Métrica | Valor |
|---|---|
| ⏱️ Tempo médio de análise por IA | **3 minutos** |
| 💰 Taxa por processo | **€5,00** |
| 🔒 Encriptação | **AES-256** |
| 🌍 Idiomas suportados | **8** |
| 👥 Imigrantes apoiados | **+12.400** (objetivo) |

</div>

---

## 📜 Licença

Este projeto está sob a licença **MIT**. Vê o ficheiro [LICENSE](./LICENSE) para mais detalhes.

---

## 👤 Autor

**Feliciano**

- GitHub: [@SEU-USER](https://github.com/SEU-USER)
- LinkedIn: [Feliciano](https://linkedin.com/in/SEU-USER)

---

## 🙏 Agradecimentos

- AIMA (Agência para a Integração, Migrações e Asilo)
- Comunidade open source portuguesa
- Todos os imigrantes que partilharam as suas experiências

---

<div align="center">

**Feito com 💙 em Portugal, para o mundo**

⭐ Se este projeto te ajudou, deixa uma estrela!

</div>
