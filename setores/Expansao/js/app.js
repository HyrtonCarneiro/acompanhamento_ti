// setores/Expansao/js/app.js
import { db, collection, getDocs, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, orderBy } from '../../../js/firebase.js';
import { lojasIniciais } from '../../../js/data.js';

let currentUser = sessionStorage.getItem('loggedUser') || null;
let obrasCache = [];
let cardAbertoId = null;
let checklistsCache = [];
let comentariosCache = [];
let anexosCache = [];
let fornecedoresCache = []; // ✅ Variável global para gerenciar os fornecedores de material no frontend
let isThemeDark = false;
let equipeExp = [];
let projetosExp = [];
let chartObrasStatusInst = null;
let chartObrasTagsInst = null;

function showToast(msg, type = 'success') {
    try {
        if (typeof Toastify !== 'undefined') {
            Toastify({
                text: msg, duration: 3000, gravity: "top", position: "right",
                style: { background: type === 'success' ? "var(--sp-pistache)" : (type === 'warning' ? "var(--sp-laranja)" : "var(--sp-red)"), borderRadius: "8px", fontFamily: "Inter" }
            }).showToast();
        } else { alert(msg); }
    } catch (e) { console.error(e); }
}
window.showToast = showToast;

window.toggleDarkMode = function () {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
} else if (localStorage.getItem('darkMode') === null && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.add('dark-mode');
    localStorage.setItem('darkMode', 'true');
}

window.logout = function () {
    sessionStorage.removeItem('loggedUser');
    sessionStorage.removeItem('userSectors');
    window.location.href = '../../index.html';
}

function initApp() {
    try {
        if (!currentUser) {
            window.location.href = '../../index.html';
            return;
        }

        const loggedUserNameEl = document.getElementById('loggedUserName');
        if (loggedUserNameEl) loggedUserNameEl.innerText = currentUser;

        // Injetar Hub button (Idêntico ao TI)
        document.querySelectorAll('.header-actions > div:first-child').forEach(container => {
            if (container.querySelector('.btn-hub')) return;
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline btn-hub';
            btn.style.padding = '6px 10px';
            btn.title = 'Escolha de Setores';
            btn.innerHTML = '<i class="ph ph-squares-four" style="font-size: 1.2rem;"></i>';
            btn.onclick = () => window.location.href = '../../index.html?hub=1';
            container.insertBefore(btn, container.querySelector('.page-title'));
        });

        window.switchView('dashboard');
        carregarKanbanExpansao();
        iniciarOuvintesTarefas();
        popularFiltroRegionaisExpansao();
        popularSelectLojasExpansao();
        configurarOuvinteTagsModal();
    } catch (e) {
        console.error("ERRO CRÍTICO NO INITAPP:", e);
        showToast("Erro ao iniciar a tela. " + e.message, "error");
    }
}

function popularFiltroRegionaisExpansao() {
    const sel = document.getElementById('filtroKanbanRegional');
    if (!sel) return;

    // Extrair regionais únicas de lojasIniciais
    const regionais = [...new Set(lojasIniciais.map(l => l.estado))].sort();

    sel.innerHTML = '<option value="">Todas as Regionais</option>';
    regionais.forEach(reg => {
        sel.innerHTML += `<option value="${reg}">${reg}</option>`;
    });
}

function configurarOuvinteTagsModal() {
    // Listener para feedback visual nas tags (highlight na seleção)
    const container = document.querySelector('.tags-container');
    if (!container) return;

    container.addEventListener('change', (e) => {
        if (e.target.name === 'modalTagExp') {
            // Tag selecionada pode ser usada para lógica futura
            console.log('Tag selecionada:', e.target.value);
        }
    });
}

function popularSelectLojasExpansao() {
    const sel = document.getElementById('modalCardLoja');
    if (!sel) return;
    sel.innerHTML = '<option value="">(Selecione a Loja)</option>';

    // Organizar por Regional e depois por Nome
    const lojasOrdenadas = [...lojasIniciais].sort((a, b) => {
        if (a.estado !== b.estado) return a.estado.localeCompare(b.estado);
        return a.nome.localeCompare(b.nome);
    });

    let currentReg = '';
    lojasOrdenadas.forEach(l => {
        if (l.estado !== currentReg) {
            currentReg = l.estado;
            // Opcionalmente adicionar um optgroup ou apenas um divisor visual
            sel.innerHTML += `<option disabled style="background: var(--border); color: #fff; font-weight: bold;">--- REGIONAL ${currentReg} ---</option>`;
        }
        sel.innerHTML += `<option value="${l.nome}">${l.nome}</option>`;
    });
}

window.switchView = function (view) {
    try {
        const views = ['dashboard', 'obras', 'tarefas', 'metapwr', 'gantt'];
        views.forEach(v => {
            const el = document.getElementById(`view-${v}`);
            if (el) el.style.display = 'none';
            const nav = document.getElementById(`nav-${v}`);
            if (nav) nav.classList.remove('active');
        });

        const currView = document.getElementById(`view-${view}`);
        const currNav = document.getElementById(`nav-${view}`);

        if (currView) currView.style.display = (view === 'obras' || view === 'tarefas' || view === 'gantt') ? 'flex' : 'block';
        if (view === 'tarefas') {
            currView.style.flexDirection = 'column';
        }
        if (currNav) currNav.classList.add('active');

        if (view === 'gantt') {
            window.renderGantt();
        }

        if (window.innerWidth <= 768) { window.toggleSidebar(); }
    } catch (e) {
        console.error("ERRO NO SWITCHVIEW:", e);
        showToast("Erro ao mudar de aba", "error");
    }
}

window.toggleSidebar = function () {
    const sidebar = document.getElementById('appSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    }
}

// ================= KANBAN EXPANSÃO ENGINE =====================
async function carregarKanbanExpansao() {
    try {
        const obrasCollection = collection(db, "obras_expansao");
        const querySnapshot = await getDocs(obrasCollection);
        obrasCache = [];
        querySnapshot.forEach((docSnap) => {
            obrasCache.push({ id: docSnap.id, ...docSnap.data() });
        });
        window.filtrarKanban();
        window.renderGantt();
        atualizarDashboard();
    } catch (error) {
        console.error("Erro ao carregar Obras: ", error);
        showToast("Erro ao carregar obras da base.", "error");
    }
}

function renderKanban(obras) {
    try {
        const columns = ['backlog', 'planejamento', 'fase1', 'fase2', 'fase3', 'concluido'];

        columns.forEach(col => {
            const colContainer = document.querySelector(`#col-${col} .kanban-cards`);
            if (colContainer) colContainer.innerHTML = '';
            const countSpan = document.getElementById(`count-${col}`);
            if (countSpan) countSpan.innerText = '0';
        });

        obras.forEach(obra => {
            const colContainer = document.querySelector(`#col-${obra.status} .kanban-cards`);
            if (colContainer) {

                let dataFim = obra.dataFim ? new Date(obra.dataFim) : null;
                let hoje = new Date();
                let isLate = dataFim && hoje > dataFim && obra.status !== 'concluido';

                let totalChecks = (obra.checklists || []).length;
                let concluidosChecks = (obra.checklists || []).filter(c => c.checked).length;
                let checkPerc = totalChecks > 0 ? Math.round((concluidosChecks / totalChecks) * 100) : 0;

                let tagClasses = '';
                if (obra.tag === 'Urgente') tagClasses = 'tag-urgente';
                if (obra.tag === 'Nova Loja') tagClasses = 'tag-novaloja';
                if (obra.tag === 'Obras') tagClasses = 'tag-obras';
                if (obra.tag === 'Manutenção') tagClasses = 'tag-manutencao';
                if (obra.tag === 'Retrofit') tagClasses = 'tag-retrofit';

                const cardHtml = `
                    <div class="kanban-card-item ${isLate ? 'late' : ''}" draggable="true" ondragstart="window.dragExpansao(event)" id="card-${obra.id}" data-id="${obra.id}" onclick="window.abrirModalCardExpansao('${obra.id}')">
                        
                        <div class="tags-container">
                            ${obra.tag ? `<span class="tag ${tagClasses}">${obra.tag}</span>` : ''}
                        </div>

                        <p class="kanban-card-loja" style="margin:0 0 5px 0; font-size:0.8rem; color:var(--text-muted);"><i class="ph ph-map-pin"></i> ${obra.loja || 'Sem Loja'}</p>
                        <h4 class="kanban-card-title">${obra.titulo || 'Sem Título'}</h4>

                        <div class="progress-container" style="margin-top:10px; margin-bottom:10px; height:6px;">
                            <div class="progress-bar" style="width: ${checkPerc}%"></div>
                        </div>

                        <div class="kanban-card-meta" style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted);">
                            <div class="meta-item ${isLate ? 'overdue' : ''}" style="${isLate ? 'color:var(--danger); font-weight:bold;' : ''}" title="${dataFim ? 'Prev: ' + obra.dataFim : 'Sem Prazo'}">
                                <i class="ph ph-clock"></i> <span>${dataFim ? dataFim.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}</span>
                            </div>
                            <div class="meta-item" title="${concluidosChecks}/${totalChecks} concluídos">
                                <i class="ph ph-check-square-offset"></i> <span>${checkPerc}%</span>
                            </div>
                            ${(obra.anexos || []).length > 0 ? `<div class="meta-item"><i class="ph ph-paperclip"></i> ${(obra.anexos || []).length}</div>` : ''}
                        </div>
                    </div>
                `;
                colContainer.insertAdjacentHTML('beforeend', cardHtml);
            }
        });

        columns.forEach(col => {
            const colContainer = document.querySelector(`#col-${col} .kanban-cards`);
            if (colContainer) {
                const countSpan = document.getElementById(`count-${col}`);
                if (countSpan) countSpan.innerText = colContainer.children.length.toString();
            }
        });
    } catch (e) { console.error("Erro na renderização visual do Kanban.", e); }
}

window.filtrarKanban = function () {
    try {
        const termoEl = document.getElementById('filtroKanbanBusca');
        const tagFiltroEl = document.getElementById('filtroKanbanTag');
        const regionalFiltroEl = document.getElementById('filtroKanbanRegional');
        if (!termoEl || !tagFiltroEl || !regionalFiltroEl) return;

        const termo = termoEl.value.toLowerCase().trim();
        const tagFiltro = tagFiltroEl.value;
        const regFiltro = regionalFiltroEl.value;

        let filtradas = obrasCache.filter(o => {
            const tituloMatch = (o.titulo || '').toLowerCase().includes(termo);
            const lojaMatch = (o.loja || '').toLowerCase().includes(termo);
            const matchTag = tagFiltro ? o.tag === tagFiltro : true;

            // Lógica para regional: precisamos achar a regional da loja no data.js
            let matchReg = true;
            if (regFiltro) {
                const lojaInfo = lojasIniciais.find(l => l.nome === o.loja);
                matchReg = lojaInfo ? lojaInfo.estado === regFiltro : false;
            }

            return (tituloMatch || lojaMatch) && matchTag && matchReg;
        });

        renderKanban(filtradas);
    } catch (e) { console.error("Erro ao Filtrar", e); }
}

// ================= ANALYTICS DASHBOARD =====================
function atualizarDashboard() {
    try {
        const totalEl = document.getElementById('statTotalObras');
        const atrasadasEl = document.getElementById('statObrasAtrasadas');

        let atrasadasCount = 0;
        let hoje = new Date();

        let statusCounts = {
            'backlog': 0, 'planejamento': 0, 'fase1': 0, 'fase2': 0, 'fase3': 0, 'concluido': 0
        };
        let tagCounts = {
            'Urgente': 0, 'Expansão': 0, 'Preventiva': 0, 'Estética': 0
        };

        obrasCache.forEach(o => {
            if (o.status && statusCounts[o.status] !== undefined) statusCounts[o.status]++;
            if (o.tag && tagCounts[o.tag] !== undefined) tagCounts[o.tag]++;

            if (o.dataFim && o.status !== 'concluido') {
                if (new Date(o.dataFim) < hoje) atrasadasCount++;
            }
        });

        if (totalEl) totalEl.innerText = obrasCache.length;
        if (atrasadasEl) atrasadasEl.innerText = atrasadasCount;

        const ctxStatus = document.getElementById('chartObrasStatus');
        if (ctxStatus && typeof Chart !== 'undefined') {
            if (chartObrasStatusInst) chartObrasStatusInst.destroy();
            chartObrasStatusInst = new Chart(ctxStatus, {
                type: 'doughnut',
                data: {
                    labels: ['Backlog', 'Pré-Obra', 'Fase 1', 'Fase 2', 'Fase 3', 'Concluído'],
                    datasets: [{
                        data: Object.values(statusCounts),
                        backgroundColor: ['#64748b', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#10b981']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
            });
        }

        const ctxTags = document.getElementById('chartObrasTags');
        if (ctxTags && typeof Chart !== 'undefined') {
            if (chartObrasTagsInst) chartObrasTagsInst.destroy();
            chartObrasTagsInst = new Chart(ctxTags, {
                type: 'bar',
                data: {
                    labels: ['Urgente', 'Expansão', 'Preventiva', 'Estética'],
                    datasets: [{
                        label: 'Obras por Tag',
                        data: Object.values(tagCounts),
                        backgroundColor: ['#ef4444', '#0ea5e9', '#84cc16', '#f97316']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
            });
        }
    } catch (e) { console.error("Erro no Dashboard:", e); }
}

// ================= TAREFAS DA EQUIPE (IGUAL TI) =====================
function iniciarOuvintesTarefas() {
    try {
        const qEquipe = query(collection(db, "equipe_expansao"));
        onSnapshot(qEquipe, (snapshot) => {
            equipeExp = [];
            snapshot.forEach(doc => equipeExp.push({ id: doc.id, ...doc.data() }));
            renderizarFiltroEquipeExp();
            renderListaMembrosExpModal();
        });

        const qProjetos = query(collection(db, "projetos_expansao"), orderBy("data", "desc"));
        onSnapshot(qProjetos, (snapshot) => {
            projetosExp = [];
            snapshot.forEach(doc => projetosExp.push({ id: doc.id, ...doc.data() }));
            renderizarProjetosExp();
        });
    } catch (e) { console.error("Erro ouvintes tarefas:", e); }
}

function renderizarFiltroEquipeExp() {
    const cont = document.getElementById('membrosEquipeContainer');
    if (!cont) return;
    cont.innerHTML = `<button class="btn ${!window.currentMemberExp ? 'btn-primary' : 'btn-outline'}" onclick="window.filtrarPorMembroExp(null)">Todos</button>`;

    equipeExp.forEach(m => {
        const isAct = window.currentMemberExp === m.nome;
        cont.innerHTML += `<button class="btn ${isAct ? 'btn-primary' : 'btn-outline'}" onclick="window.filtrarPorMembroExp('${m.nome}')">${m.nome}</button>`;
    });
}

window.filtrarPorMembroExp = function (nome) {
    window.currentMemberExp = nome;
    renderizarFiltroEquipeExp();
    renderizarProjetosExp();
}

function renderizarProjetosExp() {
    const cont = document.getElementById('projetos-list');
    if (!cont) return;

    let html = '';
    const cols = ['Pendente', 'Em Andamento', 'Concluído'];

    cols.forEach(col => {
        const projs = projetosExp.filter(p => p.status === col && (!window.currentMemberExp || p.demandante === window.currentMemberExp));

        let cardsHtml = projs.map(p => `
            <div class="card-loja" style="padding: 15px; margin-bottom: 10px; cursor:default;">
                <h4 style="margin:0 0 8px 0; color:var(--text-main); font-size:0.95rem;">${p.descricao}</h4>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:8px;">
                    <i class="ph ph-user"></i> ${p.demandante} | <i class="ph ph-calendar"></i> ${p.dataOriginal ? new Date(p.dataOriginal).toLocaleDateString() : '-'}
                </div>
                ${p.anexo ? `<a href="${p.anexo}" target="_blank" style="font-size:0.8rem; color:var(--primary); display:block; margin-bottom:10px;"><i class="ph ph-link"></i> Ver Documento</a>` : ''}
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <select onchange="window.atualizarStatusProjExp('${p.id}', this.value)" style="padding:4px; border-radius:4px; border:1px solid var(--border); background:var(--bg-color); color:var(--text-main); font-size:0.8rem;">
                        <option value="Pendente" ${p.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                        <option value="Em Andamento" ${p.status === 'Em Andamento' ? 'selected' : ''}>Andamento</option>
                        <option value="Concluído" ${p.status === 'Concluído' ? 'selected' : ''}>Concluído</option>
                    </select>
                    <button class="btn btn-danger" style="padding:4px 8px; font-size:0.8rem;" onclick="window.deletarProjetoExp('${p.id}')"><i class="ph ph-trash"></i></button>
                </div>
            </div>
        `).join('');

        html += `
            <div class="kanban-col" style="flex:1;">
                <div class="kanban-col-header">
                    <h3>${col}</h3>
                    <span class="kanban-col-count" style="background:var(--bg-color); color:var(--text-main); padding:2px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">${projs.length}</span>
                </div>
                <div class="kanban-cards">
                    ${cardsHtml}
                </div>
            </div>
        `;
    });
    cont.innerHTML = html;
}

window.salvarProjeto = async function () {
    const desc = document.getElementById('projDesc').value.trim();
    const demand = document.getElementById('projDemand').value.trim();
    const date = document.getElementById('projDate').value;
    const stat = document.getElementById('projStatus').value;
    const anexo = document.getElementById('projAnexo').value.trim();

    if (!desc || !demand) return showToast("Preencha descrição e demandante", "warning");

    try {
        await addDoc(collection(db, "projetos_expansao"), {
            descricao: desc, demandante: demand, dataOriginal: date || new Date().toISOString(), status: stat, anexo: anexo, data: new Date().toISOString()
        });
        showToast("Tarefa registrada!", "success");
        document.getElementById('projDesc').value = '';
        document.getElementById('projAnexo').value = '';
    } catch (e) { console.error(e); showToast("Erro ao salvar", "error"); }
}

window.atualizarStatusProjExp = async function (id, novoStatus) {
    try {
        await updateDoc(doc(db, "projetos_expansao", id), { status: novoStatus });
    } catch (e) { console.error(e); showToast("Erro atualizar", "error"); }
}

window.deletarProjetoExp = async function (id) {
    if (confirm("Excluir esta tarefa?")) {
        try { await deleteDoc(doc(db, "projetos_expansao", id)); showToast("Excluído", "success"); }
        catch (e) { console.error(e); }
    }
}

// ==== Modal Equipe ====
window.abrirModalEquipeExp = function () {
    const modal = document.getElementById('modalEquipeObj');
    if (!modal) return;
    modal.classList.add('show');
    renderListaMembrosExpModal();
}
window.fecharModalEquipeExp = function () {
    const modal = document.getElementById('modalEquipeObj');
    if (modal) {
        modal.classList.remove('show');
    }
}
function renderListaMembrosExpModal() {
    const list = document.getElementById('listaMembrosExp');
    if (!list) return;
    list.innerHTML = equipeExp.map(m => `
        <li style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid var(--border);">
            <span style="color:var(--text-main);">${m.nome}</span>
            <button class="btn btn-danger" style="padding:4px 8px;" onclick="window.removerMembroExp('${m.id}')"><i class="ph ph-trash"></i></button>
        </li>
    `).join('');
}
window.addMembroEquipeExp = async function () {
    const nome = document.getElementById('novoMembroExp').value.trim();
    if (!nome) return;
    try {
        await addDoc(collection(db, "equipe_expansao"), { nome });
        document.getElementById('novoMembroExp').value = '';
        showToast("Membro adicionado", "success");
    } catch (e) { console.error(e); }
}
window.removerMembroExp = async function (id) {
    try {
        await deleteDoc(doc(db, "equipe_expansao", id));
        showToast("Membro removido", "success");
    } catch (e) { console.error(e); }
}

// ================= MODAL MANAGER OBRAS =====================
window.abrirModalCardExpansao = function (id = null) {
    try {
        cardAbertoId = id;
        const modal = document.getElementById('modalCardExpansaoObj');
        if (!modal) return;

        // Limpar tudo
        document.getElementById('modalCardId').value = '';
        if (document.getElementById('modalCardTituloInput')) document.getElementById('modalCardTituloInput').value = '';
        document.getElementById('modalCardLoja').value = '';
        document.getElementById('modalCardStatus').value = 'backlog';

        if (document.querySelector('input[name="modalTagExp"][value="Retrofit"]')) {
            document.querySelector('input[name="modalTagExp"][value="Retrofit"]').checked = true;
        }
        document.getElementById('modalDataInicio').value = '';
        document.getElementById('modalDataFim').value = '';
        document.getElementById('modalCustoPrev').value = '';
        document.getElementById('modalCustoReal').value = '';
        if (document.getElementById('modalNovoAnexoURL')) document.getElementById('modalNovoAnexoURL').value = '';
        if (document.getElementById('novoChecklistItemInput')) document.getElementById('novoChecklistItemInput').value = '';
        if (document.getElementById('novoComentarioCard')) document.getElementById('novoComentarioCard').value = '';

        // Limpar Stakeholders
        if (document.getElementById('modalCardEngenheiro')) document.getElementById('modalCardEngenheiro').value = '';
        if (document.getElementById('modalCardMestre')) document.getElementById('modalCardMestre').value = '';
        if (document.getElementById('novoFornNomeInput')) document.getElementById('novoFornNomeInput').value = '';
        if (document.getElementById('novoFornContatoInput')) document.getElementById('novoFornContatoInput').value = '';

        document.getElementById('displayCardId').textContent = 'Novo Workflow';
        document.getElementById('displayCardCriador').textContent = window.currentUser || 'Sistema';
        if (document.getElementById('modalChecklistPercent')) document.getElementById('modalChecklistPercent').textContent = '0%';
        if (document.getElementById('modalChecklistProgress')) document.getElementById('modalChecklistProgress').style.width = '0%';

        checklistsCache = [];
        comentariosCache = [];
        anexosCache = [];
        fornecedoresCache = [];

        renderChecklists();
        renderComentarios();
        renderAnexos();
        renderFornecedores(); // Iniciar UI dos fornecedores limpa

        document.getElementById('btnExcluirCardExpansao').style.display = 'none';

        if (id) {
            const obra = obrasCache.find(o => o.id === id);
            if (obra) {
                document.getElementById('modalCardId').value = obra.id;
                document.getElementById('displayCardId').textContent = obra.id.substring(0, 8).toUpperCase();
                document.getElementById('displayCardCriador').textContent = obra.autor || 'Sistema';

                if (document.getElementById('modalCardTituloInput')) document.getElementById('modalCardTituloInput').value = obra.titulo;
                document.getElementById('modalCardLoja').value = obra.loja;

                document.getElementById('modalCardStatus').value = obra.status;

                const radioTag = document.querySelector(`input[name="modalTagExp"][value="${obra.tag || 'Retrofit'}"]`);
                if (radioTag) radioTag.checked = true;

                document.getElementById('modalDataInicio').value = obra.dataInicio || '';
                document.getElementById('modalDataFim').value = obra.dataFim || '';
                document.getElementById('modalCustoPrev').value = obra.custoPrev || '';
                document.getElementById('modalCustoReal').value = obra.custoReal || '';

                // Carregar Stakeholders
                if (document.getElementById('modalCardEngenheiro')) document.getElementById('modalCardEngenheiro').value = obra.engenheiro || '';
                if (document.getElementById('modalCardMestre')) document.getElementById('modalCardMestre').value = obra.mestreObras || '';

                checklistsCache = obra.checklists || [];
                comentariosCache = obra.comentarios || [];
                anexosCache = obra.anexos || [];
                fornecedoresCache = obra.fornecedores || [];

                renderChecklists();
                renderComentarios();
                renderAnexos();
                renderFornecedores();

                document.getElementById('btnExcluirCardExpansao').style.display = 'inline-block';
            }
        }

        modal.classList.add('show');
    } catch (e) { console.error("Erro abrir modal: ", e); }
}

window.fecharModalCardExpansao = function () {
    const modal = document.getElementById('modalCardExpansaoObj');
    if (modal) modal.classList.remove('show');
    cardAbertoId = null;
}

window.salvarCardExpansao = async function () {
    try {
        const id = document.getElementById('modalCardId').value;
        const tituloEl = document.getElementById('modalCardTituloInput');
        const lojaEl = document.getElementById('modalCardLoja');
        const statusEl = document.getElementById('modalCardStatus');
        const radioSelected = document.querySelector('input[name="modalTagExp"]:checked');

        if (!tituloEl || !lojaEl || !statusEl) {
            throw new Error("Elementos básicos do modal não encontrados (HTML corrompido)");
        }

        const titulo = tituloEl.value.trim();
        const loja = lojaEl.value;
        const status = statusEl.value;
        const tag = radioSelected ? radioSelected.value : 'Retrofit';

        const dataInicio = document.getElementById('modalDataInicio')?.value || '';
        const dataFim = document.getElementById('modalDataFim')?.value || '';
        const custoPrev = document.getElementById('modalCustoPrev')?.value || '';
        const custoReal = document.getElementById('modalCustoReal')?.value || '';

        // Capturar Stakeholders
        const engenheiro = document.getElementById('modalCardEngenheiro')?.value.trim() || '';
        const mestreObras = document.getElementById('modalCardMestre')?.value.trim() || '';

        if (!titulo) {
            showToast("O título da obra é obrigatório", "warning");
            return;
        }
        if (!loja) {
            showToast("Selecione uma loja para esta obra", "warning");
            return;
        }

        const obrasCollection = collection(db, "obras_expansao");

        const payload = {
            titulo, loja, status, tag, dataInicio, dataFim, custoPrev, custoReal,
            engenheiro, mestreObras,
            checklists: checklistsCache,
            comentarios: comentariosCache,
            anexos: anexosCache,
            fornecedores: fornecedoresCache
        };

        if (id) {
            await updateDoc(doc(db, "obras_expansao", id), payload);
            showToast("Obra atualizada", "success");
        } else {
            payload.comentarios = [{
                texto: "Obra criada no sistema.", dataHora: new Date().toLocaleString('pt-BR'), autor: currentUser
            }];
            await addDoc(obrasCollection, payload);
            showToast("Obra criada", "success");
        }
        window.fecharModalCardExpansao();
        carregarKanbanExpansao();
    } catch (e) {
        console.error(e);
        showToast("Erro ao salvar", "error");
    }
}

window.excluirObra = async function () {
    if (!cardAbertoId) return;
    if (confirm("Tem certeza que deseja excluir esta obra permanentemente?")) {
        try {
            await deleteDoc(doc(db, "obras_expansao", cardAbertoId));
            showToast("Obra excluída", "success");
            window.fecharModalCardExpansao();
            carregarKanbanExpansao();
        } catch (e) {
            console.error(e);
            showToast("Erro ao excluir obra", "error");
        }
    }
}

// ================== FUNÇÕES DE FORNECEDORES ================== //
window.renderFornecedores = function () {
    const list = document.getElementById('modalFornecedoresContainer');
    if (!list) return;
    list.innerHTML = "";

    if (fornecedoresCache.length === 0) {
        list.innerHTML = `<span style="display:block; font-size: 0.8rem; color: var(--text-muted); text-align: center; font-style: italic; padding: 10px 0;">Nenhum fornecedor cadastrado</span>`;
        return;
    }

    fornecedoresCache.forEach((f, index) => {
        const div = document.createElement('div');
        div.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: var(--surface); padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;";

        div.innerHTML = `
            <div style="display: flex; flex-direction: column; flex: 1; overflow: hidden; padding-right: 10px;">
                <span style="font-weight: 600; font-size: 0.85rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${f.nome}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${f.contato}</span>
            </div>
            <button class="btn btn-outline" style="padding: 4px; border-radius: 4px; border: none; color: var(--danger);" onclick="window.removerFornecedor(${index})">
                <i class="ph ph-trash"></i>
            </button>
        `;
        list.appendChild(div);
    });
}

window.addFornecedorCard = function () {
    const inputNome = document.getElementById('novoFornNomeInput');
    const inputContato = document.getElementById('novoFornContatoInput');

    if (!inputNome || !inputContato) return;

    const nome = inputNome.value.trim();
    const contato = inputContato.value.trim();

    if (!nome) {
        showToast("Insira o nome do fornecedor/empresa", "warning");
        return;
    }

    fornecedoresCache.push({ nome, contato });
    inputNome.value = '';
    inputContato.value = '';
    renderFornecedores();
}

window.removerFornecedor = function (index) {
    if (confirm("Remover este fornecedor?")) {
        fornecedoresCache.splice(index, 1);
        renderFornecedores();
    }
}

// ================= GANTT CHART ENGINE =====================
window.renderGantt = function () {
    const wrapper = document.getElementById('gantt-wrapper');
    if (!wrapper) return;

    // Filtrar obras que tem data fim ou status pendente
    const obrasTimeline = obrasCache.filter(o => o.dataInicio || o.dataFim);

    // Configuração de datas
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Vamos desenhar a timeline de 1 mês atrás até 3 meses na frente gerando de Hoje
    const startDate = new Date(hoje);
    startDate.setMonth(startDate.getMonth() - 1);
    startDate.setDate(1); // dia 1 do mes passado

    const endDate = new Date(hoje);
    endDate.setMonth(endDate.getMonth() + 3);
    endDate.setDate(0); // ultimo dia do mes daqui a 3 meses

    const ONE_DAY = 1000 * 60 * 60 * 24;
    const totalVisDays = Math.round((endDate - startDate) / ONE_DAY) + 1;
    const DAY_WIDTH = 30; // 30px por dia

    // MONTAR CABEÇALHOS (Meses e Dias)
    let monthsHtml = '';
    let daysHtml = '';

    let currentHtmlDate = new Date(startDate);
    let currentMonth = currentHtmlDate.getMonth();
    let daysInMonth = 0;

    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    for (let i = 0; i < totalVisDays; i++) {
        const d = new Date(startDate.getTime() + (i * ONE_DAY));
        const dayOfWeek = d.getDay();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

        daysHtml += `<div class="gantt-day ${isWeekend ? 'weekend' : ''}">${d.getDate()}</div>`;
        daysInMonth++;

        const nextDay = new Date(d.getTime() + ONE_DAY);
        if (nextDay.getMonth() !== currentMonth || i === totalVisDays - 1) {
            monthsHtml += `<div class="gantt-month" style="min-width: ${daysInMonth * DAY_WIDTH}px">${monthNames[currentMonth]} ${d.getFullYear()}</div>`;
            currentMonth = nextDay.getMonth();
            daysInMonth = 0;
        }
    }

    // MONTAR LINHAS DE OBRAS
    let rowsHtml = '';

    // Ordenar por loja
    const obrasOrd = [...obrasTimeline].sort((a, b) => (a.loja || '').localeCompare(b.loja || ''));

    obrasOrd.forEach(obra => {
        let dInicio = obra.dataInicio ? new Date(obra.dataInicio) : null;
        let dFim = obra.dataFim ? new Date(obra.dataFim) : null;

        if (dInicio) dInicio.setHours(0, 0, 0, 0);
        else dInicio = dFim ? new Date(dFim.getTime() - (7 * ONE_DAY)) : null; // Se nao tem inicio, assume 7 dias antes do fim

        if (dFim) dFim.setHours(0, 0, 0, 0);
        else dFim = dInicio ? new Date(dInicio.getTime() + (7 * ONE_DAY)) : null;

        if (!dInicio || !dFim) return; // Se mesmo assim for null

        // Calcular posição X e Largura
        const startOffsetDays = Math.round((dInicio - startDate) / ONE_DAY);
        const durationDays = Math.round((dFim - dInicio) / ONE_DAY) + 1; // +1 para incluir o proprio dia

        const leftPx = startOffsetDays * DAY_WIDTH;
        const widthPx = durationDays * DAY_WIDTH;

        // Logica de cor
        const isCompleted = obra.status === 'concluido';
        const isDelayed = !isCompleted && dFim < hoje;
        let barClass = '';
        if (isCompleted) barClass = 'completed';
        else if (isDelayed) barClass = 'delayed';

        // Formatar Nome da fase para ficar bonitinho
        const mapFases = { 'backlog': 'Triagem', 'planejamento': 'Pré-Obra', 'fase1': 'Mobilização', 'fase2': 'Instalações', 'fase3': 'Acabamento', 'concluido': 'Concluído' };
        const faseNome = mapFases[obra.status] || obra.status;

        rowsHtml += `
            <div class="gantt-row">
                <div class="gantt-label">
                    <h4 title="${obra.titulo}">${obra.titulo}</h4>
                    <span>${obra.loja} • ${faseNome}</span>
                </div>
                <!-- Area Timeline da Linha -->
                <div class="gantt-timeline" style="width: ${totalVisDays * DAY_WIDTH}px; min-width: ${totalVisDays * DAY_WIDTH}px">
                    <div class="gantt-bar ${barClass}" 
                         style="left: ${leftPx}px; width: ${widthPx}px" 
                         title="${obra.titulo}\nInício: ${obra.dataInicio}\nFim: ${obra.dataFim}\nStatus: ${faseNome}" 
                         onclick="window.abrirModalCardExpansao('${obra.id}')">
                        ${obra.titulo}
                    </div>
                </div>
            </div>
        `;
    });

    // Posicionar Linha do Dia de Hoje
    const hojeOffsetDays = Math.round((hoje - startDate) / ONE_DAY);
    const hojeLinePx = hojeOffsetDays * DAY_WIDTH + (DAY_WIDTH / 2); // Meio do dia

    wrapper.innerHTML = `
        <div class="gantt-header-row" style="z-index: 11;">
            <div class="gantt-label" style="background:var(--bg-color); border-bottom: none; z-index:12; height: 100%;"></div>
            <div id="gantt-header-scroll" style="display:flex; flex-direction:column; overflow:hidden; flex: 1; min-width: 0;">
                <div style="display:flex; width: ${totalVisDays * DAY_WIDTH}px">${monthsHtml}</div>
                <div class="gantt-days-row" style="width: ${totalVisDays * DAY_WIDTH}px">
                    ${daysHtml}
                </div>
            </div>
        </div>
        <div class="gantt-body" id="gantt-body-scroll" style="min-width: 0;" onscroll="document.getElementById('gantt-header-scroll').scrollLeft = this.scrollLeft">
            <div style="display: flex; min-width: ${(totalVisDays * DAY_WIDTH) + 250}px">
                <div style="width: 250px; flex-shrink: 0; z-index: 10; background: var(--surface);">
                </div>
            </div>
        </div>
    `;



    // Vamos reconstruir o Body de uma forma mais resiliente para o sticky
    let finalBodyHtml = `<div style="min-width: ${(totalVisDays * DAY_WIDTH) + 250}px; position:relative;">`;
    finalBodyHtml += rowsHtml;
    finalBodyHtml += `<div class="gantt-today-line" style="left: ${hojeLinePx + 250}px;" title="Hoje"></div></div>`;

    wrapper.querySelector('.gantt-body').innerHTML = finalBodyHtml;

    // Scrollar automaticamente para a linha de Hoje (menos uns pixels pra ver o passado)
    setTimeout(() => {
        const body = document.getElementById('gantt-body-scroll');
        if (body && hojeOffsetDays > 0) {
            // Rola X mantendo uns 10 dias do passado a mostra
            body.scrollLeft = Math.max(0, (hojeOffsetDays - 10) * DAY_WIDTH);
        }
    }, 100);

}

function renderChecklists() {
    try {
        const cont = document.getElementById('modalChecklistItensContainer');
        if (!cont) return;
        cont.innerHTML = '';

        let concluidos = 0;

        checklistsCache.forEach((item, index) => {
            if (item.checked) concluidos++;

            cont.insertAdjacentHTML('beforeend', `
                <div class="checklist-item ${item.checked ? 'checked' : ''}">
                    <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="window.toggleChecklist(${index})">
                    <span class="checklist-item-text">${item.texto}</span>
                    <button class="checklist-item-delete" onclick="window.removerChecklist(${index})"><i class="ph-bold ph-x"></i></button>
                </div>
            `);
        });

        const perc = checklistsCache.length > 0 ? Math.round((concluidos / checklistsCache.length) * 100) : 0;
        const progBar = document.getElementById('modalChecklistProgress');
        if (progBar) progBar.style.width = `${perc}%`;
        const percText = document.getElementById('modalChecklistPercent');
        if (percText) percText.textContent = `${perc}%`;
    } catch (e) { console.error(e); }
}

window.addChecklistItemCard = function () {
    const ipt = document.getElementById('novoChecklistItemInput');
    if (!ipt) return;
    const txt = ipt.value.trim();
    if (txt) {
        checklistsCache.push({ texto: txt, checked: false });
        ipt.value = '';
        renderChecklists();
    }
}
window.toggleChecklist = function (idx) {
    if (checklistsCache[idx]) {
        checklistsCache[idx].checked = !checklistsCache[idx].checked;
        renderChecklists();
    }
}
window.removerChecklist = function (idx) {
    if (checklistsCache[idx]) {
        checklistsCache.splice(idx, 1);
        renderChecklists();
    }
}

function renderComentarios() {
    try {
        const cont = document.getElementById('modalComentariosContainer');
        if (!cont) return;
        cont.innerHTML = '';
        const reversed = [...comentariosCache].reverse();
        reversed.forEach(c => {
            cont.insertAdjacentHTML('beforeend', `
                <div style="background: var(--surface); padding: 10px; border-radius: 6px; border-left: 3px solid var(--sp-laranja); font-size: 0.85rem;">
                    <div style="font-weight: bold; color: var(--primary); display: flex; justify-content: space-between;">
                        ${c.autor || 'Usuário'} <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: normal;">${c.dataHora}</span>
                    </div>
                    <div style="color: var(--text-main); margin-top: 4px;">${c.texto}</div>
                </div>
            `);
        });
    } catch (e) { console.error(e); }
}
window.addComentarioCardExpansao = function () {
    const ipt = document.getElementById('novoComentarioCard');
    if (!ipt) return;
    const txt = ipt.value.trim();
    if (txt) {
        comentariosCache.push({
            texto: txt,
            autor: currentUser,
            dataHora: new Date().toLocaleString('pt-BR')
        });
        ipt.value = '';
        renderComentarios();
    }
}

function renderAnexos() {
    try {
        const cont = document.getElementById('modalAnexosContainer');
        if (!cont) return;
        cont.innerHTML = '';
        anexosCache.forEach((url, i) => {
            cont.insertAdjacentHTML('beforeend', `
                <li style="margin-bottom: 5px; display: flex; justify-content: space-between;">
                    <a href="${url}" target="_blank" style="color: var(--sp-aoleite); text-decoration: none; word-wrap: break-word; max-width: 90%;">Anexo ${i + 1} - Acessar Link</a>
                    <i class="ph ph-trash" style="cursor: pointer; color: var(--danger);" onclick="window.removerAnexo(${i})"></i>
                </li>
            `);
        });
    } catch (e) { console.error(e); }
}
window.addAnexoCard = function () {
    const ipt = document.getElementById('modalNovoAnexoURL');
    if (!ipt) return;
    if (ipt.value.trim()) {
        anexosCache.push(ipt.value.trim());
        ipt.value = '';
        renderAnexos();
    }
}
window.removerAnexo = function (i) {
    if (anexosCache[i] !== undefined) {
        anexosCache.splice(i, 1);
        renderAnexos();
    }
}

window.allowDropExpansao = function (ev) {
    ev.preventDefault();
}

window.dragExpansao = function (ev) {
    ev.dataTransfer.setData("card_id", ev.target.dataset.id);
}

window.dropExpansao = async function (ev) {
    ev.preventDefault();
    try {
        const dataId = ev.dataTransfer.getData("card_id");
        let targetCol = ev.target.closest('.kanban-col');
        if (!targetCol) return;

        let novaColId = targetCol.id.replace('col-', '');
        const cols = ['backlog', 'planejamento', 'fase1', 'fase2', 'fase3', 'concluido'];
        if (!cols.includes(novaColId)) return;

        const obraRef = obrasCache.find(o => o.id === dataId);
        if (obraRef && obraRef.status !== novaColId) {
            let msgTroca = `Moveu a obra do status '${obraRef.status}' para '${novaColId}'`;
            let coments = obraRef.comentarios || [];
            coments.push({ texto: msgTroca, autor: currentUser, dataHora: new Date().toLocaleString('pt-BR') });

            // Update UI optimistically
            obraRef.status = novaColId;
            obraRef.comentarios = coments;
            window.filtrarKanban();
            atualizarDashboard();

            await updateDoc(doc(db, "obras_expansao", dataId), {
                status: novaColId,
                comentarios: coments
            });
        }
    } catch (e) { console.error("Erro no drag and drop", e); }
}

if (currentUser) {
    initApp();
}
