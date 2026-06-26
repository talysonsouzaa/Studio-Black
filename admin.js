/* =============================================
STUDIO BLACK – admin.js
=============================================

*/

const API_BASE = 'https://studioblack.up.railway.app';

/* ── Senhas ── */
const SENHAS = {
    'Borel Barber': 'borel2026',
    'Junior Barber': 'junior2026',
};

/* ── Preços dinâmicos (atualizados do backend) ── */
let PRECOS = {
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
let SERVICOS_DB = []; // lista completa vinda do banco

const TOTAL_SLOTS_DIA = 28; // 07:00 a 21:00 de 30 em 30min

// Todos os slots possíveis do dia (07:00 até 21:00)
const TODOS_SLOTS = [];
for (let h = 7; h <= 21; h++) {
    TODOS_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
    if (h < 21) TODOS_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}
const SLOTS_DIA = TODOS_SLOTS;

let agendaHojeCache = []; // cache dos agendamentos do dia
let dataAgendaAtual = null; // data sendo visualizada na agenda (definida no abrirPainel)

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

    // Inicializar data da agenda como hoje
    dataAgendaAtual = isoHoje();

    // Injetar controles de navegação de data na agenda
    const secHeader = document.querySelector('.painel-section .section-header');
    if (secHeader && !document.getElementById('nav-agenda-data')) {
        secHeader.innerHTML = `
            <div class="section-header-left">
                <h2>📅 Agenda</h2>
                <span id="label-data-hoje" class="label-data"></span>
            </div>
            <div class="nav-data-wrap" id="nav-agenda-data">
                <button class="nav-data-btn" onclick="navegarAgenda(-1)" title="Dia anterior">‹</button>
                <input type="date" id="input-data-agenda" value="${dataAgendaAtual}"
                    onchange="navegarAgendaData(this.value)" />
                <button class="nav-data-btn hoje-btn" onclick="navegarAgendaData('${isoHoje()}')">Hoje</button>
                <button class="nav-data-btn" onclick="navegarAgenda(1)" title="Próximo dia">›</button>
            </div>
        `;
    }

    atualizarLabelData();
    carregarServicosDoBackend().then(() => {
        carregarAgendaHoje();
        carregarHistorico();
        carregarFaturamento();
    });
}

function atualizarLabelData() {
    const [ano, mes, dia] = dataAgendaAtual.split('-');
    const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
    const opts = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
    const label = document.getElementById('label-data-hoje');
    if (label) label.textContent = d.toLocaleDateString('pt-BR', opts);
    const input = document.getElementById('input-data-agenda');
    if (input) input.value = dataAgendaAtual;
}

function navegarAgenda(delta) {
    const [ano, mes, dia] = dataAgendaAtual.split('-').map(Number);
    const d = new Date(ano, mes - 1, dia);
    d.setDate(d.getDate() + delta);
    dataAgendaAtual = d.toISOString().split('T')[0];
    atualizarLabelData();
    carregarAgendaHoje();
}

function navegarAgendaData(data) {
    if (!data) return;
    dataAgendaAtual = data;
    atualizarLabelData();
    carregarAgendaHoje();
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
    const dataConsulta = dataAgendaAtual || isoHoje();
    const loading = document.getElementById('load-hoje');
    const lista = document.getElementById('lista-hoje');

    loading.style.display = 'flex';
    lista.innerHTML = '';

    let ags = [];
    try {
        const res = await fetch(
            `${API_BASE}/admin/agendamentos?barbeiro=${enc(barbeiroLogado)}&data=${dataConsulta}`
        );
        if (res.ok) ags = await res.json();
    } catch (e) {
        console.warn('Backend indisponível.');
    }

    loading.style.display = 'none';
    agendaHojeCache = ags;

    const ehHoje = dataConsulta === isoHoje();
    const agora = new Date();
    const horaAgora = `${pad(agora.getHours())}:${pad(agora.getMinutes())}`;
    const horaAgoraFull = `${pad(agora.getHours())}:${pad(agora.getMinutes())}:00`;
    const proximos = ehHoje ? ags.filter(a => a.horario > horaAgoraFull) : [];
    const proximo = proximos.length ? proximos[0] : null;
    const faturamento = ags.reduce((s, a) => s + (PRECOS[a.servico] || 0), 0);
    const livres = TOTAL_SLOTS_DIA - ags.length;

    // KPIs só atualizam quando for hoje
    if (ehHoje) {
        document.getElementById('kpi-fat').textContent = `R$ ${faturamento}`;
        document.getElementById('kpi-cli').textContent = ags.length;
        document.getElementById('kpi-livre').textContent = livres > 0 ? livres : '0';
        const nomeProx = proximo ? (proximo.nome || 'Cliente') : null;
        document.getElementById('kpi-prox').textContent = proximo
            ? `${proximo.horario.slice(0, 5)} · ${nomeProx}`
            : 'Nenhum';
        if (!proximo) buscarProximoGeral();
    }

    if (ags.length === 0) {
        lista.innerHTML = '<div class="vazio">Nenhum agendamento para este dia.</div>';
        return;
    }

    ags.forEach(a => {
        const isProximo = proximo && a.id === proximo.id;
        const jaPassou = ehHoje && a.horario.slice(0, 5) < horaAgora;
        const preco = PRECOS[a.servico] ?? '?';
        const nomeCliente = a.nome || '—';
        const tel = a.telefone || '';
        const div = document.createElement('div');
        div.className = 'ag-item' + (isProximo ? ' proximo' : '') + (jaPassou ? ' passado' : '');
        div.innerHTML = `
      <span class="ag-hora">${a.horario.slice(0, 5)}</span>
      <div class="ag-info">
        <span class="ag-servico">
          ${a.servico}
          ${isProximo ? '<span class="ag-tag">Próximo</span>' : ''}
          ${jaPassou ? '<span class="ag-tag" style="background:#555;color:#ccc">Concluído</span>' : ''}
        </span>
        <span class="ag-meta">👤 ${nomeCliente}${tel ? ' · 📱 ' + tel : ''}</span>
      </div>
      <div class="ag-acoes">
        <span class="ag-preco">R$ ${preco}</span>
        <button class="btn-cancelar-ag" onclick="cancelarAgendamento(${a.id}, '${nomeCliente.replace(/'/g, "\\'")}', '${tel}', '${a.servico.replace(/'/g, "\\'")}', '${a.data}', '${a.horario.slice(0, 5)}')">✕ Cancelar</button>
      </div>
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
        const nomeCliente = a.nome || '—';
        const tel = a.telefone || '';
        const div = document.createElement('div');
        div.className = 'ag-item';
        div.innerHTML = `
      <span class="ag-hora">${a.horario.slice(0, 5)}</span>
      <div class="ag-info">
        <span class="ag-servico">${a.servico}</span>
        <span class="ag-meta">📅 ${dataFmt} · 👤 ${nomeCliente}${tel ? ' · 📱 ' + tel : ''}</span>
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
   FATURAMENTO
───────────────────────────────────── */
async function carregarFaturamento() {
    // Buscar todo o histórico do barbeiro
    let todos = [];
    try {
        const res = await fetch(`${API_BASE}/admin/historico?barbeiro=${enc(barbeiroLogado)}`);
        if (res.ok) todos = await res.json();
    } catch (e) { return; }

    const hoje = isoHoje();
    const agora = new Date();
    const mesAtual = `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}`;

    // Inicializar input de mês com mês atual
    const inputMes = document.getElementById('fat-filtro-mes');
    if (inputMes && !inputMes.value) inputMes.value = mesAtual;

    // Faturamento de hoje
    const agsHoje = todos.filter(a => a.data === hoje);
    const fatHoje = agsHoje.reduce((s, a) => s + (PRECOS[a.servico] || 0), 0);

    // Faturamento do mês
    const agsMes = todos.filter(a => a.data.startsWith(mesAtual));
    const fatMes = agsMes.reduce((s, a) => s + (PRECOS[a.servico] || 0), 0);
    const ticketMedio = agsMes.length ? Math.round(fatMes / agsMes.length) : 0;

    // Atualizar cards
    const [ano, mes, dia] = hoje.split('-');
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    document.getElementById('fat-dia-valor').textContent = `R$ ${fatHoje}`;
    document.getElementById('fat-dia-label').textContent = `${dia}/${mes}/${ano}`;
    document.getElementById('fat-mes-valor').textContent = `R$ ${fatMes}`;
    document.getElementById('fat-mes-label').textContent = `${meses[agora.getMonth()]} ${agora.getFullYear()}`;
    document.getElementById('fat-cli-mes').textContent = agsMes.length;
    document.getElementById('fat-ticket').textContent = `R$ ${ticketMedio}`;

    // Últimos 7 dias
    renderizarUltimosDias(todos, agora);
}

function renderizarUltimosDias(todos, agora) {
    const container = document.getElementById('fat-ultimos-dias');
    if (!container) return;

    const linhas = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(agora);
        d.setDate(agora.getDate() - i);
        const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const dd = pad(d.getDate());
        const mm = pad(d.getMonth() + 1);
        const diasNome = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const nomeDia = diasNome[d.getDay()];
        const isHoje = iso === isoHoje();

        const agsDia = todos.filter(a => a.data === iso);
        const fat = agsDia.reduce((s, a) => s + (PRECOS[a.servico] || 0), 0);

        // barra de progresso relativa (max visual = R$500)
        const pct = Math.min(Math.round((fat / 500) * 100), 100);

        linhas.push(`
            <div style="display:grid;grid-template-columns:60px 1fr 80px;align-items:center;gap:10px;">
                <span style="color:${isHoje ? '#d4a843' : '#888'};font-size:12px;font-family:'DM Sans',sans-serif;">
                    ${nomeDia} ${dd}/${mm}
                </span>
                <div style="background:#1e1e1e;border-radius:4px;height:8px;overflow:hidden;">
                    <div style="background:${isHoje ? '#d4a843' : '#444'};width:${pct}%;height:100%;border-radius:4px;transition:width .4s;"></div>
                </div>
                <span style="color:${isHoje ? '#d4a843' : '#ccc'};font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;text-align:right;">
                    R$ ${fat}
                </span>
            </div>
        `);
    }

    container.innerHTML = linhas.join('');
}

async function consultarFatDia(data) {
    if (!data) return;
    const container = document.getElementById('fat-dia-detalhe');
    container.innerHTML = '<span style="color:#666;">Carregando…</span>';

    let ags = [];
    try {
        const res = await fetch(`${API_BASE}/admin/agendamentos?barbeiro=${enc(barbeiroLogado)}&data=${data}`);
        if (res.ok) ags = await res.json();
    } catch (e) { }

    const [ano, mes, dia] = data.split('-');
    const dataFmt = `${dia}/${mes}/${ano}`;
    const fat = ags.reduce((s, a) => s + (PRECOS[a.servico] || 0), 0);

    if (ags.length === 0) {
        container.innerHTML = `<span style="color:#555;">Nenhum agendamento em ${dataFmt}.</span>`;
        return;
    }

    const linhasServicos = ags.map(a => {
        const preco = PRECOS[a.servico] || 0;
        const nome = a.nome || '—';
        return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1e1e1e;">
            <span style="color:#ccc;font-size:13px;">${a.horario.slice(0, 5)} · ${a.servico} · ${nome}</span>
            <span style="color:#d4a843;font-size:13px;font-weight:500;">R$ ${preco}</span>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div style="margin-bottom:10px;">${linhasServicos}</div>
        <div style="display:flex;justify-content:space-between;padding-top:8px;">
            <span style="color:#888;font-size:13px;">${ags.length} cliente${ags.length > 1 ? 's' : ''} em ${dataFmt}</span>
            <span style="color:#d4a843;font-size:15px;font-weight:700;">Total: R$ ${fat}</span>
        </div>
    `;
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


/* ─────────────────────────────────────
   INTERAÇÕES DOS KPI CARDS
───────────────────────────────────── */

// Rolar até a agenda de hoje
function rolarParaAgenda() {
    const secao = document.querySelector('.painel-section');
    if (secao) secao.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Rolar até o próximo cliente e piscar
function rolarParaProximo() {
    const proximo = document.querySelector('.ag-item.proximo');
    if (proximo) {
        proximo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        proximo.style.transition = 'box-shadow 0.3s ease';
        proximo.style.boxShadow = '0 0 0 3px #d4a843';
        setTimeout(() => { proximo.style.boxShadow = ''; }, 1500);
    } else {
        rolarParaAgenda();
    }
}

// Abrir modal de horários livres
function abrirModalLivres() {
    const modal = document.getElementById('modal-livres');
    // Setar data padrão como hoje
    const inputData = document.getElementById('modal-data-input');
    if (!inputData.value) inputData.value = isoHoje();
    modal.style.display = 'flex';
    buscarLivresData(inputData.value);
}

async function buscarLivresData(data) {
    const lista = document.getElementById('modal-livres-lista');
    lista.innerHTML = '<div class="modal-vazio">🔄 Buscando horários…</div>';

    let ocupados = [];
    try {
        const res = await fetch(
            `${API_BASE}/admin/agendamentos?barbeiro=${enc(barbeiroLogado)}&data=${data}`
        );
        if (res.ok) {
            const ags = await res.json();
            ocupados = ags.map(a => a.horario.slice(0, 5));
        }
    } catch (e) { }

    lista.innerHTML = '';

    const agora = new Date();
    const isHoje = data === isoHoje();
    const horaAgora = `${pad(agora.getHours())}:${pad(agora.getMinutes())}`;

    const livres = SLOTS_DIA.filter(s => {
        if (ocupados.includes(s)) return false;
        if (isHoje && s < horaAgora) return false;
        return true;
    });

    if (livres.length === 0) {
        lista.innerHTML = '<div class="modal-vazio">Nenhum horário disponível neste dia.</div>';
    } else {
        livres.forEach(slot => {
            const div = document.createElement('div');
            div.className = 'modal-slot';
            div.textContent = slot;
            lista.appendChild(div);
        });
    }
}

// Buscar próximo agendamento geral (qualquer dia futuro)
async function buscarProximoGeral() {
    try {
        const res = await fetch(
            `${API_BASE}/admin/historico?barbeiro=${enc(barbeiroLogado)}`
        );
        if (!res.ok) return;
        const todos = await res.json();
        const agora = new Date();
        const isoAgora = `${isoHoje()} ${pad(agora.getHours())}:${pad(agora.getMinutes())}:00`;

        const futuros = todos.filter(a => {
            const isoAg = `${a.data} ${a.horario}`;
            return isoAg > isoAgora;
        });

        if (futuros.length > 0) {
            // Ordenar crescente
            futuros.sort((a, b) => `${a.data} ${a.horario}` > `${b.data} ${b.horario}` ? 1 : -1);
            const prox = futuros[0];
            const [ano, mes, dia] = prox.data.split('-');
            const nome = prox.nome ? capitalize(prox.nome) : 'Sem nome';
            document.getElementById('kpi-prox').textContent =
                `${dia}/${mes} às ${prox.horario.slice(0, 5)} · ${nome}`;
        }
    } catch (e) { }
}

function fecharModalLivres(event) {
    if (!event || event.target === document.getElementById('modal-livres')) {
        document.getElementById('modal-livres').style.display = 'none';
    }
}


/* ── Helper capitalize ── */
function capitalize(str) {
    return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}


/* ─────────────────────────────────────
   CANCELAMENTO PELO ADMIN
───────────────────────────────────── */
function cancelarAgendamento(id, nome, telefone, servico, data, horario) {
    const nomeExib = nome && nome !== '—' ? capitalize(nome) : 'Cliente';
    const [ano, mes, dia] = data.split('-');
    const dataFmt = `${dia}/${mes}/${ano}`;

    // Criar modal de confirmação customizado
    const overlay = document.createElement('div');
    overlay.id = 'modal-cancelar-overlay';
    overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.75);
        display:flex;align-items:center;justify-content:center;z-index:9999;
        animation:fadeIn .15s ease;
    `;
    overlay.innerHTML = `
        <div style="
            background:#1a1a1a;border:1px solid #333;border-radius:12px;
            padding:28px 32px;max-width:420px;width:90%;
            animation:slideUp .2s ease;
        ">
            <h3 style="color:#fff;font-family:'Bebas Neue',sans-serif;font-size:22px;margin:0 0 6px;letter-spacing:1px;">
                Cancelar Agendamento
            </h3>
            <p style="color:#888;font-size:13px;margin:0 0 20px;">Esta ação não poderá ser desfeita.</p>

            <div style="background:#111;border:1px solid #2a2a2a;border-radius:8px;padding:16px;margin-bottom:20px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                    <span style="color:#666;font-size:13px;">Cliente</span>
                    <span style="color:#fff;font-size:13px;font-weight:500;">${nomeExib}</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                    <span style="color:#666;font-size:13px;">Serviço</span>
                    <span style="color:#fff;font-size:13px;">${servico}</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                    <span style="color:#666;font-size:13px;">Data</span>
                    <span style="color:#fff;font-size:13px;">${dataFmt}</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                    <span style="color:#666;font-size:13px;">Horário</span>
                    <span style="color:#d4a843;font-size:13px;font-weight:500;">${horario}</span>
                </div>
            </div>

            ${telefone && telefone !== '—' ? `
            <div style="background:#0d1f13;border:1px solid #1a3a20;border-radius:8px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;gap:10px;">
                <span style="font-size:20px;">📱</span>
                <div>
                    <p style="color:#4caf50;font-size:12px;font-weight:500;margin:0 0 2px;">Aviso automático via WhatsApp</p>
                    <p style="color:#888;font-size:12px;margin:0;">Uma mensagem será enviada para ${telefone}</p>
                </div>
            </div>
            ` : `
            <div style="background:#1f1200;border:1px solid #3a2000;border-radius:8px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;gap:10px;">
                <span style="font-size:20px;">⚠️</span>
                <p style="color:#f0a030;font-size:12px;margin:0;">Nenhum telefone cadastrado. O cliente não será avisado automaticamente.</p>
            </div>
            `}

            <div style="display:flex;gap:12px;">
                <button id="btn-modal-nao" style="
                    flex:1;padding:12px;background:transparent;
                    border:1px solid #333;border-radius:8px;
                    color:#aaa;font-size:14px;cursor:pointer;
                    font-family:'DM Sans',sans-serif;
                " onmouseover="this.style.background='#222'" onmouseout="this.style.background='transparent'">
                    Voltar
                </button>
                <button id="btn-modal-sim" style="
                    flex:1;padding:12px;background:#c0392b;
                    border:1px solid #e74c3c;border-radius:8px;
                    color:#fff;font-size:14px;font-weight:500;cursor:pointer;
                    font-family:'DM Sans',sans-serif;
                " onmouseover="this.style.background='#e74c3c'" onmouseout="this.style.background='#c0392b'">
                    ✕ Confirmar Cancelamento
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Fechar ao clicar fora
    overlay.addEventListener('click', e => {
        if (e.target === overlay) fecharModalCancelar();
    });
    document.getElementById('btn-modal-nao').onclick = fecharModalCancelar;
    document.getElementById('btn-modal-sim').onclick = () => confirmarCancelamento(id, nome, telefone, servico, data, horario, dataFmt);
}

function fecharModalCancelar() {
    const overlay = document.getElementById('modal-cancelar-overlay');
    if (overlay) overlay.remove();
}

async function confirmarCancelamento(id, nome, telefone, servico, data, horario, dataFmt) {
    const btnSim = document.getElementById('btn-modal-sim');
    btnSim.textContent = 'Cancelando…';
    btnSim.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/admin/cancelar/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            fecharModalCancelar();
            mostrarToast('Erro ao cancelar. Tente novamente.', 'erro');
            return;
        }

        fecharModalCancelar();
        mostrarToast(`Agendamento de ${nome && nome !== '—' ? capitalize(nome) : 'cliente'} cancelado.`, 'ok');

        // Abrir WhatsApp com mensagem de cancelamento
        if (telefone && telefone !== '—') {
            const tel = telefone.replace(/\D/g, '');
            const numCompleto = tel.startsWith('55') ? tel : '55' + tel;
            const nomeMsg = nome && nome !== '—' ? ' ' + capitalize(nome) : '';
            const msg = encodeURIComponent(
                `Olá${nomeMsg}! 😊

Infelizmente tivemos um imprevisto e precisamos cancelar seu agendamento:

✂️ Serviço: ${servico}
📅 Data: ${dataFmt}
⏰ Horário: ${horario}

Pedimos desculpas pelo transtorno. Entre em contato para remarcar quando quiser, será um prazer atendê-lo(a)!

Studio Black 💈`
            );
            setTimeout(() => {
                window.open(`https://wa.me/${numCompleto}?text=${msg}`, '_blank');
            }, 400);
        }

        await carregarAgendaHoje();
    } catch (e) {
        fecharModalCancelar();
        mostrarToast('Erro ao conectar ao servidor.', 'erro');
    }
}

/* ─────────────────────────────────────
   TOAST DE FEEDBACK
───────────────────────────────────── */
function mostrarToast(msg, tipo) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position:fixed;bottom:28px;left:50%;transform:translateX(-50%);
        background:${tipo === 'ok' ? '#1a3a20' : '#3a1010'};
        border:1px solid ${tipo === 'ok' ? '#4caf50' : '#e74c3c'};
        color:${tipo === 'ok' ? '#4caf50' : '#e74c3c'};
        padding:12px 24px;border-radius:8px;font-size:14px;
        z-index:99999;animation:fadeIn .2s ease;
        font-family:'DM Sans',sans-serif;
    `;
    toast.textContent = (tipo === 'ok' ? '✓ ' : '✕ ') + msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

/* ─────────────────────────────────────
   SERVIÇOS – Carregar do Backend
───────────────────────────────────── */
async function carregarServicosDoBackend() {
    try {
        const res = await fetch(`${API_BASE}/admin/servicos?barbeiro=${enc(barbeiroLogado)}`);
        if (res.ok) {
            const lista = await res.json();
            SERVICOS_DB = lista;
            // Atualizar PRECOS com os valores do banco
            lista.forEach(s => { PRECOS[s.nome] = s.preco; });
        }
    } catch (e) {
        console.warn('Não foi possível carregar serviços do backend. Usando valores locais.');
    }
}

/* ─────────────────────────────────────
   MODAL – Editar Serviços
───────────────────────────────────── */
async function abrirModalServicos() {
    // Garantir que temos os serviços do banco
    if (SERVICOS_DB.length === 0) await carregarServicosDoBackend();

    const overlay = document.createElement('div');
    overlay.id = 'modal-servicos-overlay';
    overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.82);
        display:flex;align-items:center;justify-content:center;z-index:9999;
        animation:fadeIn .15s ease;
    `;

    const linhas = SERVICOS_DB.map(s => `
        <div class="srv-linha" data-id="${s.id}" style="
            display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;
            padding:10px 0;border-bottom:1px solid #222;
        ">
            <input class="srv-nome" type="text" value="${s.nome.replace(/"/g, '&quot;')}" style="
                background:#111;border:1px solid #333;color:#fff;border-radius:6px;
                padding:7px 10px;font-size:13px;font-family:'DM Sans',sans-serif;width:100%;
            " />
            <div style="display:flex;align-items:center;gap:4px;">
                <span style="color:#888;font-size:13px;">R$</span>
                <input class="srv-preco" type="number" min="0" step="0.01" value="${s.preco}" style="
                    background:#111;border:1px solid #333;color:#d4a843;border-radius:6px;
                    padding:7px 8px;font-size:13px;font-family:'DM Sans',sans-serif;width:72px;
                " />
            </div>
            <button onclick="salvarServico(${s.id}, this)" style="
                background:#d4a84322;border:1px solid #d4a84355;color:#d4a843;
                border-radius:6px;padding:7px 12px;font-size:12px;cursor:pointer;
                font-family:'DM Sans',sans-serif;transition:background .15s;white-space:nowrap;
            " onmouseover="this.style.background='#d4a84344'" onmouseout="this.style.background='#d4a84322'">
                💾 Salvar
            </button>
        </div>
    `).join('');

    overlay.innerHTML = `
        <div style="
            background:#1a1a1a;border:1px solid #333;border-radius:12px;
            padding:28px 32px;max-width:560px;width:92%;
            animation:slideUp .2s ease;max-height:88vh;overflow-y:auto;
        ">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <h3 style="color:#fff;font-family:'Bebas Neue',sans-serif;font-size:22px;margin:0;letter-spacing:1px;">
                    ✏️ Editar Serviços e Preços
                </h3>
                <button onclick="fecharModalServicos()" style="background:none;border:none;color:#888;font-size:20px;cursor:pointer;">✕</button>
            </div>
            <p style="color:#666;font-size:12px;margin:0 0 18px;">
                As alterações refletem no site de agendamento imediatamente.
            </p>
            <div id="srv-lista">${linhas}</div>
            <button onclick="fecharModalServicos()" style="
                width:100%;margin-top:20px;padding:11px;background:transparent;
                border:1px solid #333;border-radius:8px;color:#aaa;font-size:14px;
                cursor:pointer;font-family:'DM Sans',sans-serif;
            ">Fechar</button>
        </div>
    `;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) fecharModalServicos(); });
}

function fecharModalServicos() {
    const el = document.getElementById('modal-servicos-overlay');
    if (el) el.remove();
}

async function salvarServico(id, btn) {
    const linha = btn.closest('.srv-linha');
    const nome = linha.querySelector('.srv-nome').value.trim();
    const preco = parseFloat(linha.querySelector('.srv-preco').value);

    if (!nome || isNaN(preco) || preco < 0) {
        mostrarToast('Nome e preço válidos são obrigatórios.', 'erro');
        return;
    }

    const textoOriginal = btn.textContent;
    btn.textContent = 'Salvando…';
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/admin/servicos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, preco, barbeiro: barbeiroLogado })
        });

        if (res.ok) {
            // Atualizar cache local
            const idx = SERVICOS_DB.findIndex(s => s.id === id);
            if (idx !== -1) {
                const nomeAntigo = SERVICOS_DB[idx].nome;
                delete PRECOS[nomeAntigo];
                SERVICOS_DB[idx] = { id, nome, preco };
                PRECOS[nome] = preco;
            }
            btn.textContent = '✓ Salvo!';
            btn.style.color = '#4caf50';
            btn.style.borderColor = '#4caf50';
            setTimeout(() => {
                btn.textContent = textoOriginal;
                btn.style.color = '#d4a843';
                btn.style.borderColor = '#d4a84355';
                btn.disabled = false;
            }, 1800);
            mostrarToast(`"${nome}" atualizado com sucesso!`, 'ok');
        } else {
            const j = await res.json();
            mostrarToast(j.erro || 'Erro ao salvar. Tente novamente.', 'erro');
            btn.textContent = textoOriginal;
            btn.disabled = false;
        }
    } catch (e) {
        mostrarToast('Erro ao conectar ao servidor.', 'erro');
        btn.textContent = textoOriginal;
        btn.disabled = false;
    }
}


/* ─────────────────────────────────────
   EXPEDIENTE – Modal de horários de trabalho
───────────────────────────────────── */
const DIAS_EXP = [
    { key: 'segunda', label: 'Segunda-feira' },
    { key: 'terca', label: 'Terça-feira' },
    { key: 'quarta', label: 'Quarta-feira' },
    { key: 'quinta', label: 'Quinta-feira' },
    { key: 'sexta', label: 'Sexta-feira' },
    { key: 'sabado', label: 'Sábado' },
    { key: 'domingo', label: 'Domingo' },
];

async function abrirModalExpediente() {
    // Buscar expediente e almoço do backend
    let expediente = {};
    let almoco = { ativo: 1, hora_inicio: '12:00:00', hora_fim: '13:30:00' };
    try {
        const [resExp, resAlm] = await Promise.all([
            fetch(`${API_BASE}/admin/expediente?barbeiro=${enc(barbeiroLogado)}`),
            fetch(`${API_BASE}/admin/almoco?barbeiro=${enc(barbeiroLogado)}`)
        ]);
        if (resExp.ok) { const lista = await resExp.json(); lista.forEach(d => { expediente[d.dia_semana] = d; }); }
        if (resAlm.ok) { almoco = await resAlm.json(); }
    } catch (e) { }

    const overlay = document.createElement('div');
    overlay.id = 'modal-expediente-overlay';
    overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.82);
        display:flex;align-items:center;justify-content:center;z-index:9999;
        animation:fadeIn .15s ease;
    `;

    const linhas = DIAS_EXP.map(dia => {
        const exp = expediente[dia.key] || { hora_inicio: '07:00:00', hora_fim: '21:00:00', fechado: dia.key === 'domingo' ? 1 : 0 };
        const inicio = exp.hora_inicio ? exp.hora_inicio.slice(0, 5) : '07:00';
        const fim = exp.hora_fim ? exp.hora_fim.slice(0, 5) : '21:00';
        const fechado = exp.fechado ? 1 : 0;

        // Gerar options de 07:00 a 21:00
        const opts = [];
        for (let h = 7; h <= 21; h++) {
            opts.push(`${String(h).padStart(2, '0')}:00`);
            if (h < 21) opts.push(`${String(h).padStart(2, '0')}:30`);
        }
        const optsIni = opts.map(o => `<option value="${o}" ${o === inicio ? 'selected' : ''}>${o}</option>`).join('');
        const optsFim = opts.map(o => `<option value="${o}" ${o === fim ? 'selected' : ''}>${o}</option>`).join('');

        return `
        <div class="exp-linha" data-dia="${dia.key}" style="
            display:grid;grid-template-columns:120px 1fr;gap:12px;align-items:center;
            padding:10px 0;border-bottom:1px solid #222;
        ">
            <span style="color:#ccc;font-size:13px;font-family:'DM Sans',sans-serif;">${dia.label}</span>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                    <input type="checkbox" class="exp-fechado" ${fechado ? 'checked' : ''} 
                        onchange="toggleExpedienteDia(this)"
                        style="accent-color:#e74c3c;width:14px;height:14px;" />
                    <span style="color:#e74c3c;font-size:12px;">Fechado</span>
                </label>
                <div class="exp-horarios" style="${fechado ? 'opacity:.3;pointer-events:none;' : ''} display:flex;align-items:center;gap:6px;">
                    <select class="exp-inicio" style="
                        background:#111;border:1px solid #333;color:#d4a843;
                        border-radius:6px;padding:5px 8px;font-size:13px;
                        font-family:'DM Sans',sans-serif;cursor:pointer;
                    ">${optsIni}</select>
                    <span style="color:#666;font-size:12px;">até</span>
                    <select class="exp-fim" style="
                        background:#111;border:1px solid #333;color:#d4a843;
                        border-radius:6px;padding:5px 8px;font-size:13px;
                        font-family:'DM Sans',sans-serif;cursor:pointer;
                    ">${optsFim}</select>
                </div>
            </div>
        </div>`;
    }).join('');

    // Gerar options de horário de almoço (10:00 a 16:00)
    const optsAlm = [];
    for (let h = 10; h <= 16; h++) {
        optsAlm.push(`${String(h).padStart(2, '0')}:00`);
        optsAlm.push(`${String(h).padStart(2, '0')}:30`);
    }
    const almIni = almoco.hora_inicio ? almoco.hora_inicio.slice(0, 5) : '12:00';
    const almFim = almoco.hora_fim ? almoco.hora_fim.slice(0, 5) : '13:30';
    const almAtivo = almoco.ativo ? true : false;

    const almOpts = (val, selected) => optsAlm.map(o => `<option value="${o}" ${o === selected ? 'selected' : ''}>${o}</option>`).join('');

    overlay.innerHTML = `
        <div style="
            background:#1a1a1a;border:1px solid #333;border-radius:12px;
            padding:28px 32px;max-width:580px;width:92%;
            animation:slideUp .2s ease;max-height:90vh;overflow-y:auto;
        ">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <h3 style="color:#fff;font-family:'Bebas Neue',sans-serif;font-size:22px;margin:0;letter-spacing:1px;">
                    ⏰ Meu Expediente
                </h3>
                <button onclick="fecharModalExpediente()" style="background:none;border:none;color:#888;font-size:20px;cursor:pointer;">✕</button>
            </div>
            <p style="color:#666;font-size:12px;margin:0 0 18px;">
                Defina seu horário de trabalho por dia da semana. Os clientes só verão os horários dentro do seu expediente.
            </p>
            <div id="exp-lista">${linhas}</div>

            <!-- Intervalo de Almoço -->
            <div style="margin-top:20px;padding:16px;background:#111;border:1px solid #2a2a2a;border-radius:10px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                    <span style="color:#ccc;font-size:14px;font-family:'DM Sans',sans-serif;">🍽️ Intervalo de Almoço</span>
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                        <span style="color:#888;font-size:12px;">${almAtivo ? 'Ativo' : 'Desativado'}</span>
                        <input type="checkbox" id="alm-ativo" ${almAtivo ? 'checked' : ''}
                            onchange="this.previousElementSibling.textContent=this.checked?'Ativo':'Desativado';document.getElementById('alm-horarios').style.opacity=this.checked?'1':'.3';document.getElementById('alm-horarios').style.pointerEvents=this.checked?'':'none';"
                            style="accent-color:#d4a843;width:16px;height:16px;" />
                    </label>
                </div>
                <div id="alm-horarios" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;${almAtivo ? '' : 'opacity:.3;pointer-events:none;'}">
                    <span style="color:#888;font-size:13px;">De</span>
                    <select id="alm-inicio" style="background:#1a1a1a;border:1px solid #333;color:#d4a843;border-radius:6px;padding:5px 8px;font-size:13px;font-family:'DM Sans',sans-serif;">
                        ${almOpts(optsAlm, almIni)}
                    </select>
                    <span style="color:#888;font-size:13px;">até</span>
                    <select id="alm-fim" style="background:#1a1a1a;border:1px solid #333;color:#d4a843;border-radius:6px;padding:5px 8px;font-size:13px;font-family:'DM Sans',sans-serif;">
                        ${almOpts(optsAlm, almFim)}
                    </select>
                    <span style="color:#666;font-size:11px;">(horários bloqueados automaticamente)</span>
                </div>
            </div>

            <div style="display:flex;gap:10px;margin-top:20px;">
                <button onclick="fecharModalExpediente()" style="
                    flex:1;padding:11px;background:transparent;border:1px solid #333;
                    border-radius:8px;color:#aaa;font-size:14px;cursor:pointer;
                    font-family:'DM Sans',sans-serif;
                ">Fechar</button>
                <button onclick="salvarExpediente()" style="
                    flex:1;padding:11px;background:#d4a843;border:1px solid #d4a843;
                    border-radius:8px;color:#000;font-size:14px;font-weight:600;cursor:pointer;
                    font-family:'DM Sans',sans-serif;
                ">💾 Salvar Expediente</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) fecharModalExpediente(); });
}

function fecharModalExpediente() {
    const el = document.getElementById('modal-expediente-overlay');
    if (el) el.remove();
}

function toggleExpedienteDia(checkbox) {
    const linha = checkbox.closest('.exp-linha');
    const horarios = linha.querySelector('.exp-horarios');
    if (checkbox.checked) {
        horarios.style.opacity = '.3';
        horarios.style.pointerEvents = 'none';
    } else {
        horarios.style.opacity = '1';
        horarios.style.pointerEvents = '';
    }
}

async function salvarExpediente() {
    const linhas = document.querySelectorAll('.exp-linha');
    const dias = [];
    linhas.forEach(linha => {
        const dia_semana = linha.dataset.dia;
        const fechado = linha.querySelector('.exp-fechado').checked ? 1 : 0;
        const hora_inicio = linha.querySelector('.exp-inicio').value + ':00';
        const hora_fim = linha.querySelector('.exp-fim').value + ':00';
        dias.push({ dia_semana, hora_inicio, hora_fim, fechado });
    });

    // Dados do almoço
    const almAtivo = document.getElementById('alm-ativo') ? document.getElementById('alm-ativo').checked : true;
    const almInicio = document.getElementById('alm-inicio') ? document.getElementById('alm-inicio').value + ':00' : '12:00:00';
    const almFim = document.getElementById('alm-fim') ? document.getElementById('alm-fim').value + ':00' : '13:30:00';

    try {
        const [resExp, resAlm] = await Promise.all([
            fetch(`${API_BASE}/admin/expediente`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ barbeiro: barbeiroLogado, dias })
            }),
            fetch(`${API_BASE}/admin/almoco`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ barbeiro: barbeiroLogado, ativo: almAtivo ? 1 : 0, hora_inicio: almInicio, hora_fim: almFim })
            })
        ]);
        if (resExp.ok && resAlm.ok) {
            fecharModalExpediente();
            mostrarToast('Expediente e intervalo salvos!', 'ok');
        } else {
            mostrarToast('Erro ao salvar. Tente novamente.', 'erro');
        }
    } catch (e) {
        mostrarToast('Erro ao conectar ao servidor.', 'erro');
    }
}


/* ─────────────────────────────────────
   BLOQUEIO DE HORÁRIOS (adicionar no admin.js)
   Cole este bloco inteiro no seu admin.js
───────────────────────────────────── */

const SLOTS_BLOQUEIO = [
    '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
    '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
    '19:00', '19:30', '20:00', '20:30', '21:00'
];

async function abrirModalBloqueio() {
    const hoje = isoHoje();

    // Criar modal
    const overlay = document.createElement('div');
    overlay.id = 'modal-bloqueio-overlay';
    overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.8);
        display:flex;align-items:center;justify-content:center;z-index:9999;
        animation:fadeIn .15s ease;
    `;

    overlay.innerHTML = `
        <div style="
            background:#1a1a1a;border:1px solid #333;border-radius:12px;
            padding:28px 32px;max-width:480px;width:90%;
            animation:slideUp .2s ease;max-height:90vh;overflow-y:auto;
        ">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h3 style="color:#fff;font-family:'Bebas Neue',sans-serif;font-size:22px;margin:0;letter-spacing:1px;">
                    🔒 Bloquear Horários
                </h3>
                <button onclick="fecharModalBloqueio()" style="background:none;border:none;color:#888;font-size:20px;cursor:pointer;">✕</button>
            </div>

            <div style="margin-bottom:16px;">
                <label style="color:#888;font-size:13px;display:block;margin-bottom:6px;">Selecione a data:</label>
                <input type="date" id="bloqueio-data" value="${hoje}" min="${hoje}"
                    onchange="carregarHorariosBloqueio(this.value)"
                    style="background:#111;border:1px solid #333;color:#fff;border-radius:8px;padding:8px 12px;font-size:14px;width:100%;font-family:'DM Sans',sans-serif;" />
            </div>

            <div id="bloqueio-slots" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px;">
                <div style="color:#666;font-size:13px;grid-column:1/-1;">Carregando...</div>
            </div>

            <div style="display:flex;gap:10px;">
                <button onclick="fecharModalBloqueio()" style="
                    flex:1;padding:10px;background:transparent;border:1px solid #333;
                    border-radius:8px;color:#aaa;font-size:14px;cursor:pointer;
                    font-family:'DM Sans',sans-serif;
                ">Fechar</button>
                <button onclick="salvarBloqueios()" style="
                    flex:1;padding:10px;background:#d4a843;border:1px solid #d4a843;
                    border-radius:8px;color:#000;font-size:14px;font-weight:600;cursor:pointer;
                    font-family:'DM Sans',sans-serif;
                ">💾 Salvar Bloqueios</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) fecharModalBloqueio(); });

    await carregarHorariosBloqueio(hoje);
}

function fecharModalBloqueio() {
    const overlay = document.getElementById('modal-bloqueio-overlay');
    if (overlay) overlay.remove();
}

async function carregarHorariosBloqueio(data) {
    const container = document.getElementById('bloqueio-slots');
    if (!container) return;

    container.innerHTML = '<div style="color:#666;font-size:13px;grid-column:1/-1;">Carregando...</div>';

    // Buscar agendamentos, bloqueios e intervalo de almoço
    let agendados = [];
    let bloqueados = [];
    let slotsAlmoco = [];

    try {
        const [resAg, resBloc, resAlm] = await Promise.all([
            fetch(`${API_BASE}/admin/agendamentos?barbeiro=${enc(barbeiroLogado)}&data=${data}`),
            fetch(`${API_BASE}/admin/bloqueios?barbeiro=${enc(barbeiroLogado)}&data=${data}`),
            fetch(`${API_BASE}/almoco?barbeiro=${enc(barbeiroLogado)}`)
        ]);
        if (resAg.ok) { const j = await resAg.json(); agendados = j.map(a => a.horario.slice(0, 5)); }
        if (resBloc.ok) { const j = await resBloc.json(); bloqueados = j.bloqueados.map(h => h.slice(0, 5)); }
        if (resAlm.ok) {
            const alm = await resAlm.json();
            if (alm.ativo) {
                const [hIni, mIni] = (alm.hora_inicio || '12:00').slice(0, 5).split(':').map(Number);
                const [hFim, mFim] = (alm.hora_fim || '13:30').slice(0, 5).split(':').map(Number);
                const minIni = hIni * 60 + mIni;
                const minFim = hFim * 60 + mFim;
                SLOTS_BLOQUEIO.forEach(slot => {
                    const [sh, sm] = slot.split(':').map(Number);
                    const minSlot = sh * 60 + sm;
                    if (minSlot >= minIni && minSlot < minFim) slotsAlmoco.push(slot);
                });
            }
        }
    } catch (e) { }

    container.innerHTML = '';

    SLOTS_BLOQUEIO.forEach(slot => {
        const temAgendamento = agendados.includes(slot);
        const estaBloqueado = bloqueados.includes(slot);
        const ehAlmoco = slotsAlmoco.includes(slot);

        const btn = document.createElement('button');
        btn.dataset.slot = slot;
        btn.dataset.bloqueado = estaBloqueado ? '1' : '0';
        btn.dataset.almoco = ehAlmoco ? '1' : '0';

        btn.style.cssText = `
            padding:10px 6px;border-radius:8px;font-size:13px;cursor:pointer;
            font-family:'DM Sans',sans-serif;font-weight:500;transition:all .15s;
            ${temAgendamento
                ? 'background:#1a2a1a;border:1px solid #2a4a2a;color:#4caf50;cursor:not-allowed;'
                : ehAlmoco
                    ? 'background:#2a1f00;border:1px solid #d4a843;color:#d4a843;cursor:not-allowed;'
                    : estaBloqueado
                        ? 'background:#3a1010;border:1px solid #e74c3c;color:#e74c3c;'
                        : 'background:#1e1e1e;border:1px solid #333;color:#ccc;'
            }
        `;

        btn.innerHTML = `
            <div>${slot}</div>
            <div style="font-size:10px;margin-top:2px;opacity:.7;">
                ${temAgendamento ? '✓ Agendado' : ehAlmoco ? '🍽️ Almoço' : estaBloqueado ? '🔒 Bloqueado' : 'Livre'}
            </div>
        `;

        if (!temAgendamento && !ehAlmoco) {
            btn.onclick = () => toggleBloqueio(btn);
        }

        container.appendChild(btn);
    });
}

function toggleBloqueio(btn) {
    const bloqueado = btn.dataset.bloqueado === '1';
    btn.dataset.bloqueado = bloqueado ? '0' : '1';

    if (!bloqueado) {
        btn.style.background = '#3a1010';
        btn.style.borderColor = '#e74c3c';
        btn.style.color = '#e74c3c';
        btn.querySelector('div:last-child').textContent = '🔒 Bloqueado';
    } else {
        btn.style.background = '#1e1e1e';
        btn.style.borderColor = '#333';
        btn.style.color = '#ccc';
        btn.querySelector('div:last-child').textContent = 'Livre';
    }
}

async function salvarBloqueios() {
    const data = document.getElementById('bloqueio-data').value;
    const slots = document.querySelectorAll('#bloqueio-slots button[data-slot]');

    let salvos = 0;
    let erros = 0;

    for (const btn of slots) {
        const slot = btn.dataset.slot;
        const deveBloqueado = btn.dataset.bloqueado === '1';

        // Verificar estado atual no servidor
        try {
            if (deveBloqueado) {
                const res = await fetch(`${API_BASE}/admin/bloquear`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ barbeiro: barbeiroLogado, data, horario: slot + ':00' })
                });
                if (res.ok || res.status === 409) salvos++;
                else erros++;
            } else {
                await fetch(`${API_BASE}/admin/bloquear`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ barbeiro: barbeiroLogado, data, horario: slot + ':00' })
                });
                salvos++;
            }
        } catch (e) { erros++; }
    }

    fecharModalBloqueio();

    if (erros === 0) {
        mostrarToast('Bloqueios salvos com sucesso!', 'ok');
    } else {
        mostrarToast(`Salvos com ${erros} erro(s). Tente novamente.`, 'erro');
    }
}