// setores/Diretoria/js/app.js
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

function initApp() {
    if (!currentUser) {
        window.location.href = '../../index.html';
        return;
    }

    document.getElementById('loggedUserName').innerText = currentUser;

    // Injetar botão do Hub dinamicamente nas divs cabecalho
    document.querySelectorAll('.header-actions').forEach(container => {
        if (container.querySelector('.btn-hub')) return;
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline btn-hub';
        btn.style.padding = '6px 10px';
        btn.title = 'Voltar para o Hub de Setores';
        btn.innerHTML = '<i class="ph ph-squares-four" style="font-size: 1.2rem;"></i>';
        btn.onclick = () => window.location.href = '../../index.html?hub=1';

        const titleSpan = container.querySelector('.page-title');

        // Wrap o botão e o title numa div 
        const divWrapper = document.createElement('div');
        divWrapper.style.display = 'flex';
        divWrapper.style.alignItems = 'center';
        divWrapper.style.gap = '10px';

        container.insertBefore(divWrapper, titleSpan);
        divWrapper.appendChild(btn);
        divWrapper.appendChild(titleSpan);

        // O botão mobile ja tem flex
        const mobileBtn = document.querySelector('.btn-menu-toggle');
        if (mobileBtn) {
            divWrapper.insertBefore(mobileBtn, btn);
        }
    });

    window.switchView('visao');
}

window.switchView = function (view) {
    const views = ['visao', 'ranking', 'atos', 'cofre', 'inovacao'];

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
