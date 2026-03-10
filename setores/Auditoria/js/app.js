// js/app.js da Auditoria
let currentUser = sessionStorage.getItem('loggedUser') || null;
let scatterChartInst = null;

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

function initApp() {
    if (!currentUser) {
        window.location.href = '../../index.html';
        return;
    }

    document.getElementById('loggedUserName').innerText = currentUser;

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

    window.switchView('dashboard');
}

window.switchView = function (view) {
    document.getElementById('view-dashboard').style.display = 'none';
    document.getElementById('view-tarefas').style.display = 'none';
    document.getElementById('view-metapwr').style.display = 'none';

    document.getElementById('nav-dashboard').classList.remove('active');
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

if (currentUser) initApp();
