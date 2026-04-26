/* ============================================================
   Apoio Migrante IA PT v2.0 — app.js
   ============================================================ */

const API = 'http://localhost:3001/api';

let token       = localStorage.getItem('am_token');
let profile     = null;
let pollTimer   = null;
let sseSource   = null;
let chatHistory = [];

/* ── Utilitários ─────────────────────────────────────────── */

function getInitials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
}

function formatBytes(b) {
  if (!b) return '—';
  return b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (h < 1)  return 'há momentos';
  if (h < 24) return `há ${h}h`;
  if (d < 7)  return `há ${d} dia${d > 1 ? 's' : ''}`;
  return new Date(dateStr).toLocaleDateString('pt-PT');
}

function ptDate() {
  return new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
}

function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast ${type} show`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 4000);
}

async function apiFetch(path, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...opts.headers,
  };
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (res.status === 401) { logout(); return null; }
  return res;
}

/* ── Navegação ───────────────────────────────────────────── */

function showScreen(id, btn) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  setTimeout(() => lucide.createIcons(), 50);

  if (id === 'dashboard')     loadDashboard();
  if (id === 'upload')        loadDocuments();
  if (id === 'notifications') loadNotifications();
}

function guardScreen(id, btn) {
  if (!token) {
    showScreen('login', document.getElementById('navLogin'));
    toast('Faça login para aceder a esta área.', 'info');
    return;
  }
  showScreen(id, btn);
}

/* ── SSE — tempo real ────────────────────────────────────── */

function connectSSE() {
  if (!token || sseSource) return;

  sseSource = new EventSource(`${API}/sse?token=${encodeURIComponent(token)}`);

  sseSource.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data);
      handleSSEEvent(event);
    } catch {}
  };

  sseSource.onerror = () => {
    sseSource.close();
    sseSource = null;
    /* Tentar reconectar em 10s */
    if (token) setTimeout(connectSSE, 10000);
  };
}

function disconnectSSE() {
  if (sseSource) { sseSource.close(); sseSource = null; }
}

function handleSSEEvent(event) {
  switch (event.type) {
    case 'document_validated':
      /* Atualizar lista de documentos se estiver na página */
      if (document.getElementById('upload').classList.contains('active')) {
        loadDocuments();
      }
      /* Atualizar badge de notificações */
      loadNotifBadge();
      /* Toast informativo */
      const icon = event.status === 'approved' ? '✅' : '⚠️';
      toast(`${icon} ${event.title}`, event.status === 'approved' ? 'success' : 'error');
      break;

    case 'notification':
      loadNotifBadge();
      break;
  }
}

/* ── Auth ────────────────────────────────────────────────── */

function showRegister() {
  document.getElementById('loginPanel').classList.add('hidden');
  document.getElementById('registerPanel').classList.remove('hidden');
  lucide.createIcons();
}
function showLogin() {
  document.getElementById('registerPanel').classList.add('hidden');
  document.getElementById('loginPanel').classList.remove('hidden');
  lucide.createIcons();
}

function togglePw(inputId, icon) {
  const inp = document.getElementById(inputId);
  inp.type  = inp.type === 'password' ? 'text' : 'password';
  icon.setAttribute('data-lucide', inp.type === 'password' ? 'eye' : 'eye-off');
  lucide.createIcons();
}

async function handleLogin() {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl    = document.getElementById('loginError');
  const btn      = document.getElementById('loginBtn');

  errEl.classList.add('hidden');
  if (!email || !password) {
    errEl.textContent = 'Preencha o email e a palavra-passe.';
    errEl.classList.remove('hidden');
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'A entrar...';

  try {
    const res  = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      errEl.textContent = data.error || 'Credenciais inválidas.';
      errEl.classList.remove('hidden');
      return;
    }

    token   = data.token;
    profile = data.user;
    localStorage.setItem('am_token', token);
    localStorage.setItem('am_user',  JSON.stringify(profile));

    updateAuthUI();
    connectSSE();
    showScreen('dashboard', document.getElementById('navDashboard'));
    toast(`Bem-vindo de volta, ${profile.name.split(' ')[0]}!`, 'success');

  } finally {
    btn.disabled    = false;
    btn.textContent = 'Entrar';
    lucide.createIcons();
  }
}

async function handleRegister() {
  const name     = document.getElementById('regName').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const errEl    = document.getElementById('registerError');
  const btn      = document.getElementById('registerBtn');

  errEl.classList.add('hidden');
  if (!name || !email || !password) {
    errEl.textContent = 'Preencha todos os campos.';
    errEl.classList.remove('hidden');
    return;
  }
  if (password.length < 8) {
    errEl.textContent = 'Palavra-passe mínima: 8 caracteres.';
    errEl.classList.remove('hidden');
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'A criar conta...';

  try {
    const res  = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      errEl.textContent = data.error || 'Erro ao criar conta.';
      errEl.classList.remove('hidden');
      return;
    }

    token   = data.token;
    profile = data.user;
    localStorage.setItem('am_token', token);
    localStorage.setItem('am_user',  JSON.stringify(profile));

    updateAuthUI();
    connectSSE();
    showScreen('dashboard', document.getElementById('navDashboard'));
    toast(`Conta criada! Processo: ${data.processNumber}`, 'success');

  } finally {
    btn.disabled    = false;
    btn.textContent = 'Criar conta';
  }
}

function logout() {
  token   = null;
  profile = null;
  localStorage.removeItem('am_token');
  localStorage.removeItem('am_user');
  chatHistory = [];
  disconnectSSE();
  stopDocPoll();
  updateAuthUI();
  showScreen('home', document.querySelector('.nav-tab'));
  toast('Sessão terminada.', 'info');
}

function updateAuthUI() {
  document.getElementById('logoutBtn').classList.toggle('hidden', !token);
  document.getElementById('chatFab').classList.toggle('hidden', !token);
  lucide.createIcons();
}

/* ── Dashboard ───────────────────────────────────────────── */

async function loadDashboard() {
  try {
    const res  = await apiFetch('/process');
    if (!res) return;
    const data = await res.json();
    if (!res.ok) { toast(data.error, 'error'); return; }

    const firstName = (profile?.name || '').split(' ')[0] || 'utilizador';

    document.getElementById('dbDate').textContent       = ptDate();
    document.getElementById('dbGreeting').textContent   = `Olá, ${firstName} 👋`;
    document.getElementById('dbProcessType').textContent = data.type;
    document.getElementById('dbProcessNum').textContent  = data.process_number;
    document.getElementById('dbAvatar').textContent      = getInitials(profile?.name);

    /* Stats */
    document.getElementById('dbDaysElapsed').textContent   = data.days_elapsed ?? '—';
    document.getElementById('dbDaysRemaining').textContent = data.days_remaining ?? '—';
    document.getElementById('dbDocCount').textContent      = data.docs_submitted ?? 0;

    const pendEl = document.getElementById('dbDocPending');
    if ((data.docs_rejected ?? 0) > 0) {
      pendEl.textContent  = `${data.docs_rejected} rejeitados`;
      pendEl.style.color  = '#E24B4A';
    } else if ((6 - (data.docs_submitted ?? 0)) > 0) {
      pendEl.textContent  = `${6 - data.docs_submitted} em falta`;
      pendEl.style.color  = '#BA7517';
    } else {
      pendEl.textContent = '';
    }

    /* Cartão pagamento */
    const paid = data.payment_done;
    document.getElementById('dbPaymentCard').style.background = paid
      ? 'linear-gradient(135deg,#E1F5EE 0%,#F5FBF8 100%)'
      : 'linear-gradient(135deg,#FAEEDA 0%,#FDF8F0 100%)';
    document.getElementById('dbPaymentCard').style.border = paid ? '.5px solid #9FE1CB' : '.5px solid #FAC775';
    document.getElementById('dbPaymentLabel').textContent  = paid ? 'Pago' : 'Pendente';
    document.getElementById('dbPaymentLabel').style.color  = paid ? '#085041' : '#854F0B';
    document.getElementById('dbPaymentAmount').textContent = `€${parseFloat(data.payment_amount || 5).toFixed(2)}`;
    document.getElementById('dbPaymentAmount').style.color = paid ? '#04342C' : '#412402';

    /* Timeline */
    renderTimeline(data.steps || [], data.current_step || 1);
    const completedSteps = (data.steps || []).filter(s => s.status === 'completed').length;
    const pct = Math.round((completedSteps / 5) * 100);
    document.getElementById('dbStepInfo').textContent = `Etapa ${data.current_step} de 5 · ${pct}% concluído`;

    /* Tarefas */
    renderTasks(data);

    /* Badge notificações */
    loadNotifBadge();

    /* Insight IA (assíncrono, sem bloquear) */
    loadInsight(data);

  } catch (err) {
    console.error('loadDashboard:', err);
    toast('Não foi possível carregar o painel.', 'error');
  }
}

async function loadInsight(processData) {
  const el = document.getElementById('dbInsightText');
  if (!el) return;
  try {
    const res  = await apiFetch('/insights');
    if (!res || !res.ok) return;
    const data = await res.json();
    if (data.insight) el.textContent = data.insight;
  } catch {}
}

function renderTimeline(steps, currentStep) {
  const container = document.getElementById('dbTimeline');
  container.innerHTML = '';
  steps.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'text-center';

    let bubble;
    if (s.status === 'completed') {
      bubble = `<div class="w-8 h-8 mx-auto mb-2 rounded-full navy-grad flex items-center justify-center" style="box-shadow:0 0 0 4px rgba(30,95,184,.12)">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
      </div>`;
    } else if (s.status === 'in_progress') {
      bubble = `<div class="w-8 h-8 mx-auto mb-2 rounded-full bg-white flex items-center justify-center" style="border:2.5px solid #1E5FB8;box-shadow:0 0 0 4px rgba(30,95,184,.12)">
        <span class="w-2.5 h-2.5 rounded-full pulse-dot" style="background:#1E5FB8"></span>
      </div>`;
    } else {
      bubble = `<div class="w-8 h-8 mx-auto mb-2 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center text-[11px] font-medium" style="color:rgba(10,37,64,.4)">${i + 1}</div>`;
    }

    const nc = s.status === 'in_progress' ? 'color:#1E5FB8' : s.status === 'pending' ? 'color:rgba(10,37,64,.5)' : '';
    const dc = s.status === 'in_progress' ? 'color:#1E5FB8' : 'color:rgba(10,37,64,.4)';
    div.innerHTML = `${bubble}
      <div class="text-[11px] font-medium" style="${nc}">${s.name}</div>
      <div class="text-[10px] mt-0.5" style="${dc}">${s.detail || ''}</div>`;
    container.appendChild(div);
  });
  setTimeout(() => lucide.createIcons(), 50);
}

function renderTasks(data) {
  const container   = document.getElementById('dbTasks');
  const activeTasks = [];
  const lockedTasks = [];

  if (!data.payment_done && data.pending_payment_id) {
    activeTasks.push({
      type:     'payment',
      title:    'Pagar taxa administrativa',
      subtitle: `Valor: €${parseFloat(data.payment_amount || 5).toFixed(2)} · necessário para avançar`,
      urgent:   true,
      action:   () => handlePayment(data.pending_payment_id),
      btnLabel: 'Pagar agora',
    });
  }

  const missingDocs = 6 - (data.docs_submitted || 0);
  const hasRejected = (data.docs_rejected || 0) > 0;

  if (missingDocs > 0 || hasRejected) {
    activeTasks.push({
      type:     'upload',
      title:    hasRejected ? 'Corrigir documento rejeitado' : 'Submeter documentos em falta',
      subtitle: hasRejected
        ? `${data.docs_rejected} documento(s) rejeitado(s) pela IA — nova versão necessária`
        : `${missingDocs} documento(s) em falta · prazo ${data.estimated_end_date ? new Date(data.estimated_end_date).toLocaleDateString('pt-PT') : '—'}`,
      urgent:   true,
      action:   () => guardScreen('upload', document.getElementById('navUpload')),
      btnLabel: hasRejected ? 'Ver documentos' : 'Carregar',
    });
  }

  /* Preview do próximo passo */
  const nextNames = { 2: 'Efetuar pagamento', 3: 'Submeter documentos', 4: 'Aguardar análise IA', 5: 'Aguardar decisão' };
  const nextSubs  = { 2: 'Desbloqueado após pagamento', 3: 'Disponível após passo 2', 4: 'Disponível após documentos aprovados', 5: 'Decisão final da AIMA' };
  const nextStep  = (data.current_step || 1) + 1;
  if (nextStep <= 5 && nextNames[nextStep] && activeTasks.length > 0) {
    lockedTasks.push({
      title:    nextNames[nextStep],
      subtitle: nextSubs[nextStep],
      locked:   true,
    });
  }

  const allTasks = [...activeTasks, ...lockedTasks];
  document.getElementById('dbTaskCount').textContent = activeTasks.length > 0
    ? `${activeTasks.length} pendente${activeTasks.length !== 1 ? 's' : ''}`
    : 'tudo em ordem ✓';

  container.innerHTML = allTasks.length
    ? allTasks.map(t => taskHTML(t)).join('')
    : '<div class="text-center py-6 text-sm rounded-xl bg-white border border-slate-100" style="color:rgba(10,37,64,.5)">Sem ações pendentes — processo a avançar normalmente.</div>';

  container.querySelectorAll('[data-task-btn]').forEach((btn, i) => {
    if (activeTasks[i]?.action) btn.addEventListener('click', activeTasks[i].action);
  });

  lucide.createIcons();
}

function taskHTML(t) {
  if (t.locked) {
    return `<div class="task-item locked rounded-xl px-3.5 py-3 flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
        <i data-lucide="lock" class="w-3.5 h-3.5" style="color:rgba(10,37,64,.4)"></i>
      </div>
      <div class="flex-1"><div class="text-[12.5px] font-medium" style="color:rgba(10,37,64,.5)">${t.title}</div>
      <div class="text-[11px] mt-0.5" style="color:rgba(10,37,64,.4)">${t.subtitle}</div></div>
      <span class="text-[11px]" style="color:rgba(10,37,64,.4)">Bloqueado</span>
    </div>`;
  }
  const icon  = t.type === 'payment' ? 'credit-card' : 'upload';
  const bg    = t.urgent ? '#FAEEDA' : '#E6F1FB';
  const iconC = t.urgent ? '#854F0B' : '#1E5FB8';
  const bar   = t.urgent ? '#BA7517' : '#1E5FB8';
  const bdCol = t.urgent ? '#FAC775' : 'rgba(10,37,64,.08)';
  const badge = t.urgent ? `<span class="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style="background:#FAEEDA;color:#854F0B">URGENTE</span>` : '';
  return `<div class="task-item rounded-xl px-3.5 py-3 flex items-center gap-3 relative" style="border-color:${bdCol}">
    <div class="absolute left-0 top-3 bottom-3 w-1 rounded-r" style="background:${bar}"></div>
    <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background:${bg}">
      <i data-lucide="${icon}" class="w-3.5 h-3.5" style="color:${iconC}"></i>
    </div>
    <div class="flex-1"><div class="flex items-center gap-2"><span class="text-[12.5px] font-medium">${t.title}</span>${badge}</div>
    <div class="text-[11px] mt-0.5" style="color:rgba(10,37,64,.55)">${t.subtitle}</div></div>
    <button data-task-btn class="navy text-white px-3 py-1.5 rounded-md text-[11px] font-medium">${t.btnLabel}</button>
  </div>`;
}

/* ── Notificações ────────────────────────────────────────── */

async function loadNotifBadge() {
  try {
    const res = await apiFetch('/notifications?unread=true');
    if (!res) return;
    const data = await res.json();
    const cnt  = data.unread_count || 0;
    ['navBadge', 'dbNotifBadge'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = cnt;
      el.classList.toggle('hidden', cnt === 0);
    });
  } catch {}
}

async function loadNotifications() {
  try {
    const res  = await apiFetch('/notifications');
    if (!res) return;
    const data = await res.json();
    const list = data.notifications || [];
    const cnt  = data.unread_count  || 0;

    const cntEl = document.getElementById('notifCount');
    cntEl.textContent = `${cnt} nova${cnt !== 1 ? 's' : ''}`;
    cntEl.classList.toggle('hidden', cnt === 0);

    ['navBadge', 'dbNotifBadge'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = cnt;
      el.classList.toggle('hidden', cnt === 0);
    });

    const container = document.getElementById('notifList');
    if (!list.length) {
      container.innerHTML = '<div class="text-center py-10 text-sm bg-white rounded-xl" style="color:rgba(10,37,64,.4)">Sem notificações.</div>';
      return;
    }
    container.innerHTML = list.map(n => notifHTML(n)).join('');
    container.querySelectorAll('[data-notif-id]').forEach(el => {
      el.addEventListener('click', () => markNotifRead(el.dataset.notifId));
    });
    lucide.createIcons();
  } catch (err) { console.error('loadNotifications:', err); }
}

function notifHTML(n) {
  const icons = { payment: 'credit-card', document: 'check-circle', ai: 'sparkles', official: 'message-square', general: 'bell' };
  const bgs   = { payment: 'linear-gradient(135deg,#FAEEDA 0%,#FAC775 100%)', document: 'linear-gradient(135deg,#E1F5EE 0%,#9FE1CB 100%)', ai: 'linear-gradient(135deg,#EEEDFE 0%,#CECBF6 100%)', official: 'linear-gradient(135deg,#F4F7FB 0%,#E1E5EA 100%)', general: 'linear-gradient(135deg,#F4F7FB 0%,#E1E5EA 100%)' };
  const ics   = { payment: '#854F0B', document: '#085041', ai: '#3C3489', official: 'rgba(10,37,64,.7)', general: 'rgba(10,37,64,.7)' };
  const dot   = !n.is_read ? `<span class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:#1E5FB8"></span>` : '';
  const op    = n.is_read ? 'opacity-70' : '';

  if (n.type === 'payment' && !n.is_read) {
    return `<div class="bg-white rounded-2xl mb-1 overflow-hidden" style="border:.5px solid rgba(10,37,64,.08)">
      <div class="grid" style="grid-template-columns:1.5fr 1fr">
        <div class="p-5">
          <div class="flex items-center gap-2.5 mb-2.5 cursor-pointer" data-notif-id="${n.id}">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background:${bgs.payment}">
              <i data-lucide="credit-card" class="w-3.5 h-3.5" style="color:${ics.payment}"></i>
            </div>
            <div>
              <div class="flex items-center gap-1.5"><span class="text-[13px] font-medium">${n.title}</span>
              <span class="text-[9.5px] font-medium px-1.5 py-0.5 rounded-full" style="background:#FAEEDA;color:#854F0B">AÇÃO NECESSÁRIA</span></div>
              <div class="text-[10.5px] mt-0.5" style="color:rgba(10,37,64,.55)">${timeAgo(n.created_at)}</div>
            </div>
          </div>
          <div class="text-[12.5px] leading-relaxed mb-3.5" style="color:rgba(10,37,64,.7)">${n.message}</div>
          <div class="flex gap-2">
            <button onclick="event.stopPropagation();loadPaymentAndPay()" class="navy-grad text-white px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2">Pagar agora · €5,00 <i data-lucide="arrow-right" class="w-3 h-3"></i></button>
            <button class="bg-white px-3.5 py-2 rounded-lg text-xs" style="color:rgba(10,37,64,.7);border:.5px solid rgba(10,37,64,.12)">Mais tarde</button>
          </div>
        </div>
        <div class="navy-grad p-5 text-white flex flex-col justify-center">
          <div class="text-[10px] tracking-wider uppercase mb-1" style="color:rgba(255,255,255,.7)">Taxa de processo</div>
          <div class="flex items-baseline gap-1 mb-3"><span class="text-3xl font-medium">€5</span><span class="text-base" style="color:rgba(255,255,255,.7)">,00</span></div>
          <div class="text-[11px]" style="color:rgba(255,255,255,.6)">Pagamento único · sem comissões</div>
        </div>
      </div>
    </div>`;
  }

  return `<div class="notif-item ${!n.is_read ? 'unread' : ''} rounded-xl px-4 py-3 flex gap-3 items-start cursor-pointer ${op}" data-notif-id="${n.id}">
    <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background:${bgs[n.type] || bgs.general}">
      <i data-lucide="${icons[n.type] || 'bell'}" class="w-3.5 h-3.5" style="color:${ics[n.type] || ics.general}"></i>
    </div>
    <div class="flex-1">
      <div class="flex items-center gap-2 mb-0.5">${dot}<span class="text-[12.5px] font-medium">${n.title}</span>
      <span class="text-[10.5px] ml-auto" style="color:rgba(10,37,64,.5)">${timeAgo(n.created_at)}</span></div>
      <div class="text-[11.5px] leading-relaxed" style="color:rgba(10,37,64,.65)">${n.message}</div>
    </div>
  </div>`;
}

async function markNotifRead(id) {
  await apiFetch(`/notifications/${id}/read`, { method: 'PUT' });
  loadNotifications();
}

async function markAllRead() {
  await apiFetch('/notifications/read-all', { method: 'PUT' });
  loadNotifications();
  toast('Todas marcadas como lidas.', 'success');
}

/* ── Documentos ──────────────────────────────────────────── */

async function loadDocuments() {
  try {
    const res  = await apiFetch('/documents');
    if (!res) return;
    const docs = await res.json();
    if (!res.ok) return;

    const nonRejected = docs.filter(d => d.status !== 'rejected').length;
    document.getElementById('docsCount').textContent = `${nonRejected} de 6`;

    const container = document.getElementById('docsList');
    if (!docs.length) {
      container.innerHTML = '<div class="text-center py-10 text-sm" style="color:rgba(10,37,64,.4)">Nenhum documento submetido. Comece por fazer upload acima.</div>';
      stopDocPoll();
      return;
    }

    container.innerHTML = docs.map(d => docHTML(d)).join('');
    container.querySelectorAll('[data-del-doc]').forEach(btn => {
      btn.addEventListener('click', () => deleteDoc(btn.dataset.delDoc));
    });
    lucide.createIcons();

    /* Se há docs em processing, polling (fallback ao SSE) */
    if (docs.some(d => d.status === 'processing')) startDocPoll();
    else stopDocPoll();

  } catch (err) { console.error('loadDocuments:', err); }
}

function docHTML(d) {
  const ext   = (d.original_name || '').split('.').pop().toUpperCase().slice(0, 4);
  const extBg = { PDF: 'linear-gradient(135deg,#FCEBEB 0%,#F7C1C1 100%)', JPG: 'linear-gradient(135deg,#FAEEDA 0%,#FAC775 100%)', PNG: 'linear-gradient(135deg,#E6F1FB 0%,#B5D4F4 100%)', WEBP: 'linear-gradient(135deg,#E1F5EE 0%,#9FE1CB 100%)' };
  const extC  = { PDF: '#501313', JPG: '#412402', PNG: '#042C53', WEBP: '#04342C' };
  const bg    = extBg[ext] || extBg.PDF;
  const clr   = extC[ext]  || '#501313';

  if (d.status === 'approved') {
    return `<div class="doc-item approved flex items-center gap-3 p-3 rounded-xl relative">
      <div class="absolute left-0 top-2 bottom-2 w-1 rounded-r" style="background:#1D9E75"></div>
      <div class="w-9 h-11 rounded-md flex items-center justify-center text-[9px] font-medium relative flex-shrink-0" style="background:${bg};color:${clr}">${ext}
        <div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center" style="background:#1D9E75">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-2 h-2 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-[13px] font-medium truncate">${d.original_name}</div>
        <div class="flex items-center gap-2 mt-0.5">
          <span class="text-[10.5px] font-medium" style="color:#085041">✓ Aprovado pela IA</span>
          <span class="text-[10.5px]" style="color:rgba(10,37,64,.4)">·</span>
          <span class="text-[10.5px]" style="color:rgba(10,37,64,.55)">${formatBytes(d.size_bytes)}</span>
          <span class="text-[10.5px]" style="color:rgba(10,37,64,.55)">${timeAgo(d.uploaded_at)}</span>
        </div>
      </div>
      <button class="w-7 h-7 bg-slate-100 hover:bg-red-50 rounded-md flex items-center justify-center transition-colors" data-del-doc="${d.id}" title="Remover">
        <i data-lucide="trash-2" class="w-3.5 h-3.5" style="color:rgba(10,37,64,.5)"></i>
      </button>
    </div>`;
  }

  if (d.status === 'processing') {
    return `<div class="doc-item processing p-3 rounded-xl relative overflow-hidden" style="background:linear-gradient(135deg,#FAFCFF 0%,#F0F6FD 100%)">
      <div class="absolute left-0 top-2 bottom-2 w-1 rounded-r" style="background:#1E5FB8"></div>
      <div class="flex items-center gap-3">
        <div class="w-9 h-11 rounded-md flex items-center justify-center text-[9px] font-medium relative flex-shrink-0" style="background:${bg};color:${clr}">${ext}
          <div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center" style="background:#1E5FB8">
            <i data-lucide="sparkles" class="w-2 h-2 text-white pulse-dot"></i>
          </div>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-center mb-1.5">
            <div class="text-[13px] font-medium">${d.original_name}</div>
            <span class="text-[11px] font-medium" style="color:#1E5FB8">IA a analisar...</span>
          </div>
          <div class="h-1.5 rounded-full mb-1.5 overflow-hidden" style="background:rgba(30,95,184,.12)">
            <div class="h-full rounded-full shimmer"></div>
          </div>
          <div class="text-[10.5px] flex items-center gap-1.5" style="color:rgba(10,37,64,.6)">
            <span class="flex gap-0.5">
              <span class="w-1 h-1 rounded-full pulse-dot" style="background:#1E5FB8"></span>
              <span class="w-1 h-1 rounded-full pulse-dot" style="background:#1E5FB8;animation-delay:.3s"></span>
              <span class="w-1 h-1 rounded-full pulse-dot" style="background:#1E5FB8;animation-delay:.6s"></span>
            </span>
            Claude IA a verificar autenticidade e legibilidade
          </div>
        </div>
      </div>
    </div>`;
  }

  if (d.status === 'rejected') {
    return `<div class="doc-item rejected flex items-center gap-3 p-3 rounded-xl relative" style="background:linear-gradient(135deg,#FCEBEB 0%,#FDF5F5 100%)">
      <div class="absolute left-0 top-2 bottom-2 w-1 rounded-r" style="background:#E24B4A"></div>
      <div class="w-9 h-11 bg-white rounded-md flex items-center justify-center text-[9px] font-medium relative flex-shrink-0" style="border:.5px solid #F7C1C1;color:#791F1F">${ext}
        <div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center" style="background:#E24B4A">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-2 h-2 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </div>
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-[13px] font-medium truncate" style="color:#501313">${d.original_name}</div>
        <div class="text-[10.5px] mt-0.5 leading-relaxed" style="color:#791F1F"><span class="font-medium">IA:</span> ${d.error_message || 'Documento inválido.'}</div>
      </div>
      <button class="bg-white px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors hover:bg-red-50" style="color:#791F1F;border:.5px solid #F09595" onclick="document.getElementById('fileInput').click()">
        Corrigir
      </button>
    </div>`;
  }
  return '';
}

async function handleFiles(files) {
  if (!token) { toast('Faça login para enviar documentos.', 'error'); return; }
  if (!files?.length) return;

  for (const file of Array.from(files)) {
    if (file.size > 10 * 1024 * 1024) { toast(`${file.name}: máximo 10 MB`, 'error'); continue; }
    toast(`A enviar "${file.name}"...`, 'info');
    const fd = new FormData();
    fd.append('document', file);
    fd.append('type', guessDocType(file.name));
    try {
      const res  = await fetch(`${API}/documents/upload`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    fd,
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Erro ao enviar.', 'error'); continue; }
      toast(`"${file.name}" enviado — Claude IA a analisar...`, 'success');
    } catch {
      toast(`Erro ao enviar "${file.name}".`, 'error');
    }
  }
  setTimeout(loadDocuments, 500);
  startDocPoll();
}

function guessDocType(name) {
  const n = name.toLowerCase();
  if (/passaporte|passport/.test(n))        return 'Passaporte';
  if (/morada|arrendamento|habitacao/.test(n)) return 'Comprovativo de Morada';
  if (/irs|rendimentos|financ/.test(n))     return 'Declaração IRS';
  if (/contrato|trabalho|emprego/.test(n))  return 'Contrato de Trabalho';
  if (/nif|contribuinte/.test(n))           return 'NIF';
  if (/nascimento|birth/.test(n))           return 'Certidão de Nascimento';
  return 'Outros';
}

async function deleteDoc(id) {
  if (!confirm('Remover este documento definitivamente?')) return;
  const res = await apiFetch(`/documents/${id}`, { method: 'DELETE' });
  if (res?.ok) { toast('Documento removido.', 'success'); loadDocuments(); }
  else          toast('Não foi possível remover.', 'error');
}

function startDocPoll() {
  stopDocPoll();
  pollTimer = setInterval(loadDocuments, 8000);
}
function stopDocPoll() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

/* ── Pagamentos ──────────────────────────────────────────── */

async function handlePayment(paymentId) {
  if (!confirm('Confirmar pagamento de €5,00?')) return;
  const res  = await apiFetch(`/payments/${paymentId}/pay`, {
    method: 'POST',
    body:   JSON.stringify({ method: 'Cartão' }),
  });
  const data = await res.json();
  if (res?.ok) {
    toast('✅ Pagamento confirmado! O processo avançou.', 'success');
    setTimeout(loadDashboard, 500);
    loadNotifBadge();
  } else {
    toast(data.error || 'Erro no pagamento.', 'error');
  }
}

async function loadPaymentAndPay() {
  const res  = await apiFetch('/payments');
  const data = await res.json();
  const pend = data.find(p => p.status === 'pending');
  if (pend) handlePayment(pend.id);
  else       toast('A taxa já foi paga.', 'info');
}

/* ── Chat IA ─────────────────────────────────────────────── */

function toggleChat() {
  const panel = document.getElementById('chatPanel');
  const fab   = document.getElementById('chatFabIcon');
  const open  = panel.classList.toggle('hidden');
  fab.setAttribute('data-lucide', open ? 'message-circle' : 'x');
  lucide.createIcons();
  if (!open && chatHistory.length === 0) {
    appendChatMsg('assistant', 'Olá! Sou o assistente IA do Apoio Migrante. Como posso ajudá-lo com o seu processo de imigração em Portugal?');
  }
  setTimeout(() => document.getElementById('chatInput')?.focus(), 100);
}

function appendChatMsg(role, text) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = role === 'user'
    ? 'flex justify-end mb-2'
    : 'flex justify-start mb-2';
  div.innerHTML = role === 'user'
    ? `<div class="max-w-[80%] navy text-white text-[13px] px-3 py-2 rounded-xl rounded-br-sm leading-relaxed">${escapeHtml(text)}</div>`
    : `<div class="max-w-[80%] bg-white border border-slate-200 text-[13px] px-3 py-2 rounded-xl rounded-bl-sm leading-relaxed" style="color:#0A2540">${text}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const msg   = input.value.trim();
  if (!msg) return;

  input.value    = '';
  input.disabled = true;

  appendChatMsg('user', msg);

  /* Indicador de escrita */
  const typing = document.createElement('div');
  typing.id    = 'chatTyping';
  typing.className = 'flex justify-start mb-2';
  typing.innerHTML = `<div class="bg-white border border-slate-200 px-3 py-2 rounded-xl rounded-bl-sm flex gap-1 items-center">
    <span class="w-1.5 h-1.5 rounded-full pulse-dot" style="background:#1E5FB8"></span>
    <span class="w-1.5 h-1.5 rounded-full pulse-dot" style="background:#1E5FB8;animation-delay:.3s"></span>
    <span class="w-1.5 h-1.5 rounded-full pulse-dot" style="background:#1E5FB8;animation-delay:.6s"></span>
  </div>`;
  document.getElementById('chatMessages').appendChild(typing);
  document.getElementById('chatMessages').scrollTop = 9999;

  try {
    const res  = await apiFetch('/chat', {
      method: 'POST',
      body:   JSON.stringify({ message: msg, history: chatHistory }),
    });
    const data = await res.json();

    typing.remove();

    const reply = res?.ok ? data.response : (data.error || 'Erro ao obter resposta.');
    appendChatMsg('assistant', reply.replace(/\n/g, '<br>'));

    if (res?.ok) {
      chatHistory.push({ role: 'user',      content: msg });
      chatHistory.push({ role: 'assistant', content: data.response });
    }

  } catch {
    typing.remove();
    appendChatMsg('assistant', 'Não foi possível contactar o assistente. Verifique a ligação.');
  } finally {
    input.disabled = false;
    input.focus();
  }
}

/* ── Init ────────────────────────────────────────────────── */

function init() {
  try {
    const stored = localStorage.getItem('am_user');
    if (stored) profile = JSON.parse(stored);
  } catch {}

  updateAuthUI();

  if (token) {
    connectSSE();
    showScreen('dashboard', document.getElementById('navDashboard'));
  }

  lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', init);
