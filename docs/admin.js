/* =============================================
   STUDIO BLACK – admin.js
   =============================================

   ⚠️  IMPORTANTE: Troque as senhas abaixo
       antes de publicar o site!
*/

const API_BASE = 'http://localhost:5000'; // URL do backend

/* ── Senhas ── */
const SENHAS = {
    'Borel Barber': 'borel2024',
    'Junior Barber': 'junior2024',
};

/* ── Preços (para calcular faturamento) ── */
const PRECOS = {
    'Corte': 40,
    'Cabelo e Barba (COMBO)': 80,
    'Luzes + Corte': 150,
    'Sobrancelhas': 15,
    'Feminino': 65,
    'Corte + Barba + Sobrancelha (COMBO)': 95,
    'Corte + Sobrancelha (PROMO)': 50,
    'Pai e Filho': 80,
    'Corte + Lavagem + Escova': 50,
    'Acabamento Pezinho': 15,
    'Barboterapia': 40,
};

const TOTAL_SLOTS_DIA = 18; // 09:00 a 17:30 de 30 em 30min

/* ── Estado ── */
let barbeiroAtual = 'Borel Barber';
let barbeiroLogado = null;

/* ─────────────────────────────────────
   LOGIN
───────────────────────────────────── */
function selecionarBarbeiro(el) {
    document.querySelectorAll('.barber-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    barbeiroAtual = el.dataset.b;
    document.getElementById('login-erro').textContent = '';
}

function toggleSenha() {
    const input = document.getElementById('input-senha');
    input.type = input.type === 'password' ? 'text' : 'password';
}

function fazerLogin() {
    const senha = document.getElementById('input-senha').value.trim();
    const erro = document.getElementById('login-erro');

    if (!senha) {
        erro.textContent = 'Digite a senha.';
        return;
    }

    if (SENHAS[barbeiroAtual] === senha) {
        barbeiroLogado = barbeiroAtual;
        sessionStorage.setItem('sb_admin', barbeiroLogado); // persiste enquanto aba aberta
        abrirPainel();
    } else {
        erro.textContent = 'Senha incorreta. Tente novamente.';
        document.getElementById('input-senha').value = '';
        document.getElementById('input-senha').focus();
        // Shake na caixa de login
        const box = document.querySelector('.login-box');
        box.style.animation = 'none';
        setTimeout(() => { box.style.animation = ''; }, 10);
    }
}

function fazerLogout() {
    barbeiroLogado = null;
    sessionStorage.removeItem('sb_admin');
    document.getElementById('tela-painel').style.display = 'none';
    document.getElementById('tela-login').style.display = 'flex';
    document.getElementById('input-senha').value = '';
}

/* ── Checar sessão ao carregar ── */
window.addEventListener('load', () => {
    const salvo = sessionStorage.getItem('sb_admin');
    if (salvo && SENHAS[salvo] !== undefined) {
        barbeiroLogado = salvo;
        barbeiroAtual = salvo;
        // Marcar tab correta
        document.querySelectorAll('.barber-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.b === salvo);
        });
        abrirPainel();
    }
});

/* ─────────────────────────────────────
   PAINEL
───────────────────────────────────── */
function abrirPainel() {
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('tela-painel').style.display = 'block';
    document.getElementById('topbar-nome').textContent = barbeiroLogado;

    // Data de hoje
    const hoje = new Date();
    const opts = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
    document.getElementById('label-data-hoje').textContent =
        hoje.toLocaleDateString('pt-BR', opts);

    carregarAgendaHoje();
    carregarHistorico();
}

function atualizarPainel() {
    const btn = document.querySelector('.btn-atualizar');
    btn.style.opacity = '.5';
    btn.style.pointerEvents = 'none';
    Promise.all([carregarAgendaHoje(), carregarHistorico()]).finally(() => {
        btn.style.opacity = '';
        btn.style.pointerEvents = '';
    });
}

/* ─────────────────────────────────────
   AGENDA DE HOJE
───────────────────────────────────── */
async function carregarAgendaHoje() {
    const hoje = isoHoje();
    const loading = document.getElementById('load-hoje');
    const lista = document.getElementById('lista-hoje');

    loading.style.display = 'flex';
    lista.innerHTML = '';

    let ags = [];
    try {
        const res = await fetch(
            `${API_BASE}/admin/agendamentos?barbeiro=${enc(barbeiroLogado)}&data=${hoje}`
        );
        if (res.ok) ags = await res.json();
    } catch (e) {
        console.warn('Backend indisponível.');
    }

    loading.style.display = 'none';

    // Calcular KPIs
    const agora = new Date();
    const horaAgora = `${pad(agora.getHours())}:${pad(agora.getMinutes())}`;
    const proximos = ags.filter(a => a.horario.slice(0, 5) > horaAgora);
    const proximo = proximos.length ? proximos[0] : null;
    const faturamento = ags.reduce((s, a) => s + (PRECOS[a.servico] || 0), 0);
    const livres = TOTAL_SLOTS_DIA - ags.length;

    document.getElementById('kpi-fat').textContent = `R$ ${faturamento}`;
    document.getElementById('kpi-cli').textContent = ags.length;
    document.getElementById('kpi-livre').textContent = livres > 0 ? livres : '0';
    document.getElementById('kpi-prox').textContent = proximo
        ? `${proximo.horario.slice(0, 5)} · ${proximo.servico}`
        : 'Nenhum';

    if (ags.length === 0) {
        lista.innerHTML = '<div class="vazio">Nenhum agendamento para hoje.</div>';
        return;
    }

    ags.forEach(a => {
        const isProximo = proximo && a.id === proximo.id;
        const preco = PRECOS[a.servico] ?? '?';
        const div = document.createElement('div');
        div.className = 'ag-item' + (isProximo ? ' proximo' : '');
        div.innerHTML = `
      <span class="ag-hora">${a.horario.slice(0, 5)}</span>
      <div class="ag-info">
        <span class="ag-servico">
          ${a.servico}
          ${isProximo ? '<span class="ag-tag">Próximo</span>' : ''}
        </span>
      </div>
      <span class="ag-preco">R$ ${preco}</span>
    `;
        lista.appendChild(div);
    });
}

/* ─────────────────────────────────────
   HISTÓRICO
───────────────────────────────────── */
async function carregarHistorico(dataFiltro) {
    const loading = document.getElementById('load-hist');
    const lista = document.getElementById('lista-hist');
    const resumo = document.getElementById('resumo-hist');

    loading.style.display = 'flex';
    lista.innerHTML = '';
    resumo.className = 'resumo-hist';

    let url = `${API_BASE}/admin/historico?barbeiro=${enc(barbeiroLogado)}`;
    if (dataFiltro) url += `&data=${dataFiltro}`;

    let ags = [];
    try {
        const res = await fetch(url);
        if (res.ok) ags = await res.json();
    } catch (e) {
        console.warn('Backend indisponível.');
    }

    loading.style.display = 'none';

    if (ags.length === 0) {
        lista.innerHTML = '<div class="vazio">Nenhum agendamento encontrado.</div>';
        return;
    }

    ags.forEach(a => {
        const preco = PRECOS[a.servico] ?? '?';
        const [ano, mes, dia] = a.data.split('-');
        const dataFmt = `${dia}/${mes}/${ano}`;
        const div = document.createElement('div');
        div.className = 'ag-item';
        div.innerHTML = `
      <span class="ag-hora">${a.horario.slice(0, 5)}</span>
      <div class="ag-info">
        <span class="ag-servico">${a.servico}</span>
        <span class="ag-meta">📅 ${dataFmt}</span>
      </div>
      <span class="ag-preco">R$ ${preco}</span>
    `;
        lista.appendChild(div);
    });

    // Resumo do período
    const totalFat = ags.reduce((s, a) => s + (PRECOS[a.servico] || 0), 0);
    resumo.className = 'resumo-hist visivel';
    resumo.innerHTML = `
    <div class="resumo-item">
      <span>Total de Clientes</span>
      <strong>${ags.length}</strong>
    </div>
    <div class="resumo-item">
      <span>Faturamento Total</span>
      <strong>R$ ${totalFat}</strong>
    </div>
    <div class="resumo-item">
      <span>Ticket Médio</span>
      <strong>R$ ${ags.length ? Math.round(totalFat / ags.length) : 0}</strong>
    </div>
  `;
}

function filtrarHistorico() {
    const data = document.getElementById('filtro-data').value;
    if (data) carregarHistorico(data);
}

function limparFiltro() {
    document.getElementById('filtro-data').value = '';
    carregarHistorico();
}

/* ─────────────────────────────────────
   UTILS
───────────────────────────────────── */
function isoHoje() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function pad(n) { return String(n).padStart(2, '0'); }
function enc(s) { return encodeURIComponent(s); }