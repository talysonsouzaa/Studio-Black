/* =============================================
   STUDIO BLACK – script.js
   ============================================= */

/* ── Config ── */
const API_BASE = 'http://localhost:5000'; // Altere para a URL do seu backend

const SERVICOS = [
  { nome: 'Corte', preco: 'R$ 40' },
  { nome: 'Cabelo e Barba (COMBO)', preco: 'R$ 80' },
  { nome: 'Luzes + Corte', preco: 'R$ 150' },
  { nome: 'Sobrancelhas', preco: 'R$ 15' },
  { nome: 'Feminino', preco: 'R$ 65' },
  { nome: 'Corte + Barba + Sobrancelha (COMBO)', preco: 'R$ 95' },
  { nome: 'Corte + Sobrancelha (PROMO)', preco: 'R$ 50' },
  { nome: 'Pai e Filho', preco: 'R$ 80' },
  { nome: 'Corte + Lavagem + Escova', preco: 'R$ 50' },
  { nome: 'Acabamento Pezinho', preco: 'R$ 15' },
  { nome: 'Barboterapia', preco: 'R$ 40' },
];

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

  // Aguarda pequeno delay para feedback visual
  setTimeout(() => {
    renderizarServicos();
    irParaStep(2);
  }, 250);
}

/* ─────────────────────────────────────
   PASSO 2 – Serviço
───────────────────────────────────── */
function renderizarServicos() {
  const lista = document.getElementById('servicos-lista');
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
  });
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
   PASSO 3 – Data (próximos 7 dias)
───────────────────────────────────── */
function renderizarCalendario() {
  const cal = document.getElementById('calendario');
  cal.innerHTML = '';

  const hoje = new Date();

  for (let i = 0; i < 7; i++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);

    const diaSemana = d.getDay(); // 0=Dom
    const isDomingo = diaSemana === 0;

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const iso = `${yyyy}-${mm}-${dd}`;

    const card = document.createElement('div');
    card.className = 'dia-card' + (isDomingo ? ' domingo' : '');
    card.innerHTML = `
      <div class="dia-num">${dd}</div>
      <div class="dia-nome">${isDomingo ? 'Fechado' : DIAS_SEMANA[diaSemana]}</div>
    `;

    if (!isDomingo) {
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
async function carregarHorarios() {
  const grid = document.getElementById('horarios-grid');
  const loading = document.getElementById('horarios-loading');

  grid.innerHTML = '';
  loading.style.display = 'flex';

  /* Gerar slots 09:00–17:30 de 30 em 30 min */
  const slots = [];
  for (let h = 9; h < 18; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    if (h < 17 || true) slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  // Filtrar até 17:30 (último slot)
  const todosSlots = slots.filter(s => s <= '17:30');

  /* Buscar horários ocupados no backend */
  let ocupados = [];
  try {
    const res = await fetch(
      `${API_BASE}/horarios?barbeiro=${encodeURIComponent(estado.barbeiro)}&data=${estado.data}`
    );
    if (res.ok) {
      const json = await res.json();
      ocupados = json.ocupados || [];
    }
  } catch (err) {
    console.warn('Backend indisponível – mostrando todos os horários.');
  }

  loading.style.display = 'none';

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

    if (jaPAssou || ocupado) {
      btn.disabled = true;
      if (ocupado) btn.title = 'Horário já agendado';
      if (jaPAssou) btn.title = 'Horário já passou';
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
      }),
    });

    const json = await res.json();

    if (res.ok) {
      salvo = true;
      fb.className = 'resumo-feedback success';
      fb.textContent = '✓ Agendamento salvo! Redirecionando ao WhatsApp…';
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
    salvo = true;
  }

  if (salvo) {
    setTimeout(() => abrirWhatsApp(), 1000);
  }
}

function abrirWhatsApp() {
  const numero = estado.barbeiroTel;
  const mensagem = encodeURIComponent(
    `Olá! Quero agendar:\nBarbeiro: ${estado.barbeiro}\nServiço: ${estado.servico}\nData: ${estado.dataDisplay}\nHorário: ${estado.horario}`
  );
  const url = `https://wa.me/${numero}?text=${mensagem}`;
  window.open(url, '_blank');

  // Resetar fluxo
  setTimeout(() => {
    resetarAgendamento();
  }, 1500);
}

function resetarAgendamento() {
  estado = { barbeiro: null, barbeiroTel: null, servico: null, servicoPreco: null, data: null, dataDisplay: null, horario: null };
  document.querySelectorAll('.barbeiro-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('btn-confirmar').disabled = false;
  document.getElementById('btn-confirmar').textContent = 'Confirmar e ir ao WhatsApp';
  irParaStep(1);
}