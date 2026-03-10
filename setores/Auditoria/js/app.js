// js/app.js da Auditoria
import { db, collection, getDocs, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, orderBy, where } from '../../js/firebase.js';
import { lojasIniciais } from '../../js/data.js';

let currentUser = sessionStorage.getItem('loggedUser') || null;
let scatterChartInst = null;

// Caches de Auditoria
let notasCache = [];
let planejamentoCache = [];
let planejamentoAbertoId = null;

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

    // Popular Lojas no Select de Auditoria Online
    const selectLoja = document.getElementById('audiSelectLoja');
    if (selectLoja) {
        selectLoja.innerHTML = '<option value="">Selecione a Loja...</option>';
        lojasIniciais.forEach(loja => {
            selectLoja.innerHTML += `<option value="${loja.nome}">${loja.nome}</option>`;
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

    window.switchView('auditoriaOnline');
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
            renderizarTabelaPlanejamento(); // Notas podem afetar a 'Última Auditoria'
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


// 2. PLANEJAMENTO DE AUDITORIAS (TABELA)
window.renderizarTabelaPlanejamento = function () {
    const tbody = document.getElementById('planejamentoTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtro = (document.getElementById('pesquisaPlanejamento')?.value || '').toLowerCase();

    // Cruzar Lojas Base com as Configurações Salvas no Firestore (planejamentoCache)
    // E capturar a última Data em notasCache para exibir.

    lojasIniciais.forEach(lojaBase => {
        // Ignorar a Matriz ou exibir, como preferir. Incluiremos.

        // Busca Configuração do Planejamento (usamos campo loja)
        const cfg = planejamentoCache.find(p => p.loja === lojaBase.nome) || {};

        // Busca a Nota mais recente para esta loja
        const historicoLoja = notasCache.filter(n => n.loja === lojaBase.nome);
        let ultimaAuditoriaStr = "Nunca";
        if (historicoLoja.length > 0) {
            // Como já vem ordenado desc de lá, index 0 é o mais recente
            const ulData = historicoLoja[0].data;
            const [y, m, d] = ulData.split('-');
            ultimaAuditoriaStr = `${d}/${m}/${y}`;
        }

        // Filtro de Texto
        if (filtro && !lojaBase.nome.toLowerCase().includes(filtro) && !(cfg.regional || '').toLowerCase().includes(filtro)) {
            return;
        }

        const dataProxStr = cfg.dataProxima ? cfg.dataProxima.split('-').reverse().join('/') : '<span style="color:var(--text-muted)">Não agendado</span>';
        const auditor = cfg.auditor || '<span style="color:var(--text-muted)">A Definir</span>';
        const regional = cfg.regional || 'N/A';

        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid var(--border)";
        tr.innerHTML = `
            <td style="padding: 15px; font-weight: 600; font-size: 0.9rem; color: var(--text-main);">${lojaBase.nome}</td>
            <td style="padding: 15px; font-size: 0.85rem; color: var(--secondary);"><span style="background: rgba(38,93,124,0.1); padding: 4px 8px; border-radius: 4px;">${regional}</span></td>
            <td style="padding: 15px; font-size: 0.85rem; font-weight: 500;">${ultimaAuditoriaStr}</td>
            <td style="padding: 15px; font-size: 0.85rem; font-weight: 600;">${dataProxStr}</td>
            <td style="padding: 15px; font-size: 0.85rem; color: var(--text-main);"><i class="ph ph-user"></i> ${auditor}</td>
            <td style="padding: 15px; text-align: center;">
                <button class="btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem;" onclick="window.abrirModalEditPlanejamento('${lojaBase.nome}')">
                    <i class="ph ph-pencil-simple"></i> Editar Agendamento
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
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

if (currentUser) initApp();
