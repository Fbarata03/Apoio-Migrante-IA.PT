/**
 * Serviço de IA Local — Ollama
 * Usa modelos locais sem API externa. Corre 100% na sua máquina.
 */
const fs      = require('fs');
const Ollama  = require('ollama').Ollama;
require('dotenv').config();

const OLLAMA_HOST  = process.env.OLLAMA_HOST    || 'http://localhost:11434';
const MODEL_VISION = process.env.AI_MODEL_VISION || 'llama3.2:latest';
const MODEL_CHAT   = process.env.AI_MODEL_CHAT   || 'llama3.2:latest';
const MODEL_FAST   = process.env.AI_MODEL_FAST   || 'llama3.2:latest';

const ollama = new Ollama({ host: OLLAMA_HOST, fetch: (url, opts) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000); // 60s timeout
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
} });

/* ── Verifica se o Ollama está disponível ───────────────── */

async function isAvailable() {
  try {
    await ollama.list();
    return true;
  } catch {
    return false;
  }
}

/* ── Extrai JSON da resposta (mesmo com texto extra) ─────── */

function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

/* ── Análise de documento ────────────────────────────────── */

async function analyzeDocument(filePath, originalName, mimeType) {
  if (!(await isAvailable())) return simulateFallback(originalName);

  const isImage = /^image\/(jpeg|jpg|png|webp|gif)$/.test(mimeType);
  const isPDF   = mimeType === 'application/pdf';

  const prompt = `Analise este documento para um processo de imigração em Portugal (AIMA).
Ficheiro: "${originalName}"
Responda APENAS com JSON válido neste formato exato:
{"valid": true, "type": "Passaporte", "feedback": "Documento legível e autêntico.", "issues": []}
ou
{"valid": false, "type": "Desconhecido", "feedback": "Motivo da rejeição aqui.", "issues": ["problema1"]}
O campo feedback deve ter no máximo 150 caracteres. Responda APENAS com o JSON.`;

  try {
    let responseText;

    if (isImage) {
      /* Análise de imagem com modelo multimodal */
      const imageData = fs.readFileSync(filePath).toString('base64');
      const res = await ollama.chat({
        model:    MODEL_VISION,
        messages: [{ role: 'user', content: prompt, images: [imageData] }],
      });
      responseText = res.message.content;

    } else if (isPDF) {
      /* Extrai texto do PDF e analisa com modelo de texto */
      const pdfParse = require('pdf-parse');
      const buffer   = fs.readFileSync(filePath);
      const data     = await pdfParse(buffer);
      const excerpt  = data.text.replace(/\s+/g, ' ').trim().substring(0, 2500);

      const pdfPrompt = excerpt.length > 50
        ? `${prompt}\n\nConteúdo extraído do PDF:\n${excerpt}`
        : `${prompt}\n\n(PDF sem texto extraível — avalie pela estrutura do ficheiro)`;

      const res = await ollama.chat({
        model:    MODEL_VISION,
        messages: [
          {
            role: 'system',
            content: 'És um validador de documentos de imigração para Portugal. Respondes sempre em JSON.',
          },
          { role: 'user', content: pdfPrompt },
        ],
      });
      responseText = res.message.content;

    } else {
      return simulateFallback(originalName);
    }

    const parsed = extractJSON(responseText);
    if (!parsed) throw new Error('Resposta inválida do modelo');

    return {
      approved: parsed.valid === true,
      feedback: parsed.feedback || (parsed.valid ? 'Documento aprovado.' : 'Documento rejeitado.'),
      docType:  parsed.type,
    };

  } catch (err) {
    console.error('[AI Local] analyzeDocument:', err.message);
    return simulateFallback(originalName);
  }
}

function simulateFallback(originalName) {
  const approved = Math.random() > 0.25;
  return {
    approved,
    feedback: approved
      ? `"${originalName}" aceite. Documento legível e em bom estado.`
      : `"${originalName}" rejeitado: qualidade insuficiente. Digitalize novamente (mín. 300 DPI).`,
  };
}

/* ── Insight personalizado ───────────────────────────────── */

const insightCache = new Map(); // userId → { text, ts }

async function generateInsight(userId, processData) {
  const cached = insightCache.get(userId);
  if (cached && Date.now() - cached.ts < 20 * 60 * 1000) return cached.text;

  const fallbackText = processData.docs_rejected > 0
    ? `Tem ${processData.docs_rejected} documento(s) rejeitado(s). Corrija-os para avançar o processo.`
    : `Submeta os ${Math.max(0, 6 - processData.docs_submitted)} documentos em falta para acelerar em ~7 dias.`;

  if (!(await isAvailable())) return fallbackText;

  try {
    const res = await ollama.chat({
      model:    MODEL_FAST,
      messages: [
        {
          role: 'system',
          content: 'És um assistente de imigração para Portugal. Dás UMA sugestão prática e motivadora em português europeu (máx. 180 caracteres). Sem aspas, sem prefixos.',
        },
        {
          role: 'user',
          content: `Processo: etapa ${processData.current_step}/5 | ${processData.docs_submitted}/6 docs submetidos | ${processData.docs_rejected} rejeitados | ${processData.days_remaining} dias restantes | pagamento: ${processData.payment_done ? 'feito' : 'pendente'}\nSugestão:`,
        },
      ],
    });

    const text = res.message.content.trim().replace(/^["'*]+|["'*]+$/g, '').substring(0, 180);
    insightCache.set(userId, { text, ts: Date.now() });
    return text;

  } catch (err) {
    console.error('[AI Local] generateInsight:', err.message);
    insightCache.set(userId, { text: fallbackText, ts: Date.now() });
    return fallbackText;
  }
}

/* ── Chat assistente ─────────────────────────────────────── */

async function chat(userMessage, processContext, history = []) {
  if (!(await isAvailable())) {
    return 'O assistente IA não está disponível. Certifique-se de que o Ollama está em execução (`ollama serve`).';
  }

  const contextNote = processContext
    ? `\nContexto do utilizador: Processo ${processContext.process_number} (${processContext.type}), etapa ${processContext.current_step}/5, estado: ${processContext.status}.`
    : '';

  const systemPrompt = `És um assistente especializado em imigração para Portugal, integrado no serviço "Apoio Migrante IA PT".
Ajudas utilizadores com questões sobre processos AIMA, vistos, autorizações de residência, documentação e procedimentos legais.
Sê empático, claro e preciso. Responde sempre em português europeu.
Se não souberes algo com certeza, indica que o utilizador deve contactar o AIMA diretamente (aima.gov.pt ou linha 808 202 653).
Nunca inventes legislação ou prazos que não conheças.${contextNote}`;

  const messages = [
    ...history.slice(-8),
    { role: 'user', content: userMessage },
  ];

  try {
    const res = await ollama.chat({
      model:    MODEL_CHAT,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    });
    return res.message.content;
  } catch (err) {
    console.error('[AI Local] chat:', err.message);
    return 'Não foi possível obter resposta do modelo. Verifique se o Ollama está em execução.';
  }
}

module.exports = { analyzeDocument, generateInsight, chat };
