// js/ti-main.js
import { db, collection, addDoc, getDocs, updateDoc, doc, deleteDoc, onSnapshot, query, where, orderBy } from '../../../js/firebase.js';
import { lojasIniciais, appConfig } from '../../../js/data.js';

let currentUser = sessionStorage.getItem('loggedUser') || null;
let authMode = 'login';
let lojaAtualId = null;
let currentMember = 'Hyrton';
let chartInstSetor = null;
let chartInstStatus = null;
let chartInstRegiao = null;

let sysLogs = {};
let sysProjetos = {};
let sysAtas = [];
let membrosEquipe = [];

function showToast(msg, type = 'success') {
    Toastify({
        text: msg, duration: 3000, gravity: "bottom", position: "right",
        style: { background: type === 'success' ? "var(--success)" : "var(--danger)", borderRadius: "6px", fontFamily: "Inter" }
    }).showToast();
}

window.toggleDarkMode = function () {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
    if (chartInstStatus) atualizarGraficos();
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
    if (!currentUser) {
        window.location.href = '../../index.html';
        return;
    }

    let sectors = [];
    try {
        sectors = JSON.parse(sessionStorage.getItem('userSectors')) || [];
    } catch (e) {
        sectors = [];
    }

    if (!sectors.includes("TI") && currentUser !== 'admin') {
        window.location.href = '../../index.html';
        return;
    }

    document.getElementById('loggedUserName').innerText = currentUser;

    // Injetar botão do Hub dinamicamente nos header-actions
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

    iniciarOuvintesFirestore();
    window.switchView('analytics');
}

function iniciarOuvintesFirestore() {
    const qLogs = query(collection(db, "logs"), orderBy("timestamp", "desc"));
    onSnapshot(qLogs, (snapshot) => {
        sysLogs = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            data.firebaseId = doc.id;
            if (!sysLogs[data.lojaId]) sysLogs[data.lojaId] = [];
            sysLogs[data.lojaId].push(data);
        });
        window.renderizarLojas();
        atualizarGraficos();
        if (lojaAtualId !== null) renderizarComentarios(sysLogs[lojaAtualId] || []);
    });

    const qProjetos = query(collection(db, "projetos"), orderBy("timestamp", "desc"));
    onSnapshot(qProjetos, (snapshot) => {
        sysProjetos = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            data.firebaseId = doc.id;
            if (!sysProjetos[data.membroResponsavel]) {
                sysProjetos[data.membroResponsavel] = [];
            }
            sysProjetos[data.membroResponsavel].push(data);
        });
        renderizarProjetosList();
    });

    const qEquipe = query(collection(db, "equipe"), orderBy("nome"));
    onSnapshot(qEquipe, (snapshot) => {
        membrosEquipe = [];
        snapshot.forEach(doc => membrosEquipe.push({ firebaseId: doc.id, ...doc.data() }));
        if (membrosEquipe.length > 0 && (!currentMember || !membrosEquipe.find(m => m.nome === currentMember))) {
            currentMember = membrosEquipe[0].nome;
        }
        renderizarBotoesEquipe();
        renderizarProjetosList();
        renderizarListaEquipeGerenciar();
    });

    const qAtas = query(collection(db, "atas"), orderBy("timestamp", "desc"));
    onSnapshot(qAtas, (snapshot) => {
        sysAtas = [];
        snapshot.forEach(doc => sysAtas.push({ firebaseId: doc.id, ...doc.data() }));
        renderizarAtas();
    });
}

window.switchView = function (view) {
    document.getElementById('view-analytics').style.display = 'none';
    document.getElementById('view-lojas').style.display = 'none';
    document.getElementById('view-projetos').style.display = 'none';
    const va = document.getElementById('view-atas'); if (va) va.style.display = 'none';
    const vb = document.getElementById('view-bi'); if (vb) vb.style.display = 'none';
    const vp = document.getElementById('view-metapwr'); if (vp) vp.style.display = 'none';

    document.getElementById('nav-analytics').classList.remove('active');
    document.getElementById('nav-lojas').classList.remove('active');
    document.getElementById('nav-projetos').classList.remove('active');
    const na = document.getElementById('nav-atas'); if (na) na.classList.remove('active');
    const nb = document.getElementById('nav-bi'); if (nb) nb.classList.remove('active');
    const np = document.getElementById('nav-metapwr'); if (np) np.classList.remove('active');

    document.getElementById(`view-${view}`).style.display = 'block';
    document.getElementById(`nav-${view}`).classList.add('active');

    if (window.innerWidth <= 768) {
        window.toggleSidebar();
    }

    if (view === 'analytics') atualizarGraficos();
    if (view === 'lojas') window.renderizarLojas();
    if (view === 'projetos') window.switchMember('Hyrton');
    if (view === 'atas') renderizarAtas();
}

window.toggleSidebar = function () {
    const sidebar = document.getElementById('appSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    }
}

function criarCardLojaHTML(loja, logs) {
    const pendentes = logs.filter(l => !l.resolvido);
    const temPendente = pendentes.length > 0;
    const statusClass = logs.length > 0 ? (temPendente ? 'status-pendente' : 'status-resolvido') : '';
    const card = document.createElement('div');
    card.className = `card-loja ${statusClass}`;
    card.onclick = () => abrirModal(loja.id, loja.nome, loja.estado);

    let preview = `<div class="log-preview"><div class="empty-state" style="padding:10px;"><i class="ph ph-check-circle" style="font-size:1.5rem; margin:0;"></i><p style="margin:5px 0 0; font-size:0.8rem;">Sistema operando normalmente</p></div></div>`;

    if (logs.length > 0) {
        let logsExibidos = temPendente ? pendentes : [logs[0]];
        let logsHtml = '';

        logsExibidos.forEach((logItem, index) => {
            const iconStatus = logItem.resolvido ? '<i class="ph-fill ph-check-circle" style="color:var(--success)"></i>' : '<i class="ph-fill ph-warning-circle" style="color:var(--danger)"></i>';
            const marginStyle = index < logsExibidos.length - 1 ? 'margin-bottom: 10px; border-bottom: 1px solid var(--border); padding-bottom: 10px;' : '';
            logsHtml += `
                <div style="${marginStyle}">
                    <div class="log-meta">
                        <span>${iconStatus} ${logItem.dataStr}</span>
                        <span><i class="ph ph-user"></i> ${logItem.autor}</span>
                    </div>
                    <div class="log-text">${logItem.texto}</div>
                    <span class="badge badge-tag" style="margin-top:8px; display:inline-block;">${logItem.tag || 'Geral'}</span>
                </div>`;
        });

        preview = `
            <div class="log-preview" style="max-height: 200px; overflow-y: auto;">
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 8px; font-weight: bold; padding-bottom: 4px; border-bottom: 1px solid var(--border);">
                    ${temPendente ? (pendentes.length + ' ocorrência(s) pendente(s)') : 'Última ocorrência:'}
                </div>
                ${logsHtml}
            </div>`;
    }

    card.innerHTML = `
        <div class="card-header">
            <h3 class="card-title">${loja.nome}</h3>
            <span class="badge">${loja.estado}</span>
        </div>
        ${preview}
    `;
    return card;
}

window.renderizarLojas = function () {
    const container = document.getElementById('lojas-container');
    if (!container) return;

    const filterStatus = document.getElementById('statusFilter').value;
    const filterTag = document.getElementById('tagFilter') ? document.getElementById('tagFilter').value : 'todas';
    const filterSetor = document.getElementById('setorFilter') ? document.getElementById('setorFilter').value : 'todos';
    const sortOrder = document.getElementById('sortOrder').value;
    const search = document.getElementById('searchInput').value.toLowerCase();

    container.innerHTML = '';

    let lojasProcessadas = [];
    lojasIniciais.forEach(loja => {
        if (!loja.nome.toLowerCase().includes(search) && !loja.estado.toLowerCase().includes(search)) return;

        let logs = sysLogs[loja.id] || [];

        if (filterTag !== 'todas') logs = logs.filter(l => (l.tag || 'Geral') === filterTag || (filterTag === 'Geral' && !l.tag));
        if (filterSetor !== 'todos') logs = logs.filter(l => (l.setor || '') === filterSetor);

        if ((filterTag !== 'todas' || filterSetor !== 'todos') && logs.length === 0) return;

        const pendentes = logs.filter(l => !l.resolvido);
        if (filterStatus === 'pendente' && pendentes.length === 0) return;
        if (filterStatus === 'resolvido' && (logs.length === 0 || pendentes.length > 0)) return;

        lojasProcessadas.push({ loja, logs });
    });

    if (lojasProcessadas.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="ph ph-magnifying-glass"></i><h2>Nenhum resultado encontrado</h2></div>`;
        return;
    }

    if (sortOrder === 'estado-az') {
        const estadosUnicos = [...new Set(lojasProcessadas.map(lp => lp.loja.estado))].sort();
        estadosUnicos.forEach(est => {
            const section = document.createElement('div');
            section.innerHTML = `<h2 class="section-title">Regional ${est}</h2>`;
            const grid = document.createElement('div');
            grid.className = 'grid-lojas';

            lojasProcessadas.filter(lp => lp.loja.estado === est)
                .sort((a, b) => a.loja.nome.localeCompare(b.loja.nome))
                .forEach(lp => grid.appendChild(criarCardLojaHTML(lp.loja, lp.logs)));

            section.appendChild(grid);
            container.appendChild(section);
        });
    } else {
        const grid = document.createElement('div');
        grid.className = 'grid-lojas';

        if (sortOrder === 'recentes') {
            lojasProcessadas.sort((a, b) => {
                const timeA = a.logs.length > 0 ? a.logs[0].timestamp : 0;
                const timeB = b.logs.length > 0 ? b.logs[0].timestamp : 0;
                return timeB - timeA;
            });
        } else if (sortOrder === 'pendentes-topo') {
            lojasProcessadas.sort((a, b) => {
                const pendentesA = a.logs.filter(l => !l.resolvido).length > 0 ? 1 : 0;
                const pendentesB = b.logs.filter(l => !l.resolvido).length > 0 ? 1 : 0;
                if (pendentesA !== pendentesB) return pendentesB - pendentesA;
                return a.loja.nome.localeCompare(b.loja.nome);
            });
        } else {
            lojasProcessadas.sort((a, b) => a.loja.nome.localeCompare(b.loja.nome));
        }

        lojasProcessadas.forEach(lp => grid.appendChild(criarCardLojaHTML(lp.loja, lp.logs)));
        container.appendChild(grid);
    }
}

function abrirModal(id, nome, estado) {
    lojaAtualId = id;
    document.getElementById('modalTitle').innerText = nome;
    document.getElementById('modalEstado').innerText = estado;
    document.getElementById('modalLoja').classList.add('show');
    renderizarComentarios(sysLogs[lojaAtualId] || []);
}

window.fecharModal = function () {
    document.getElementById('modalLoja').classList.remove('show');
    lojaAtualId = null;
}

window.salvarComentario = async function () {
    const texto = document.getElementById('novoComentario').value;
    const tag = document.getElementById('tagComentario').value;
    const setor = document.getElementById('setorComentario').value;
    const inputAnexo = document.getElementById('anexoComentario');
    const anexoUrl = inputAnexo ? inputAnexo.value.trim() : null;
    if (!texto.trim()) return showToast("A descrição é obrigatória", "error");

    const dStr = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    try {
        await addDoc(collection(db, "logs"), {
            lojaId: lojaAtualId,
            dataStr: dStr,
            texto: texto,
            tag: tag,
            setor: setor,
            anexoUrl: anexoUrl || null,
            resolvido: false,
            autor: currentUser,
            timestamp: Date.now()
        });
        document.getElementById('novoComentario').value = '';
        document.getElementById('setorComentario').value = '';
        if (inputAnexo) inputAnexo.value = '';
        showToast("Ocorrência registrada");
    } catch (e) {
        console.error(e);
        showToast("Erro ao registrar no servidor", "error");
    }
}

window.resolverComentario = async function (firebaseId) {
    try {
        const dataResolucao = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        await updateDoc(doc(db, "logs", firebaseId), {
            resolvido: true,
            autorResolucao: currentUser,
            dataResolucao: dataResolucao
        });
        showToast("Ocorrência marcada como resolvida");
    } catch (e) {
        console.error(e);
        showToast("Erro ao atualizar registro", "error");
    }
}

window.deletarComentario = async function (firebaseId) {
    if (!confirm("Tem certeza que deseja apagar este registro?")) return;
    try {
        await deleteDoc(doc(db, "logs", firebaseId));
        showToast("Registro removido");
    } catch (e) {
        console.error(e);
        showToast("Erro ao apagar registro", "error");
    }
}

function renderizarComentarios(hist) {
    const container = document.getElementById('listaComentarios');
    if (!container) return;

    container.innerHTML = '';

    if (hist.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">Nenhum histórico.</p>';
        return;
    }

    hist.forEach(c => {
        const div = document.createElement('div');
        div.className = `comment-item ${c.resolvido ? 'resolvido' : 'pendente'}`;

        let htmlButtons = '';
        htmlButtons += `<button class="btn btn-outline" style="margin-right: 8px;" onclick="window.abrirModalEditLog('${c.firebaseId}')"><i class="ph ph-pencil"></i> Editar</button>`;
        htmlButtons += `<button class="btn btn-danger" onclick="window.deletarComentario('${c.firebaseId}')"><i class="ph ph-trash"></i> Apagar</button>`;

        let resolveSection = '';
        if (!c.resolvido) {
            resolveSection = `<button class="btn btn-primary" onclick="window.resolverComentario('${c.firebaseId}')"><i class="ph ph-check"></i> Resolver</button>`;
        } else {
            resolveSection = `<span style="color: var(--success); font-weight: 500; font-size: 0.85rem;"><i class="ph-fill ph-check-circle"></i> Resolvido por ${c.autorResolucao} em ${c.dataResolucao}</span>`;
        }

        const setorBadge = c.setor ? `<span class="badge" style="background: var(--surface); border: 1px solid var(--border); margin-left: 5px;">📍 ${c.setor}</span>` : '';

        let anexoHtml = '';
        if (c.anexoUrl) {
            const isImg = c.anexoUrl.match(/\.(jpeg|jpg|gif|png|webp|bmp)(\?.*)?$/i);
            if (isImg) {
                anexoHtml = `<div style="margin-top: 10px;"><a href="${c.anexoUrl}" target="_blank"><img src="${c.anexoUrl}" style="max-width: 100%; max-height: 200px; border-radius: 4px; border: 1px solid var(--border);"></a></div>`;
            } else {
                anexoHtml = `<div style="margin-top: 10px;"><a href="${c.anexoUrl}" target="_blank" class="badge" style="background:#e2e8f0; color:#0f172a; text-decoration:none; display:inline-flex; align-items:center; gap:5px;"><i class="ph ph-link"></i> Ver Link/Anexo</a></div>`;
            }
        }

        div.innerHTML = `
            <div class="comment-meta">
                <span><strong><i class="ph ph-user"></i> ${c.autor}</strong> em ${c.dataStr}</span>
                <div>
                    <span class="badge badge-tag">${c.tag || 'Geral'}</span>
                    ${setorBadge}
                </div>
            </div>
            <div style="line-height: 1.5; margin: 10px 0;">${c.texto}${anexoHtml}</div>
            <div class="comment-actions">
                ${resolveSection}
                <div>${htmlButtons}</div>
            </div>
        `;
        container.appendChild(div);
    });
}

function escapeCSV(text) {
    if (text == null) return "N/A";
    const str = String(text);
    if (str.search(/("|,|\n)/g) >= 0) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

window.exportarCSV = function () {
    let csvContent = "\uFEFFID_Loja,Nome_Loja,Estado,Data_Criacao,Autor,Tag,Setor,Status,Autor_Resolucao,Data_Resolucao,Descricao\n";
    lojasIniciais.forEach(loja => {
        const hist = sysLogs[loja.id] || [];
        hist.forEach(l => {
            const status = l.resolvido ? "Resolvido" : "Pendente";
            const row = [
                loja.id, loja.nome, loja.estado, l.dataStr, l.autor,
                l.tag || 'Geral', l.setor || 'N/A', status,
                l.autorResolucao || "N/A", l.dataResolucao || "N/A",
                l.texto || ""
            ].map(escapeCSV).join(",");
            csvContent += row + "\n";
        });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const encodedUri = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_ti_chamados_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Download de chamados iniciado");
}

window.exportarProjetosCSV = function () {
    let csvContent = "\uFEFFResponsavel,Data_Atividade,Status,Descricao,Demandante,Registrado_Por\n";

    Object.keys(sysProjetos).forEach(membro => {
        const projetos = sysProjetos[membro] || [];
        projetos.forEach(p => {
            const row = [
                membro, p.dataAtv, p.status || 'Pendente',
                p.desc || "", p.demandante || "", p.autor || ""
            ].map(escapeCSV).join(",");
            csvContent += row + "\n";
        });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const encodedUri = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_ti_projetos_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Download de tarefas iniciado");
}

function atualizarGraficos() {
    let pendentes = 0; let resolvidos = 0;
    let lojasPendentes = 0; let lojasResolvidas = 0;
    let regiaoCount = {};

    lojasIniciais.forEach(loja => {
        if (!regiaoCount[loja.estado]) regiaoCount[loja.estado] = 0;
        const lgs = sysLogs[loja.id] || [];

        let temPendenteNaLoja = false;
        if (lgs.length > 0) {
            regiaoCount[loja.estado] += lgs.length;
            lgs.forEach(l => {
                if (!l.resolvido) {
                    pendentes++;
                    temPendenteNaLoja = true;
                } else {
                    resolvidos++;
                }
            });

            if (temPendenteNaLoja) lojasPendentes++;
            else lojasResolvidas++;
        }
    });

    const elTotal = document.getElementById('statTotalLojas');
    const elPendentes = document.getElementById('statPendentes');
    if (elTotal) elTotal.innerText = lojasIniciais.length;
    if (elPendentes) elPendentes.innerText = pendentes;

    const textColor = document.body.classList.contains('dark-mode') ? '#f8fafc' : '#0f172a';
    const elChartStatus = document.getElementById('chartStatus');
    const elChartRegionais = document.getElementById('chartRegionais');

    if (elChartStatus) {
        if (chartInstStatus) chartInstStatus.destroy();
        chartInstStatus = new Chart(elChartStatus, {
            type: 'doughnut',
            data: {
                labels: ['Lojas com Pendências', 'Lojas 100% Resolvidas'],
                datasets: [{ data: [lojasPendentes, lojasResolvidas], backgroundColor: ['#ef4444', '#10b981'] }]
            },
            options: { plugins: { title: { display: true, text: 'Status Atual das Lojas', color: textColor }, legend: { labels: { color: textColor } } } }
        });
    }

    if (elChartRegionais) {
        if (chartInstRegiao) chartInstRegiao.destroy();

        // Extrai as chaves (Estados) e as valores, garantindo ordem alfabética
        const orderedStates = Object.keys(regiaoCount).sort((a, b) => a.localeCompare(b));
        const orderedValues = orderedStates.map(k => regiaoCount[k]);

        chartInstRegiao = new Chart(elChartRegionais, {
            type: 'bar',
            data: {
                labels: orderedStates,
                datasets: [{ label: 'Total de Ocorrências', data: orderedValues, backgroundColor: '#3b82f6' }]
            },
            options: {
                plugins: {
                    title: { display: true, text: 'Volume de Chamados por Estado', color: textColor },
                    legend: { labels: { color: textColor } }
                },
                scales: {
                    x: { ticks: { color: textColor } },
                    y: {
                        ticks: {
                            color: textColor,
                            stepSize: 1,
                            precision: 0
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

window.switchMember = function (name) {
    currentMember = name;
    renderizarBotoesEquipe();
    renderizarProjetosList();
}

function renderizarBotoesEquipe() {
    const container = document.getElementById('membrosEquipeContainer');
    if (!container) return;
    container.innerHTML = '';
    membrosEquipe.forEach(m => {
        const btn = document.createElement('button');
        btn.className = m.nome === currentMember ? 'btn btn-primary' : 'btn btn-outline';
        btn.innerText = m.nome;
        btn.onclick = () => window.switchMember(m.nome);
        container.appendChild(btn);
    });
}

window.salvarProjeto = async function () {
    if (!currentMember) return showToast("Selecione ou crie um membro da equipe antes", "error");
    const desc = document.getElementById('projDesc').value;
    const dem = document.getElementById('projDemand').value;
    const dt = document.getElementById('projDate').value;
    const status = document.getElementById('projStatus').value;
    const fileInput = document.getElementById('projAnexo');

    if (!desc || !dem || !dt) return showToast("Preencha os dados do projeto", "error");
    const [y, m, d] = dt.split('-');

    let anexoUrl = fileInput ? fileInput.value.trim() : null;

    try {
        await addDoc(collection(db, "projetos"), {
            membroResponsavel: currentMember,
            dataAtv: `${d}/${m}/${y}`,
            desc: desc,
            demandante: dem,
            status: status,
            anexoUrl: anexoUrl,
            autor: currentUser,
            timestamp: Date.now()
        });
        document.getElementById('projDesc').value = '';
        document.getElementById('projDemand').value = '';
        document.getElementById('projStatus').value = 'Pendente';
        if (fileInput) fileInput.value = '';
        showToast("Tarefa registrada");
    } catch (e) {
        console.error(e);
        showToast("Erro ao registrar tarefa", "error");
    }
}

window.deletarProjeto = async function (firebaseId) {
    if (!confirm("Remover este registro?")) return;
    try {
        await deleteDoc(doc(db, "projetos", firebaseId));
        showToast("Tarefa removida");
    } catch (e) {
        console.error(e);
        showToast("Erro ao remover tarefa", "error");
    }
}

function renderizarProjetosList() {
    const container = document.getElementById('projetos-list');
    if (!container) return;

    const projs = sysProjetos[currentMember] || [];
    container.innerHTML = '';

    if (projs.length === 0) return container.innerHTML = `<div class="empty-state" style="width: 100%;"><i class="ph ph-kanban"></i><h2>Nenhum registro para ${currentMember || 'esta equipe'}</h2></div>`;

    const colunas = [
        { id: 'Pendente', titulo: 'Pendentes', classBadge: 'status-badge-pendente' },
        { id: 'Em Andamento', titulo: 'Em Andamento', classBadge: 'status-badge-andamento' },
        { id: 'Concluído', titulo: 'Concluídos', classBadge: 'status-badge-concluido' }
    ];

    colunas.forEach(col => {
        const projsNestaColuna = projs.filter(p => (p.status || 'Pendente') === col.id);

        const colDiv = document.createElement('div');
        colDiv.className = 'kanban-col';
        colDiv.innerHTML = `
            <div class="kanban-col-header">
                <h3>${col.titulo}</h3>
                <span class="kanban-col-count">${projsNestaColuna.length}</span>
            </div>
            <div class="kanban-items"></div>
        `;
        const itemsContainer = colDiv.querySelector('.kanban-items');

        projsNestaColuna.forEach(p => {
            const div = document.createElement('div');
            div.className = 'comment-item';
            div.style.marginBottom = '12px';
            div.style.borderLeftColor = 'transparent';

            let actionBtns = '';
            actionBtns += `<button class="btn btn-outline" style="padding: 6px; margin-right: 5px;" onclick="window.abrirModalEditProj('${p.firebaseId}')"><i class="ph ph-pencil"></i></button>`;
            actionBtns += `<button class="btn btn-danger" style="padding: 6px;" onclick="window.deletarProjeto('${p.firebaseId}')"><i class="ph ph-trash"></i></button>`;

            let urlBadge = '';
            if (p.anexoUrl) {
                const isImg = p.anexoUrl.match(/\.(jpeg|jpg|gif|png|webp|bmp)(\?.*)?$/i);
                if (isImg) {
                    urlBadge = `<a href="${p.anexoUrl}" target="_blank"><img src="${p.anexoUrl}" style="max-height: 40px; border-radius: 4px; border: 1px solid var(--border); vertical-align: middle;"></a>`;
                } else {
                    urlBadge = `<a href="${p.anexoUrl}" target="_blank" class="badge" style="background:#e2e8f0; color:#0f172a; text-decoration:none;"><i class="ph ph-link"></i> Ver Link</a>`;
                }
            }

            div.innerHTML = `
                <div class="comment-meta">
                    <span class="badge ${col.classBadge}"><i class="ph ph-calendar"></i> ${p.dataAtv}</span>
                    <div>${actionBtns}</div>
                </div>
                <h4 style="margin: 10px 0; font-size: 0.95rem; font-weight: 600; line-height: 1.4; word-break: break-word;">${p.desc}</h4>
                <div style="color: var(--text-muted); font-size: 0.8rem; border-top: 1px solid var(--border); padding-top: 8px; margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <span>Dmd: <strong>${p.demandante}</strong></span>
                    ${urlBadge}
                </div>
            `;
            itemsContainer.appendChild(div);
        });

        container.appendChild(colDiv);
    });
}

// ====== LÓGICA DE EDIÇÃO: CHAMADOS ======
window.abrirModalEditLog = function (firebaseId) {
    const log = (sysLogs[lojaAtualId] || []).find(l => l.firebaseId === firebaseId);
    if (!log) return;

    document.getElementById('editLogId').value = firebaseId;
    document.getElementById('editLogTexto').value = log.texto;
    document.getElementById('editLogTag').value = log.tag || 'Hardware';
    document.getElementById('editLogSetor').value = log.setor || '';

    document.getElementById('modalEditLog').classList.add('show');
}

window.fecharModalEditLog = function () {
    document.getElementById('modalEditLog').classList.remove('show');
}

window.confirmarEdicaoLog = async function () {
    const id = document.getElementById('editLogId').value;
    const texto = document.getElementById('editLogTexto').value;
    const tag = document.getElementById('editLogTag').value;
    const setor = document.getElementById('editLogSetor').value;

    if (!texto.trim()) return showToast("A descrição é obrigatória", "error");

    try {
        await updateDoc(doc(db, "logs", id), { texto, tag, setor });
        window.fecharModalEditLog();
        showToast("Chamado atualizado com sucesso!");
    } catch (e) {
        console.error(e);
        showToast("Erro ao atualizar chamado", "error");
    }
}

// ====== LÓGICA DE EDIÇÃO E STATUS: TAREFAS/PROJETOS ======
window.abrirModalEditProj = function (firebaseId) {
    const p = sysProjetos[currentMember].find(x => x.firebaseId === firebaseId);
    if (!p) return;
    document.getElementById('editProjId').value = p.firebaseId;
    document.getElementById('editProjDesc').value = p.desc;
    document.getElementById('editProjDemand').value = p.demandante;
    const [d, m, y] = p.dataAtv.split('/');
    document.getElementById('editProjDate').value = `${y}-${m}-${d}`;
    document.getElementById('editProjStatus').value = p.status;

    // Popula dropdown de membros
    const mbSelect = document.getElementById('editProjMember');
    mbSelect.innerHTML = membrosEquipe.map(mb => `<option value="${mb.nome}">${mb.nome}</option>`).join('');
    mbSelect.value = p.membroResponsavel;

    document.getElementById('modalEditProj').classList.add('show');
}

window.fecharModalEditProj = function () {
    document.getElementById('modalEditProj').classList.remove('show');
}

window.confirmarEdicaoProj = async function () {
    const id = document.getElementById('editProjId').value;
    const desc = document.getElementById('editProjDesc').value;
    const dem = document.getElementById('editProjDemand').value;
    const dt = document.getElementById('editProjDate').value;
    const status = document.getElementById('editProjStatus').value;
    const newMember = document.getElementById('editProjMember').value;

    if (!desc || !dem || !dt || !newMember) return showToast("Preencha todos os campos da tarefa", "error");
    const [y, m, d] = dt.split('-');

    try {
        await updateDoc(doc(db, "projetos", id), {
            desc: desc,
            demandante: dem,
            dataAtv: `${d}/${m}/${y}`,
            status: status,
            membroResponsavel: newMember
        });
        window.fecharModalEditProj();
        showToast("Tarefa atualizada com sucesso!");
    } catch (e) {
        console.error(e);
        showToast("Erro ao atualizar tarefa", "error");
    }
}

// ====== LÓGICA DA EQUIPE ======
window.abrirModalEquipe = function () {
    document.getElementById('modalEquipe').classList.add('show');
}

window.fecharModalEquipe = function () {
    document.getElementById('modalEquipe').classList.remove('show');
}

window.adicionarMembro = async function () {
    const nome = document.getElementById('novoMembroNome').value.trim();
    if (!nome) return showToast("Digite um nome", "error");

    if (membrosEquipe.find(m => m.nome.toLowerCase() === nome.toLowerCase())) {
        return showToast("Membro já existe", "error");
    }

    try {
        await addDoc(collection(db, "equipe"), { nome });
        document.getElementById('novoMembroNome').value = '';
        showToast("Membro adicionado!");
    } catch (e) {
        console.error(e);
        showToast("Erro ao adicionar", "error");
    }
}

window.removerMembro = async function (idMembro, nomeMembro) {
    if (!confirm(`Excluir ${nomeMembro} da equipe? (Suas tarefas não sumirão fisicamente, mas a guia de visão com este nome desaparecerá).`)) return;
    try {
        await deleteDoc(doc(db, "equipe", idMembro));
        if (currentMember === nomeMembro) currentMember = null;
        showToast("Membro removido.");
    } catch (e) {
        console.error(e);
        showToast("Erro ao remover", "error");
    }
}

function renderizarListaEquipeGerenciar() {
    const container = document.getElementById('listaEquipeGerenciar');
    if (!container) return;
    container.innerHTML = '';
    membrosEquipe.forEach(m => {
        const div = document.createElement('div');
        div.style = "display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--border);";
        div.innerHTML = `
            <span>${m.nome}</span>
            <button class="btn btn-danger" style="padding: 5px 10px;" onclick="window.removerMembro('${m.firebaseId}', '${m.nome}')">
                <i class="ph ph-trash"></i>
            </button>
        `;
        container.appendChild(div);
    });
}

if (currentUser) initApp();

document.addEventListener("DOMContentLoaded", () => {
    const elDev = document.getElementById('devNameDisplay');
    const elVer = document.getElementById('appVersionDisplay');
    if (elDev) elDev.innerText = appConfig.desenvolvedor;
    if (elVer) elVer.innerText = appConfig.versao;
});

// ====== LÓGICA DE ATAS DE REUNIÃO ======
window.salvarAta = async function () {
    const titulo = document.getElementById('ataTitulo').value.trim();
    const texto = document.getElementById('ataTexto').value.trim();
    if (!titulo || !texto) return showToast("Preencha o título e o texto da ata", "error");

    const dStr = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    try {
        await addDoc(collection(db, "atas"), {
            titulo: titulo,
            texto: texto,
            autor: currentUser,
            dataStr: dStr,
            timestamp: Date.now()
        });
        document.getElementById('ataTitulo').value = '';
        document.getElementById('ataTexto').value = '';
        showToast("Ata salva com sucesso!");
    } catch (e) {
        console.error(e);
        showToast("Erro ao registrar ata", "error");
    }
}

window.deletarAta = async function (id) {
    if (!confirm("Atenção: Tem certeza que deseja excluir esta Ata permanentemente?")) return;
    try {
        await deleteDoc(doc(db, "atas", id));
        showToast("Ata apagada.");
    } catch (e) {
        console.error(e);
        showToast("Erro ao apagar", "error");
    }
}

function renderizarAtas() {
    const container = document.getElementById('listaAtasContainer');
    if (!container) return;

    container.innerHTML = '';

    if (sysAtas.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="ph ph-file-dashed"></i><p>Nenhuma ata registrada ainda.</p></div>';
        return;
    }

    sysAtas.forEach(a => {
        const div = document.createElement('div');
        div.className = 'card-loja';
        div.style.marginBottom = '20px';
        div.style.padding = '20px';
        div.style.cursor = 'default';

        let header = `
            <div style="display: flex; justify-content: space-between; align-items:flex-start; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 12px;">
                <div>
                    <h3 style="margin: 0 0 5px 0; font-size: 1.1rem; color: var(--text-main);">${a.titulo}</h3>
                    <div style="font-size: 0.8rem; color: var(--text-muted);"><i class="ph ph-calendar"></i> Registrado em ${a.dataStr} por <strong>${a.autor}</strong></div>
                </div>
                <div>
                    <button class="btn btn-danger" style="padding: 6px 10px; font-size: 0.8rem;" onclick="window.deletarAta('${a.firebaseId}')"><i class="ph ph-trash"></i> Excluir</button>
                </div>
            </div>
            <div style="white-space: pre-wrap; font-size: 0.95rem; color: var(--text-main); line-height: 1.6;">${a.texto}</div>
        `;

        div.innerHTML = header;
        container.appendChild(div);
    });
}


