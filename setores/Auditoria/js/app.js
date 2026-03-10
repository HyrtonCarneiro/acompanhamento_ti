// js/app.js da Auditoria
import { db, collection, getDocs, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, orderBy, where } from '../../../js/firebase.js';
import { lojasIniciais } from '../../../js/data.js';

let currentUser = sessionStorage.getItem('loggedUser') || null;
let scatterChartInst = null;

// Caches de Auditoria
let notasCache = [];
let planejamentoCache = [];
let planejamentoAbertoId = null;
let planejamentoSortCol = 'loja';
let planejamentoSortAsc = true;
let chartMediaRegionalInst = null;
let chartRankingLojasInst = null;

// Caches de Tarefas/Equipe Auditoria
let audiProjetos = {};
let audiEquipe = [];
let audiCurrentMember = null;

window.toggleDarkMode = function () {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
    if (scatterChartInst) renderizarGrafico(); // Atualiza cores
}

if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
} else if (localStorage.getItem('darkMode') === null && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.add('dark-mode');
    localStorage.setItem('darkMode', 'true');
}

window.logout = function () {
    window.location.href = '../../index.html';
}


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

function initApp() {
    if (!currentUser) {
        window.location.href = '../../index.html';
        return;
    }

    document.getElementById('loggedUserName').innerText = currentUser;

    // Popular Lojas no Select de Auditoria Online — Agrupado por Regional em ordem alfabética
    const selectLoja = document.getElementById('audiSelectLoja');
    if (selectLoja) {
        selectLoja.innerHTML = '<option value="">Selecione a Loja...</option>';
        // Agrupar por estado (regional)
        const porEstado = {};
        lojasIniciais.forEach(loja => {
            if (!porEstado[loja.estado]) porEstado[loja.estado] = [];
            porEstado[loja.estado].push(loja.nome);
        });
        // Ordenar as regionais e os nomes dentro de cada uma
        const estadosOrdenados = Object.keys(porEstado).sort();
        estadosOrdenados.forEach(estado => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = `Regional ${estado}`;
            porEstado[estado].sort().forEach(nome => {
                const opt = document.createElement('option');
                opt.value = nome;
                opt.textContent = nome;
                optgroup.appendChild(opt);
            });
            selectLoja.appendChild(optgroup);
        });
    }

    // Injetar botão do Hub dinamicamente
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

    // Iniciar Listeners do Firebase
    iniciarListenersAuditoria();

    // Iniciar com uma data preenchida hoje
    if (document.getElementById('audiDataInput')) {
        document.getElementById('audiDataInput').valueAsDate = new Date();
    }

    window.switchView('dashboard');
}

window.switchView = function (view) {
    document.getElementById('view-dashboard').style.display = 'none';
    document.getElementById('view-auditoriaOnline').style.display = 'none';
    document.getElementById('view-planejamento').style.display = 'none';
    document.getElementById('view-tarefas').style.display = 'none';
    document.getElementById('view-metapwr').style.display = 'none';

    document.getElementById('nav-dashboard').classList.remove('active');
    document.getElementById('nav-auditoriaOnline').classList.remove('active');
    document.getElementById('nav-planejamento').classList.remove('active');
    document.getElementById('nav-tarefas').classList.remove('active');
    document.getElementById('nav-metapwr').classList.remove('active');

    document.getElementById(`view-${view}`).style.display = 'block';
    document.getElementById(`nav-${view}`).classList.add('active');

    if (window.innerWidth <= 768) {
        window.toggleSidebar();
    }

    if (view === 'metapwr') {
        renderizarGrafico();
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

// Protótipo: Gráfico de Dispersão CMV
function renderizarGrafico() {
    const canvas = document.getElementById('cmvScatterChart');
    if (!canvas) return;

    // Tema claro vs escuro
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#f8fafc' : '#0f172a';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    if (scatterChartInst) scatterChartInst.destroy();

    // Dados Fictícios de Lojas para MVP
    // x = Faturamento (Receita), y = CMV (%)
    const lojasData = [
        { nome: 'Loja Beira Mar', x: 250000, y: 28 },
        { nome: 'Loja Iguatemi', x: 320000, y: 24 },
        { stroke: true, nome: 'Loja Centro', x: 180000, y: 35 }, // Acima da meta
        { nome: 'Loja Sul', x: 210000, y: 31 },
        { nome: 'Loja Aeroporto', x: 450000, y: 22 },
        { nome: 'Loja Praia', x: 300000, y: 26 },
        { nome: 'Loja Norte', x: 150000, y: 32 },
        { nome: 'Loja RioMar', x: 380000, y: 23 },
        { nome: 'Loja Meireles', x: 280000, y: 29 },
        { nome: 'Loja Aldeota', x: 290000, y: 25 }
    ];

    scatterChartInst = new Chart(canvas, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Lojas San Paolo',
                data: lojasData,
                backgroundColor: function (context) {
                    const val = context.raw;
                    if (!val) return '#265D7C'; // Ao leite default
                    // Cores baseadas no percentual do CMV (Ideal abaixo de 30%)
                    if (val.y > 30) return '#DA0D17'; // Red Velvet 
                    if (val.y >= 26 && val.y <= 30) return '#DA5513'; // Laranja San Paolo
                    return '#4F7039'; // Pistache
                },
                pointRadius: 8,
                pointHoverRadius: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            const p = ctx.raw;
                            return `${p.nome} - Faturamento: R$${p.x.toLocaleString()} | CMV: ${p.y}%`;
                        }
                    }
                },
                legend: {
                    labels: { color: textColor }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: {
                        display: true,
                        text: 'Faturamento Bruto (R$)',
                        color: textColor,
                        font: { size: 14, weight: 'bold' }
                    },
                    grid: { color: gridColor },
                    ticks: { color: textColor, callback: (v) => 'R$' + v.toLocaleString() }
                },
                y: {
                    title: {
                        display: true,
                        text: 'CMV de Mercadoria (%)',
                        color: textColor,
                        font: { size: 14, weight: 'bold' }
                    },
                    grid: { color: gridColor },
                    ticks: { color: textColor, callback: (v) => v + '%' },
                    min: 15,
                    max: 40
                }
            }
        }
    });
}

// ============================================
// LÓGICA DE AUDITORIA (FIREBASE)
// ============================================

function iniciarListenersAuditoria() {
    try {
        // Listener de Notas Históricas
        const qNotas = query(collection(db, "auditoria_notas"), orderBy("data", "desc"));
        onSnapshot(qNotas, (snapshot) => {
            notasCache = [];
            snapshot.forEach((doc) => {
                notasCache.push({ id: doc.id, ...doc.data() });
            });
            renderizarHistoricoNotas();
            renderizarTabelaPlanejamento();
            renderDashboard(); // Atualizar Dashboard
        }, (err) => console.error("Erro Notas:", err));

        // Listener de Planejamento 
        onSnapshot(collection(db, "auditoria_planejamento"), (snapshot) => {
            planejamentoCache = [];
            snapshot.forEach((doc) => {
                // Guarda o ID autogerado da collection para podermos dar update depois
                planejamentoCache.push({ docId: doc.id, ...doc.data() });
            });
            renderizarTabelaPlanejamento();
        }, (err) => console.error("Erro Planejamento:", err));

        // Listener de Projetos/Tarefas de Auditoria
        const qAudiProj = query(collection(db, "auditoria_projetos"), orderBy("timestamp", "desc"));
        onSnapshot(qAudiProj, (snapshot) => {
            audiProjetos = {};
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                data.firebaseId = docSnap.id;
                if (!audiProjetos[data.membroResponsavel]) audiProjetos[data.membroResponsavel] = [];
                audiProjetos[data.membroResponsavel].push(data);
            });
            renderizarAudiProjetosList();
        }, (err) => console.error("Erro Projetos Audi:", err));

        // Listener de Equipe da Auditoria
        const qAudiEquipe = query(collection(db, "auditoria_equipe"), orderBy("nome"));
        onSnapshot(qAudiEquipe, (snapshot) => {
            audiEquipe = [];
            snapshot.forEach(docSnap => audiEquipe.push({ firebaseId: docSnap.id, ...docSnap.data() }));
            if (audiEquipe.length > 0 && (!audiCurrentMember || !audiEquipe.find(m => m.nome === audiCurrentMember))) {
                audiCurrentMember = audiEquipe[0].nome;
            }
            renderizarBotoesAudiEquipe();
            renderizarAudiProjetosList();
            renderizarListaAudiEquipeGerenciar();
        }, (err) => console.error("Erro Equipe Audi:", err));

    } catch (e) {
        console.error("Erro ao iniciar listeners auditoria", e);
    }
}

// 1. AUDITORIA ONLINE (LANÇAR NOTA)
window.salvarAuditoriaOnline = async function () {
    const loja = document.getElementById('audiSelectLoja').value;
    const data = document.getElementById('audiDataInput').value;
    const nota = parseFloat(document.getElementById('audiNotaInput').value);

    if (!loja || !data || isNaN(nota) || nota < 0 || nota > 10) {
        showToast("Preencha loja, data e uma nota válida (0 a 10).", "warning");
        return;
    }

    try {
        await addDoc(collection(db, "auditoria_notas"), {
            loja: loja,
            data: data,
            nota: nota,
            auditor: currentUser,
            timestamp: new Date().toISOString()
        });
        showToast("Auditoria registrada!", "success");
        document.getElementById('audiSelectLoja').value = "";
        document.getElementById('audiNotaInput').value = "";
    } catch (e) {
        console.error(e);
        showToast("Erro ao gravar nota.", "error");
    }
}

function renderizarHistoricoNotas() {
    const tbody = document.getElementById('audiHistoricoBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (notasCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding: 20px; text-align: center; color: var(--text-muted);">Nenhuma avaliação registrada recente.</td></tr>';
        return;
    }

    // Exibir apenas as últimas 30 avaliações para não travar a tabela
    const relatorio = notasCache.slice(0, 30);

    relatorio.forEach(nota => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid var(--border)";

        let colorNota = "var(--sp-pistache)";
        if (nota.nota < 7) colorNota = "var(--sp-red)";
        else if (nota.nota < 8.5) colorNota = "var(--sp-laranja)";

        // Data Formatter
        let displayData = nota.data;
        if (displayData) {
            const [y, m, d] = displayData.split('-');
            if (y && m && d) displayData = `${d}/${m}/${y}`;
        }

        tr.innerHTML = `
            <td style="padding: 15px; font-size: 0.9rem;">${displayData}</td>
            <td style="padding: 15px; font-weight: 600; font-size: 0.9rem;">${nota.loja}</td>
            <td style="padding: 15px; font-size: 0.9rem; color: var(--text-muted);"><i class="ph ph-user"></i> ${nota.auditor}</td>
            <td style="padding: 15px; font-weight: 700; font-size: 1.1rem; text-align: right; color: ${colorNota};">${nota.nota.toFixed(1)}</td>
        `;
        tbody.appendChild(tr);
    });
}


// 2. PLANEJAMENTO DE AUDITORIAS (TABELA COM SORT)
function getLojaRegional(nomeLoja) {
    const l = lojasIniciais.find(x => x.nome === nomeLoja);
    return l ? l.estado : 'N/A';
}

function getUltimaAuditoria(nomeLoja) {
    const historicoLoja = notasCache.filter(n => n.loja === nomeLoja);
    if (historicoLoja.length > 0) return historicoLoja[0].data; // Já vem em desc
    return null;
}

window.renderizarTabelaPlanejamento = function () {
    const tbody = document.getElementById('planejamentoTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtro = (document.getElementById('pesquisaPlanejamento')?.value || '').toLowerCase();

    // Preparar array enriquecido
    let rows = lojasIniciais.map(lojaBase => {
        const cfg = planejamentoCache.find(p => p.loja === lojaBase.nome) || {};
        const ultimaRaw = getUltimaAuditoria(lojaBase.nome);
        return {
            nome: lojaBase.nome,
            regional: getLojaRegional(lojaBase.nome),
            ultimaRaw: ultimaRaw || '',
            proximaRaw: cfg.dataProxima || '',
            auditor: cfg.auditor || '',
            docId: cfg.docId || null
        };
    });

    // Filtro de texto
    if (filtro) {
        rows = rows.filter(r => r.nome.toLowerCase().includes(filtro) || r.regional.toLowerCase().includes(filtro) || r.auditor.toLowerCase().includes(filtro));
    }

    // Sorting
    rows.sort((a, b) => {
        let va, vb;
        switch (planejamentoSortCol) {
            case 'loja': va = a.nome; vb = b.nome; break;
            case 'regional': va = a.regional; vb = b.regional; break;
            case 'ultima': va = a.ultimaRaw; vb = b.ultimaRaw; break;
            case 'proxima': va = a.proximaRaw; vb = b.proximaRaw; break;
            case 'auditor': va = a.auditor; vb = b.auditor; break;
            default: va = a.nome; vb = b.nome;
        }
        if (va < vb) return planejamentoSortAsc ? -1 : 1;
        if (va > vb) return planejamentoSortAsc ? 1 : -1;
        return 0;
    });

    rows.forEach(r => {
        const ultimaStr = r.ultimaRaw ? r.ultimaRaw.split('-').reverse().join('/') : 'Nunca';
        const proxStr = r.proximaRaw ? r.proximaRaw.split('-').reverse().join('/') : '<span style="color:var(--text-muted)">Não agendado</span>';
        const audStr = r.auditor || '<span style="color:var(--text-muted)">A Definir</span>';

        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid var(--border)";
        tr.innerHTML = `
            <td style="padding: 15px; font-weight: 600; font-size: 0.9rem; color: var(--text-main);">${r.nome}</td>
            <td style="padding: 15px; font-size: 0.85rem; color: var(--secondary);"><span style="background: rgba(38,93,124,0.1); padding: 4px 8px; border-radius: 4px;">${r.regional}</span></td>
            <td style="padding: 15px; font-size: 0.85rem; font-weight: 500;">${ultimaStr}</td>
            <td style="padding: 15px; font-size: 0.85rem; font-weight: 600;">${proxStr}</td>
            <td style="padding: 15px; font-size: 0.85rem; color: var(--text-main);"><i class="ph ph-user"></i> ${audStr}</td>
            <td style="padding: 15px; text-align: center;">
                <button class="btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem;" onclick="window.abrirModalEditPlanejamento('${r.nome}')">
                    <i class="ph ph-pencil-simple"></i> Editar
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.sortPlanejamento = function (col) {
    if (planejamentoSortCol === col) {
        planejamentoSortAsc = !planejamentoSortAsc; // Toggle
    } else {
        planejamentoSortCol = col;
        planejamentoSortAsc = true;
    }
    renderizarTabelaPlanejamento();
}

window.filtrarPlanejamento = function () {
    renderizarTabelaPlanejamento();
}

window.abrirModalEditPlanejamento = function (nomeLoja) {
    // Busca configuração pré-existente se houver para trazer também o docId
    const cfg = planejamentoCache.find(p => p.loja === nomeLoja) || {};

    // Guardamos um objeto para update
    planejamentoAbertoId = {
        nomeLoja: nomeLoja,
        docId: cfg.docId || null
    };

    document.getElementById('modalPlanLojaNome').innerText = nomeLoja;
    document.getElementById('modalPlanId').value = nomeLoja;

    document.getElementById('modalPlanDataProx').value = cfg.dataProxima || '';
    document.getElementById('modalPlanAuditor').value = cfg.auditor || '';
    document.getElementById('modalPlanNotas').value = cfg.notasInternas || '';

    document.getElementById('modalPlanejamentoObj').classList.add('show');
}

window.fecharModalEditPlanejamento = function () {
    document.getElementById('modalPlanejamentoObj').classList.remove('show');
    planejamentoAbertoId = null;
}

window.salvarPlanejamento = async function () {
    if (!planejamentoAbertoId) return;

    const dataProxima = document.getElementById('modalPlanDataProx').value;
    const auditor = document.getElementById('modalPlanAuditor').value.trim();
    const notasInternas = document.getElementById('modalPlanNotas').value.trim();

    const payload = {
        loja: planejamentoAbertoId.nomeLoja,
        dataProxima,
        auditor,
        notasInternas,
        regional: 'Nordeste',
        updatedAt: new Date().toISOString()
    };

    try {
        if (planejamentoAbertoId.docId) {
            // Se já existe no Firebase um doc para essa loja, faça Update
            await updateDoc(doc(db, "auditoria_planejamento", planejamentoAbertoId.docId), payload);
        } else {
            // Cria um novo doc
            await addDoc(collection(db, "auditoria_planejamento"), payload);
        }

        showToast("Agendamento de Auditoria salvo!", "success");
        window.fecharModalEditPlanejamento();
    } catch (e) {
        console.error(e);
        showToast("Erro ao salvar planejamento", "error");
    }
}

// ============================================
// 3. DASHBOARD DINÂMICO
// ============================================
function renderDashboard() {
    if (notasCache.length === 0) {
        if (document.getElementById('kpiTotalAuditorias')) document.getElementById('kpiTotalAuditorias').textContent = '0';
        if (document.getElementById('kpiMediaRede')) document.getElementById('kpiMediaRede').textContent = '-';
        if (document.getElementById('kpiMenorNota')) document.getElementById('kpiMenorNota').textContent = '-';
        if (document.getElementById('kpiMenorNotaLoja')) document.getElementById('kpiMenorNotaLoja').textContent = '';
        if (document.getElementById('kpiAuditoriaMes')) document.getElementById('kpiAuditoriaMes').textContent = '0';
        return;
    }

    // KPI: Total de Auditorias
    document.getElementById('kpiTotalAuditorias').textContent = notasCache.length;

    // KPI: Média da Rede
    const somaNotas = notasCache.reduce((acc, n) => acc + n.nota, 0);
    const media = somaNotas / notasCache.length;
    const elMedia = document.getElementById('kpiMediaRede');
    elMedia.textContent = media.toFixed(1);
    elMedia.style.color = media >= 8.5 ? 'var(--sp-pistache)' : (media >= 7 ? 'var(--sp-laranja)' : 'var(--sp-red)');

    // KPI: Menor Nota (da última auditoria de cada loja)
    // Pegar a nota mais recente de cada loja
    const ultimaPorLoja = {};
    notasCache.forEach(n => {
        if (!ultimaPorLoja[n.loja] || n.data > ultimaPorLoja[n.loja].data) {
            ultimaPorLoja[n.loja] = n;
        }
    });
    const todasUltimas = Object.values(ultimaPorLoja);
    const menor = todasUltimas.reduce((min, n) => n.nota < min.nota ? n : min, todasUltimas[0]);
    document.getElementById('kpiMenorNota').textContent = menor.nota.toFixed(1);
    document.getElementById('kpiMenorNotaLoja').textContent = menor.loja;

    // KPI: Auditorias neste mês
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const doMes = notasCache.filter(n => n.data && n.data.startsWith(mesAtual));
    document.getElementById('kpiAuditoriaMes').textContent = doMes.length;

    // ---- GRÁFICO 1: Média por Regional ----
    const mediaPorRegional = {};
    const countPorRegional = {};
    todasUltimas.forEach(n => {
        const reg = getLojaRegional(n.loja);
        if (!mediaPorRegional[reg]) { mediaPorRegional[reg] = 0; countPorRegional[reg] = 0; }
        mediaPorRegional[reg] += n.nota;
        countPorRegional[reg]++;
    });
    const regionais = Object.keys(mediaPorRegional).sort();
    const mediasRegionais = regionais.map(r => +(mediaPorRegional[r] / countPorRegional[r]).toFixed(1));
    const coresBarras = mediasRegionais.map(m => m >= 8.5 ? '#4F7039' : (m >= 7 ? '#DA5513' : '#DA0D17'));

    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#f8fafc' : '#0f172a';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    const canvasRegional = document.getElementById('chartMediaRegional');
    if (canvasRegional) {
        if (chartMediaRegionalInst) chartMediaRegionalInst.destroy();
        chartMediaRegionalInst = new Chart(canvasRegional, {
            type: 'bar',
            data: {
                labels: regionais,
                datasets: [{ label: 'Média', data: mediasRegionais, backgroundColor: coresBarras, borderRadius: 6, barThickness: 30 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { min: 0, max: 10, grid: { color: gridColor }, ticks: { color: textColor } },
                    y: { grid: { display: false }, ticks: { color: textColor, font: { weight: '600' } } }
                }
            }
        });
    }

    // ---- GRÁFICO 2: Ranking das últimas notas por loja (horizontal bar, top 15) ----
    const ranking = [...todasUltimas].sort((a, b) => a.nota - b.nota).slice(0, 15);
    const labelsRanking = ranking.map(n => n.loja);
    const valoresRanking = ranking.map(n => n.nota);
    const coresRanking = valoresRanking.map(v => v >= 8.5 ? '#4F7039' : (v >= 7 ? '#DA5513' : '#DA0D17'));

    const canvasRanking = document.getElementById('chartRankingLojas');
    if (canvasRanking) {
        if (chartRankingLojasInst) chartRankingLojasInst.destroy();
        chartRankingLojasInst = new Chart(canvasRanking, {
            type: 'bar',
            data: {
                labels: labelsRanking,
                datasets: [{ label: 'Nota', data: valoresRanking, backgroundColor: coresRanking, borderRadius: 6, barThickness: 18 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { min: 0, max: 10, grid: { color: gridColor }, ticks: { color: textColor } },
                    y: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } }
                }
            }
        });
    }
}

// ============================================
// 4. TAREFAS/PROJETOS DA AUDITORIA (KANBAN)
// ============================================

window.switchAudiMember = function (name) {
    audiCurrentMember = name;
    renderizarBotoesAudiEquipe();
    renderizarAudiProjetosList();
}

function renderizarBotoesAudiEquipe() {
    const container = document.getElementById('audiMembrosEquipeContainer');
    if (!container) return;
    container.innerHTML = '';
    audiEquipe.forEach(m => {
        const btn = document.createElement('button');
        btn.className = m.nome === audiCurrentMember ? 'btn btn-primary' : 'btn btn-outline';
        btn.innerText = m.nome;
        btn.onclick = () => window.switchAudiMember(m.nome);
        container.appendChild(btn);
    });
}

window.salvarAudiProjeto = async function () {
    if (!audiCurrentMember) return showToast("Selecione ou crie um membro da equipe antes", "error");
    const desc = document.getElementById('audiProjDesc').value;
    const dem = document.getElementById('audiProjDemand').value;
    const dt = document.getElementById('audiProjDate').value;
    const status = document.getElementById('audiProjStatus').value;
    const fileInput = document.getElementById('audiProjAnexo');

    if (!desc || !dem || !dt) return showToast("Preencha os dados da tarefa", "error");
    const [y, m, d] = dt.split('-');
    let anexoUrl = fileInput ? fileInput.value.trim() : null;

    try {
        await addDoc(collection(db, "auditoria_projetos"), {
            membroResponsavel: audiCurrentMember,
            dataAtv: `${d}/${m}/${y}`,
            desc: desc,
            demandante: dem,
            status: status,
            anexoUrl: anexoUrl,
            autor: currentUser,
            timestamp: Date.now()
        });
        document.getElementById('audiProjDesc').value = '';
        document.getElementById('audiProjDemand').value = '';
        document.getElementById('audiProjStatus').value = 'Pendente';
        if (fileInput) fileInput.value = '';
        showToast("Tarefa registrada");
    } catch (e) {
        console.error(e);
        showToast("Erro ao registrar tarefa", "error");
    }
}

window.deletarAudiProjeto = async function (firebaseId) {
    if (!confirm("Remover este registro?")) return;
    try {
        await deleteDoc(doc(db, "auditoria_projetos", firebaseId));
        showToast("Tarefa removida");
    } catch (e) {
        console.error(e);
        showToast("Erro ao remover tarefa", "error");
    }
}

function renderizarAudiProjetosList() {
    const container = document.getElementById('audi-projetos-list');
    if (!container) return;
    const projs = audiProjetos[audiCurrentMember] || [];
    container.innerHTML = '';

    if (projs.length === 0) {
        container.innerHTML = `<div class="empty-state" style="width: 100%;"><i class="ph ph-kanban"></i><h2>Nenhum registro para ${audiCurrentMember || 'esta equipe'}</h2></div>`;
        return;
    }

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
            actionBtns += `<button class="btn btn-outline" style="padding: 6px; margin-right: 5px;" onclick="window.abrirModalEditAudiProj('${p.firebaseId}')"><i class="ph ph-pencil"></i></button>`;
            actionBtns += `<button class="btn btn-danger" style="padding: 6px;" onclick="window.deletarAudiProjeto('${p.firebaseId}')"><i class="ph ph-trash"></i></button>`;

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

// ====== EDIÇÃO DE TAREFAS AUDITORIA ======
window.abrirModalEditAudiProj = function (firebaseId) {
    // Busca em todos os membros
    let p = null;
    Object.values(audiProjetos).forEach(arr => {
        const found = arr.find(x => x.firebaseId === firebaseId);
        if (found) p = found;
    });
    if (!p) return;

    document.getElementById('editAudiProjId').value = p.firebaseId;
    document.getElementById('editAudiProjDesc').value = p.desc;
    document.getElementById('editAudiProjDemand').value = p.demandante;
    const [d, m, y] = p.dataAtv.split('/');
    document.getElementById('editAudiProjDate').value = `${y}-${m}-${d}`;
    document.getElementById('editAudiProjStatus').value = p.status;

    const mbSelect = document.getElementById('editAudiProjMember');
    mbSelect.innerHTML = audiEquipe.map(mb => `<option value="${mb.nome}">${mb.nome}</option>`).join('');
    mbSelect.value = p.membroResponsavel;

    document.getElementById('modalEditAudiProj').classList.add('show');
}

window.fecharModalEditAudiProj = function () {
    document.getElementById('modalEditAudiProj').classList.remove('show');
}

window.confirmarEdicaoAudiProj = async function () {
    const id = document.getElementById('editAudiProjId').value;
    const desc = document.getElementById('editAudiProjDesc').value;
    const dem = document.getElementById('editAudiProjDemand').value;
    const dt = document.getElementById('editAudiProjDate').value;
    const status = document.getElementById('editAudiProjStatus').value;
    const newMember = document.getElementById('editAudiProjMember').value;

    if (!desc || !dem || !dt || !newMember) return showToast("Preencha todos os campos da tarefa", "error");
    const [y, m, d] = dt.split('-');

    try {
        await updateDoc(doc(db, "auditoria_projetos", id), {
            desc, demandante: dem, dataAtv: `${d}/${m}/${y}`, status, membroResponsavel: newMember
        });
        window.fecharModalEditAudiProj();
        showToast("Tarefa atualizada com sucesso!");
    } catch (e) {
        console.error(e);
        showToast("Erro ao atualizar tarefa", "error");
    }
}

// ====== EQUIPE AUDITORIA ======
window.abrirModalAudiEquipe = function () {
    document.getElementById('modalAudiEquipe').classList.add('show');
}

window.fecharModalAudiEquipe = function () {
    document.getElementById('modalAudiEquipe').classList.remove('show');
}

window.adicionarAudiMembro = async function () {
    const nome = document.getElementById('novoAudiMembroNome').value.trim();
    if (!nome) return showToast("Digite um nome", "error");
    if (audiEquipe.find(m => m.nome.toLowerCase() === nome.toLowerCase())) {
        return showToast("Membro já existe", "error");
    }
    try {
        await addDoc(collection(db, "auditoria_equipe"), { nome });
        document.getElementById('novoAudiMembroNome').value = '';
        showToast("Membro adicionado!");
    } catch (e) {
        console.error(e);
        showToast("Erro ao adicionar", "error");
    }
}

window.removerAudiMembro = async function (idMembro, nomeMembro) {
    if (!confirm(`Excluir ${nomeMembro} da equipe?`)) return;
    try {
        await deleteDoc(doc(db, "auditoria_equipe", idMembro));
        if (audiCurrentMember === nomeMembro) audiCurrentMember = null;
        showToast("Membro removido.");
    } catch (e) {
        console.error(e);
        showToast("Erro ao remover", "error");
    }
}

function renderizarListaAudiEquipeGerenciar() {
    const container = document.getElementById('listaAudiEquipeGerenciar');
    if (!container) return;
    container.innerHTML = '';
    audiEquipe.forEach(m => {
        const div = document.createElement('div');
        div.style = "display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--border);";
        div.innerHTML = `
            <span>${m.nome}</span>
            <button class="btn btn-danger" style="padding: 5px 10px;" onclick="window.removerAudiMembro('${m.firebaseId}', '${m.nome}')">
                <i class="ph ph-trash"></i>
            </button>
        `;
        container.appendChild(div);
    });
}

function escapeCSV(text) {
    if (!text) return '';
    const str = String(text);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

window.exportarAudiProjetosCSV = function () {
    let csvContent = "\uFEFFResponsavel,Data_Atividade,Status,Descricao,Demandante,Registrado_Por\n";
    Object.keys(audiProjetos).forEach(membro => {
        const projetos = audiProjetos[membro] || [];
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
    link.setAttribute("download", `relatorio_auditoria_tarefas_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Download de tarefas iniciado");
}

if (currentUser) initApp();
