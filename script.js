/* =============================================
   STUDIO BLACK – script.js
   ============================================= */

/* ── Config ── */
const API_BASE = 'https://studioblack.up.railway.app'; // Altere para a URL do seu backend

// Serviços carregados dinamicamente do backend (por barbeiro)
let SERVICOS = [];
let servicoPreSelecionado = null; // nome do serviço clicado na vitrine

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_SEMANA_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/* ── Estado da aplicação ── */
let estado = {
  barbeiro: null,
  barbeiroTel: null,
  servico: null,
  servicoPreco: null,
  data: null,    // "YYYY-MM-DD"
  dataDisplay: null,
  horario: null,
};

/* ─────────────────────────────────────
   LOADER
───────────────────────────────────── */
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('loader').classList.add('hidden');
    iniciarReveal();
  }, 2200);
});

/* ─────────────────────────────────────
   HEADER SCROLL
───────────────────────────────────── */
window.addEventListener('scroll', () => {
  const h = document.getElementById('header');
  h.classList.toggle('scrolled', window.scrollY > 60);
});

/* ─────────────────────────────────────
   REVEAL ANIMATION
───────────────────────────────────── */
function iniciarReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('visible'), i * 80);
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

/* ─────────────────────────────────────
   STEP NAVIGATION
───────────────────────────────────── */
function irParaStep(num) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  const alvo = num === 'resumo'
    ? document.getElementById('step-resumo')
    : document.getElementById('step' + num);
  if (alvo) alvo.classList.add('active');
}

function voltarStep(num) {
  irParaStep(num);
}

/* ─────────────────────────────────────
   PASSO 1 – Barbeiro
───────────────────────────────────── */
function selecionarBarbeiro(el) {
  document.querySelectorAll('.barbeiro-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');

  estado.barbeiro = el.dataset.barbeiro;
  estado.barbeiroTel = el.dataset.tel;
  expedienteCache = null; // limpar cache ao trocar de barbeiro

  // Aguarda pequeno delay para feedback visual
  setTimeout(async () => {
    await renderizarServicos();
    irParaStep(2);
  }, 250);
}

/* ─────────────────────────────────────
   PASSO 2 – Serviço
───────────────────────────────────── */
async function renderizarServicos() {
  const lista = document.getElementById('servicos-lista');
  lista.innerHTML = '<div style="color:#888;font-size:13px;padding:12px;text-align:center;">Carregando serviços…</div>';

  // Carregar serviços do barbeiro selecionado
  try {
    const res = await fetch(`${API_BASE}/servicos?barbeiro=${encodeURIComponent(estado.barbeiro)}`);
    if (res.ok) {
      const dados = await res.json();
      SERVICOS = dados.map(s => ({ nome: s.nome, preco: `R$ ${parseFloat(s.preco).toFixed(0).replace('.', ',')}` }));
    }
  } catch (e) {
    console.warn('Não foi possível carregar serviços do backend.');
  }

  lista.innerHTML = '';
  SERVICOS.forEach(s => {
    const div = document.createElement('div');
    div.className = 'servico-item';
    div.innerHTML = `
      <span class="servico-item-nome">${s.nome}</span>
      <span class="servico-item-preco">${s.preco}</span>
    `;
    div.addEventListener('click', () => selecionarServico(div, s));
    lista.appendChild(div);

    // Pré-selecionar se veio da vitrine
    if (servicoPreSelecionado && s.nome === servicoPreSelecionado) {
      setTimeout(() => selecionarServico(div, s), 100);
    }
  });
  servicoPreSelecionado = null;
}

function selecionarServico(el, servico) {
  document.querySelectorAll('.servico-item').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');

  estado.servico = servico.nome;
  estado.servicoPreco = servico.preco;

  setTimeout(() => {
    renderizarCalendario();
    irParaStep(3);
  }, 250);
}

/* ─────────────────────────────────────
   VITRINE – Clique em serviço desce pro agendamento
───────────────────────────────────── */
function clicarVitrineServico(nomeServico) {
  servicoPreSelecionado = nomeServico;
  document.getElementById('agendar').scrollIntoView({ behavior: 'smooth' });
}

/* ─────────────────────────────────────
   PASSO 3 – Data (próximos 30 dias)
───────────────────────────────────── */
let expedienteCache = null;

async function carregarExpedienteBarbeiro() {
  try {
    const res = await fetch(`${API_BASE}/expediente?barbeiro=${encodeURIComponent(estado.barbeiro)}`);
    if (res.ok) {
      const lista = await res.json();
      expedienteCache = {};
      lista.forEach(e => { expedienteCache[e.dia_semana] = e; });
    }
  } catch (e) { expedienteCache = null; }
}

const DIAS_SEMANA_KEY_CAL = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

async function renderizarCalendario() {
  const cal = document.getElementById('calendario');
  cal.innerHTML = '<div style="color:#888;font-size:13px;padding:12px;">Carregando...</div>';

  await carregarExpedienteBarbeiro();

  cal.innerHTML = '';
  const hoje = new Date();

  for (let i = 0; i < 30; i++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);

    const diaSemana = d.getDay();
    const diaKey = DIAS_SEMANA_KEY_CAL[diaSemana];
    const expDia = expedienteCache ? expedienteCache[diaKey] : null;
    const isFechado = expDia ? !!expDia.fechado : (diaSemana === 0);

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const iso = `${yyyy}-${mm}-${dd}`;

    const card = document.createElement('div');
    card.className = 'dia-card' + (isFechado ? ' domingo' : '');
    card.innerHTML = `
      <div class="dia-num">${dd}</div>
      <div class="dia-nome">${isFechado ? 'Fechado' : DIAS_SEMANA[diaSemana]}</div>
    `;

    if (!isFechado) {
      card.addEventListener('click', () => selecionarData(card, iso, d));
    }

    cal.appendChild(card);
  }
}

function selecionarData(el, iso, dateObj) {
  document.querySelectorAll('.dia-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');

  const diaSemana = DIAS_SEMANA_FULL[dateObj.getDay()];
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = dateObj.getFullYear();

  estado.data = iso;
  estado.dataDisplay = `${diaSemana}, ${dd}/${mm}/${yyyy}`;

  setTimeout(() => {
    carregarHorarios();
    irParaStep(4);
  }, 250);
}

/* ─────────────────────────────────────
   PASSO 4 – Horários
───────────────────────────────────── */
const DIAS_SEMANA_KEY = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

async function carregarHorarios() {
  const grid = document.getElementById('horarios-grid');
  const loading = document.getElementById('horarios-loading');

  grid.innerHTML = '';
  loading.style.display = 'flex';

  /* Buscar expediente do barbeiro para este dia da semana */
  const dateObj = new Date(estado.data + 'T12:00:00');
  const diaSemanaKey = DIAS_SEMANA_KEY[dateObj.getDay()];

  let horaInicio = '07:00';
  let horaFim = '21:00';
  let diaFechado = false;

  try {
    const resExp = await fetch(`${API_BASE}/expediente?barbeiro=${encodeURIComponent(estado.barbeiro)}`);
    if (resExp.ok) {
      const expLista = await resExp.json();
      const expDia = expLista.find(e => e.dia_semana === diaSemanaKey);
      if (expDia) {
        diaFechado = !!expDia.fechado;
        horaInicio = expDia.hora_inicio ? expDia.hora_inicio.slice(0, 5) : '07:00';
        horaFim = expDia.hora_fim ? expDia.hora_fim.slice(0, 5) : '21:00';
      }
    }
  } catch (e) {
    console.warn('Usando horário padrão (backend indisponível).');
  }

  /* Gerar slots dentro do expediente do barbeiro */
  const todosSlots = [];
  if (!diaFechado) {
    const [hIni] = horaInicio.split(':').map(Number);
    const [hFim] = horaFim.split(':').map(Number);
    for (let h = hIni; h <= hFim; h++) {
      const hh = String(h).padStart(2, '0');
      if (`${hh}:00` <= horaFim) todosSlots.push(`${hh}:00`);
      if (h < hFim) todosSlots.push(`${hh}:30`);
    }
  }

  /* Buscar horários ocupados, bloqueados e intervalo de almoço */
  let ocupados = [];
  let bloqueados = [];
  let almoco = { ativo: 0 };
  try {
    const [resOcup, resBloc, resAlm] = await Promise.all([
      fetch(`${API_BASE}/horarios?barbeiro=${encodeURIComponent(estado.barbeiro)}&data=${estado.data}`),
      fetch(`${API_BASE}/bloqueios?barbeiro=${encodeURIComponent(estado.barbeiro)}&data=${estado.data}`),
      fetch(`${API_BASE}/almoco?barbeiro=${encodeURIComponent(estado.barbeiro)}`)
    ]);
    if (resOcup.ok) { const j = await resOcup.json(); ocupados = j.ocupados || []; }
    if (resBloc.ok) { const j = await resBloc.json(); bloqueados = j.bloqueados || []; }
    if (resAlm.ok) { almoco = await resAlm.json(); }
  } catch (err) {
    console.warn('Backend indisponível – mostrando todos os horários.');
  }

  // Calcular slots de almoço bloqueados
  const slotsAlmoco = [];
  if (almoco.ativo) {
    const [hIniAlm, mIniAlm] = (almoco.hora_inicio || '12:00').slice(0, 5).split(':').map(Number);
    const [hFimAlm, mFimAlm] = (almoco.hora_fim || '13:30').slice(0, 5).split(':').map(Number);
    const minIni = hIniAlm * 60 + mIniAlm;
    const minFim = hFimAlm * 60 + mFimAlm;
    todosSlots.forEach(slot => {
      const [sh, sm] = slot.split(':').map(Number);
      const minSlot = sh * 60 + sm;
      if (minSlot >= minIni && minSlot < minFim) slotsAlmoco.push(slot);
    });
  }

  loading.style.display = 'none';

  if (diaFechado || todosSlots.length === 0) {
    grid.innerHTML = '<div style="color:#888;font-size:14px;text-align:center;padding:24px;grid-column:1/-1;">Este barbeiro não atende neste dia.</div>';
    return;
  }

  /* Horários passados no dia de hoje */
  const agora = new Date();
  const isHoje = estado.data === formatarDataISO(agora);

  todosSlots.forEach(slot => {
    const [sh, sm] = slot.split(':').map(Number);
    const btn = document.createElement('button');
    btn.className = 'horario-btn';
    btn.textContent = slot;

    const jaPAssou = isHoje && (sh < agora.getHours() || (sh === agora.getHours() && sm <= agora.getMinutes()));
    const ocupado = ocupados.includes(slot + ':00') || ocupados.includes(slot);
    const bloqueado = bloqueados.includes(slot + ':00') || bloqueados.includes(slot);
    const ehAlmoco = slotsAlmoco.includes(slot);

    if (jaPAssou || ocupado || bloqueado || ehAlmoco) {
      btn.disabled = true;
      if (ocupado) btn.title = 'Horário já agendado';
      if (jaPAssou) btn.title = 'Horário já passou';
      if (bloqueado) { btn.title = 'Horário indisponível'; btn.classList.add('bloqueado'); }
      if (ehAlmoco) { btn.title = 'Intervalo de almoço'; btn.classList.add('bloqueado'); }
    } else {
      btn.addEventListener('click', () => selecionarHorario(btn, slot));
    }

    grid.appendChild(btn);
  });
}

function formatarDataISO(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function selecionarHorario(el, horario) {
  document.querySelectorAll('.horario-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  estado.horario = horario;

  setTimeout(() => {
    preencherResumo();
    irParaStep('resumo');
  }, 250);
}

/* ─────────────────────────────────────
   RESUMO
───────────────────────────────────── */
function preencherResumo() {
  document.getElementById('r-barbeiro').textContent = estado.barbeiro;
  document.getElementById('r-servico').textContent = `${estado.servico} – ${estado.servicoPreco}`;
  document.getElementById('r-data').textContent = estado.dataDisplay;
  document.getElementById('r-horario').textContent = estado.horario;

  const fb = document.getElementById('resumo-feedback');
  fb.className = 'resumo-feedback';
  fb.textContent = '';
}

/* ─────────────────────────────────────
   CONFIRMAR AGENDAMENTO
───────────────────────────────────── */
async function confirmarAgendamento() {
  const btn = document.getElementById('btn-confirmar');
  const fb = document.getElementById('resumo-feedback');
  const nome = document.getElementById('r-nome').value.trim();
  const telefone = document.getElementById('r-telefone').value.trim();

  if (!nome || !telefone) {
    fb.className = 'resumo-feedback error';
    fb.textContent = 'Por favor, preencha seu nome e WhatsApp antes de confirmar.';
    return;
  }

  estado.nome = nome;
  estado.telefone = telefone;

  btn.disabled = true;
  btn.textContent = 'Aguarde…';
  fb.className = 'resumo-feedback';
  fb.textContent = '';

  let salvo = false;

  try {
    const res = await fetch(`${API_BASE}/agendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barbeiro: estado.barbeiro,
        servico: estado.servico,
        data: estado.data,
        horario: estado.horario + ':00',
        nome: estado.nome,
        telefone: estado.telefone,
      }),
    });

    const json = await res.json();

    if (res.ok) {
      salvo = true;
      if (json.id) estado.ultimoId = json.id;
      fb.className = 'resumo-feedback success';
      fb.textContent = '✓ Agendamento salvo! Abrindo WhatsApp…';
      // Abrir imediatamente — ainda dentro da ação do usuário
      abrirWhatsApp();
      return;
    } else {
      fb.className = 'resumo-feedback error';
      fb.textContent = json.erro || 'Este horário já foi reservado. Escolha outro.';
      btn.disabled = false;
      btn.textContent = 'Confirmar e ir ao WhatsApp';
      return;
    }
  } catch (err) {
    // Backend off – abre WA mesmo assim (modo fallback)
    console.warn('Backend indisponível, abrindo WhatsApp diretamente.');
    abrirWhatsApp();
  }
}

function abrirWhatsApp() {
  const numero = String(estado.barbeiroTel).replace(/\D/g, '');
  const linkCancelar = `${window.location.origin}/cancelar.html?id=${estado.ultimoId || ''}`;
  const mensagem = encodeURIComponent(
    `Olá! Quero agendar:\nNome: ${estado.nome}\nWhatsApp: ${estado.telefone}\nBarbeiro: ${estado.barbeiro}\nServiço: ${estado.servico}\nData: ${estado.dataDisplay}\nHorário: ${estado.horario}\n\nPrecisando cancelar? Acesse: ${linkCancelar}`
  );
  const url = `https://wa.me/${numero}?text=${mensagem}`;

  // Abrir direto — sem setTimeout para não ser bloqueado pelo navegador
  const janela = window.open(url, '_blank');

  // Fallback: se bloqueado, redireciona na mesma aba
  if (!janela || janela.closed || typeof janela.closed === 'undefined') {
    window.location.href = url;
  }

  setTimeout(() => resetarAgendamento(), 1500);
}

function resetarAgendamento() {
  estado = { barbeiro: null, barbeiroTel: null, servico: null, servicoPreco: null, data: null, dataDisplay: null, horario: null, nome: null, telefone: null };
  document.querySelectorAll('.barbeiro-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('btn-confirmar').disabled = false;
  document.getElementById('btn-confirmar').textContent = 'Confirmar e ir ao WhatsApp';
  irParaStep(1);
}