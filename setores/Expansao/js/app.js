// setores/Expansao/js/app.js

import { db, collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from '../../../js/firebase-config.js';

let currentUser = sessionStorage.getItem('loggedUser') || null;
const obrasCollection = collection(db, "obras_expansao");
let obrasCache = [];
let cardAbertoId = null;
let checklistsCache = [];
let comentariosCache = [];
let anexosCache = [];

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

function initApp() {
    if (!currentUser) {
        window.location.href = '../../index.html';
        return;
    }

    document.getElementById('loggedUserName').innerText = currentUser;

    // Injetar Hub button
    document.querySelectorAll('.header-actions').forEach(container => {
        if (container.querySelector('.btn-hub')) return;
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline btn-hub';
        btn.style.padding = '6px 10px';
        btn.title = 'Voltar para o Hub de Setores';
        btn.innerHTML = '<i class="ph ph-squares-four" style="font-size: 1.2rem;"></i>';
        btn.onclick = () => window.location.href = '../../index.html?hub=1';

        const titleSpan = container.querySelector('.page-title');
        const divWrapper = document.createElement('div');
        divWrapper.style.display = 'flex';
        divWrapper.style.alignItems = 'center';
        divWrapper.style.gap = '10px';

        container.insertBefore(divWrapper, titleSpan);
        divWrapper.appendChild(btn);
        divWrapper.appendChild(titleSpan);

        const mobileBtn = document.querySelector('.btn-menu-toggle');
        if (mobileBtn) { divWrapper.insertBefore(mobileBtn, btn); }
    });

    window.switchView('dashboard');
    carregarKanbanExpansao();
}

window.switchView = function (view) {
    const views = ['dashboard', 'tarefas', 'metapwr'];
    views.forEach(v => {
        const el = document.getElementById('view-' + v);
        const nav = document.getElementById('nav-' + v);
        if (el) el.style.display = 'none';
        if (nav) nav.classList.remove('active');
    });

    const currView = document.getElementById(`view-${view}`);
    const currNav = document.getElementById(`nav-${view}`);

    if (currView) currView.style.display = 'block';
    if (currNav) currNav.classList.add('active');

    if (window.innerWidth <= 768) { window.toggleSidebar(); }
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
        const querySnapshot = await getDocs(obrasCollection);
        obrasCache = [];
        querySnapshot.forEach((docSnap) => {
            obrasCache.push({ id: docSnap.id, ...docSnap.data() });
        });
        window.filtrarKanban();
    } catch (error) {
        console.error("Erro ao carregar Obras: ", error);
        window.showToast("Erro ao carregar Kanban", "error");
    }
}

function renderKanban(obras) {
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

            // Logica de atraso e checklist
            let dataFim = new Date(obra.dataFim);
            let hoje = new Date();
            let hasDate = obra.dataFim && obra.dataFim !== "";
            let isLate = hasDate && hoje > dataFim && obra.status !== 'concluido';

            let totalChecks = (obra.checklists || []).length;
            let concluidosChecks = (obra.checklists || []).filter(c => c.checked).length;
            let checkPerc = totalChecks > 0 ? Math.round((concluidosChecks / totalChecks) * 100) : 0;

            let totalCustos = obra.custoPrev ? `R$ ${obra.custoPrev}` : '--';

            let tagClasses = '';
            if (obra.tag === 'Urgente') tagClasses = 'tag-urgente';
            if (obra.tag === 'Expansão') tagClasses = 'tag-expansao';
            if (obra.tag === 'Preventiva') tagClasses = 'tag-preventiva';
            if (obra.tag === 'Estética') tagClasses = 'tag-estetica';

            const cardHtml = `
                <div class="kanban-card-item ${isLate ? 'late' : ''}" draggable="true" ondragstart="drag(event)" id="card-${obra.id}" data-id="${obra.id}" onclick="window.abrirModalCardExpansao('${obra.id}')">
                    
                    <div class="tags-container">
                        ${obra.tag ? `<span class="tag ${tagClasses}">${obra.tag}</span>` : ''}
                    </div>

                    <p class="kanban-card-loja"><i class="ph ph-map-pin"></i> ${obra.loja}</p>
                    <h4 class="kanban-card-title">${obra.titulo}</h4>

                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${checkPerc}%"></div>
                    </div>

                    <div class="kanban-card-meta">
                        <div class="meta-item ${isLate ? 'overdue' : ''}" title="${hasDate ? 'Prev: ' + obra.dataFim : 'Sem Prazo'}">
                            <i class="ph ph-clock"></i> <span>${hasDate ? new Date(obra.dataFim).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}</span>
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
            const count = colContainer.children.length;
            const countSpan = document.getElementById(`count-${col}`);
            if (countSpan) countSpan.innerText = count.toString();
        }
    });
}

window.filtrarKanban = function () {
    const termo = document.getElementById('filtroKanbanBusca').value.toLowerCase().trim();
    const tagFiltro = document.getElementById('filtroKanbanTag').value;

    let filtradas = obrasCache.filter(o => {
        const matchTermo = o.titulo.toLowerCase().includes(termo) || o.loja.toLowerCase().includes(termo);
        const matchTag = tagFiltro ? o.tag === tagFiltro : true;
        return matchTermo && matchTag;
    });

    renderKanban(filtradas);
}

// ================= MODAL MANAGER =====================

window.abrirModalCardExpansao = function (id = null) {
    cardAbertoId = id;
    const modal = document.getElementById('modalCardExpansaoObj');

    // Limpar modal
    document.getElementById('modalCardId').value = '';
    document.getElementById('modalCardTitulo').innerText = 'Nova Obra/Manutenção';
    document.getElementById('modalCardLoja').value = '';
    document.getElementById('modalCardStatus').value = 'backlog';
    document.querySelector('input[name="modalTagExp"][value="Estética"]').checked = true;
    document.getElementById('modalDataInicio').value = '';
    document.getElementById('modalDataFim').value = '';
    document.getElementById('modalCustoPrev').value = '';
    document.getElementById('modalCustoReal').value = '';

    checklistsCache = [];
    comentariosCache = [];
    anexosCache = [];
    renderChecklists();
    renderComentarios();
    renderAnexos();

    document.getElementById('btnExcluirCardExpansao').style.display = 'none';

    if (id) {
        const obra = obrasCache.find(o => o.id === id);
        if (obra) {
            document.getElementById('modalCardId').value = obra.id;
            document.getElementById('modalCardTitulo').innerText = obra.titulo;
            document.getElementById('modalCardLoja').value = obra.loja;
            document.getElementById('modalCardStatus').value = obra.status;

            const radioTag = document.querySelector(`input[name="modalTagExp"][value="${obra.tag}"]`);
            if (radioTag) radioTag.checked = true;

            document.getElementById('modalDataInicio').value = obra.dataInicio || '';
            document.getElementById('modalDataFim').value = obra.dataFim || '';
            document.getElementById('modalCustoPrev').value = obra.custoPrev || '';
            document.getElementById('modalCustoReal').value = obra.custoReal || '';

            checklistsCache = obra.checklists || [];
            comentariosCache = obra.comentarios || [];
            anexosCache = obra.anexos || [];

            renderChecklists();
            renderComentarios();
            renderAnexos();

            document.getElementById('btnExcluirCardExpansao').style.display = 'inline-block';
        }
    } else {
        // Se for NOVO job, pedir titulo
        setTimeout(() => {
            const novoTitulo = prompt("Digite o Título da nova Obra/Manutenção:");
            if (novoTitulo) {
                document.getElementById('modalCardTitulo').innerText = novoTitulo;
            } else {
                return; // cancelou
            }
        }, 100);
    }

    modal.classList.add('active');
}

window.fecharModalCardExpansao = function () {
    document.getElementById('modalCardExpansaoObj').classList.remove('active');
    cardAbertoId = null;
}

window.salvarCardExpansao = async function () {
    const id = document.getElementById('modalCardId').value;
    const titulo = document.getElementById('modalCardTitulo').innerText;
    const loja = document.getElementById('modalCardLoja').value;
    const status = document.getElementById('modalCardStatus').value;
    const tag = document.querySelector('input[name="modalTagExp"]:checked').value;

    const dataInicio = document.getElementById('modalDataInicio').value;
    const dataFim = document.getElementById('modalDataFim').value;
    const custoPrev = document.getElementById('modalCustoPrev').value;
    const custoReal = document.getElementById('modalCustoReal').value;

    if (!titulo || !loja) {
        window.showToast("Preencha Título e Loja", "warning");
        return;
    }

    const payload = {
        titulo, loja, status, tag, dataInicio, dataFim, custoPrev, custoReal,
        checklists: checklistsCache,
        comentarios: comentariosCache,
        anexos: anexosCache
    };

    try {
        if (id) {
            await updateDoc(doc(db, "obras_expansao", id), payload);
            window.showToast("Obra atualizada", "success");
        } else {
            // Push primeira msg historico
            payload.comentarios = [{
                texto: "Obra criada no sistema.", dataHora: new Date().toLocaleString('pt-BR'), autor: currentUser
            }];
            await addDoc(obrasCollection, payload);
            window.showToast("Obra criada com sucesso", "success");
        }
        window.fecharModalCardExpansao();
        carregarKanbanExpansao();
    } catch (e) {
        console.error(e);
        window.showToast("Erro ao salvar", "error");
    }
}

window.excluirObra = async function () {
    if (!cardAbertoId) return;
    if (confirm("Tem certeza que deseja excluir esta obra e todo seu histórico permanentemente?")) {
        try {
            await deleteDoc(doc(db, "obras_expansao", cardAbertoId));
            window.showToast("Obra excluída.", "success");
            window.fecharModalCardExpansao();
            carregarKanbanExpansao();
        } catch (e) { console.error(e); }
    }
}

// ==== CHECKLISTS ====
function renderChecklists() {
    const cont = document.getElementById('modalChecklistItensContainer');
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
    document.getElementById('modalChecklistProgress').style.width = `${perc}%`;
}

window.addChecklistItemCard = function () {
    const ipt = document.getElementById('novoChecklistItemInput');
    const txt = ipt.value.trim();
    if (txt) {
        checklistsCache.push({ texto: txt, checked: false });
        ipt.value = '';
        renderChecklists();
    }
}
window.toggleChecklist = function (idx) {
    checklistsCache[idx].checked = !checklistsCache[idx].checked;
    renderChecklists();
}
window.removerChecklist = function (idx) {
    checklistsCache.splice(idx, 1);
    renderChecklists();
}

// ==== COMENTÁRIOS / DIÁRIO ====
function renderComentarios() {
    const cont = document.getElementById('modalComentariosContainer');
    cont.innerHTML = '';

    // Reverse para mais novo em cima
    const reversed = [...comentariosCache].reverse();

    reversed.forEach(c => {
        cont.insertAdjacentHTML('beforeend', `
            <div style="background: var(--surface); padding: 10px; border-radius: 6px; border-left: 3px solid var(--sp-laranja); font-size: 0.85rem;">
                <div style="font-weight: bold; color: var(--primary); display: flex; justify-content: space-between;">
                    ${c.autor} <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: normal;">${c.dataHora}</span>
                </div>
                <div style="color: var(--text-main); margin-top: 4px;">${c.texto}</div>
            </div>
        `);
    });
}
window.addComentarioCardExpansao = function () {
    const ipt = document.getElementById('novoComentarioCard');
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

// ==== ANEXOS ====
function renderAnexos() {
    const cont = document.getElementById('modalAnexosContainer');
    cont.innerHTML = '';
    anexosCache.forEach((url, i) => {
        cont.insertAdjacentHTML('beforeend', `
            <li style="margin-bottom: 5px; display: flex; justify-content: space-between;">
                <a href="${url}" target="_blank" style="color: var(--sp-aoleite); text-decoration: none;">Link Anexo ${i + 1}</a>
                <i class="ph ph-trash" style="cursor: pointer; color: var(--danger);" onclick="window.removerAnexo(${i})"></i>
            </li>
        `);
    });
}
window.addAnexoCard = function () {
    const ipt = document.getElementById('modalNovoAnexoURL');
    if (ipt.value.trim()) {
        anexosCache.push(ipt.value.trim());
        ipt.value = '';
        renderAnexos();
    }
}
window.removerAnexo = function (i) {
    anexosCache.splice(i, 1);
    renderAnexos();
}

// ================= DRAG AND DROP =====================
window.allowDrop = function (ev) {
    ev.preventDefault();
}

window.drag = function (ev) {
    ev.dataTransfer.setData("card_id", ev.target.dataset.id);
}

window.drop = async function (ev) {
    ev.preventDefault();
    const dataId = ev.dataTransfer.getData("card_id");

    // Find closest col container
    let targetCol = ev.target.closest('.kanban-col');
    if (!targetCol) return;

    let novaColId = targetCol.id.replace('col-', '');

    // Valid columns guard
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

        // Update Backend
        try {
            await updateDoc(doc(db, "obras_expansao", dataId), {
                status: novaColId,
                comentarios: coments
            });
        } catch (e) {
            console.error("Falha ao mover", e);
            window.showToast("Falha ao sincronizar drag-drop", "error");
        }
    }
}


// --- Toast Simples ---
window.showToast = function (message, type = 'success') {
    if (typeof Toastify !== 'undefined') {
        Toastify({
            text: message,
            duration: 3000,
            close: true,
            gravity: "top",
            position: "right",
            style: {
                background: type === 'success' ? "var(--sp-pistache)" : (type === 'warning' ? "var(--sp-laranja)" : "var(--sp-red)"),
                color: "#fff",
                borderRadius: "8px",
                fontFamily: "Inter, sans-serif"
            }
        }).showToast();
    } else {
        alert(message);
    }
}

if (currentUser) {
    initApp();
}
