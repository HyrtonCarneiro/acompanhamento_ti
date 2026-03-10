// js/app.js base para setores padrões
let currentUser = sessionStorage.getItem('loggedUser') || null;

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
    // Em vez de limpar tudo, podemos apenas voltar ao hub. Mas manteremos compatibilidade enviando ao index
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

    // Apenas proteje se não for Admin e não tiver a permissão (Aqui seria a permissão específica, ex: Controladoria)
    // Para simplificar no protótipo, se for usuário normal a gente deixa olhar o layout básico se ele tentar via URL (ideal é validar a role correspondente ao folder de origin)

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
}

window.toggleSidebar = function () {
    const sidebar = document.getElementById('appSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    }
}

if (currentUser) initApp();
