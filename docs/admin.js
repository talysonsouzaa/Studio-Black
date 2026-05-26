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

// Todos os slots possíveis do dia
const TODOS_SLOTS = [];
for (let h = 9; h < 18; h++) {
    TODOS_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
    TODOS_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}
// Garantir que vai até 17:30
const SLOTS_DIA = TODOS_SLOTS.filter(s => s <= '17:30');

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
    carregarAgendaHoje();
    carregarHistorico();
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