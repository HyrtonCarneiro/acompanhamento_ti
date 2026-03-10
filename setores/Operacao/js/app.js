// js/app.js - Operação
import { db, collection, addDoc, getDocs, updateDoc, doc, deleteDoc, onSnapshot, query, orderBy } from '../../../js/firebase.js';

let currentUser = sessionStorage.getItem('loggedUser') || null;
let equipeCache = [];

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

    // Iniciar listener de equipe
    iniciarListenerEquipe();

    window.switchView('dashboard');
}

function iniciarListenerEquipe() {
    try {
        const qEquipe = query(collection(db, "operacao_equipe"), orderBy("nome"));
        onSnapshot(qEquipe, (snapshot) => {
            equipeCache = [];
            snapshot.forEach(docSnap => equipeCache.push({ firebaseId: docSnap.id, ...docSnap.data() }));
            renderizarListaEquipeGerenciar();
        }, (err) => console.error("Erro Equipe:", err));
    } catch(e) {
        console.error("Erro ao iniciar listener equipe", e);
    }
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

// ====== EQUIPE ======
window.abrirModalEquipe = function() {
    document.getElementById('modalEquipe').classList.add('show');
}

window.fecharModalEquipe = function() {
    document.getElementById('modalEquipe').classList.remove('show');
}

window.adicionarMembro = async function() {
    const nome = document.getElementById('novoMembroNome').value.trim();
    if (!nome) return showToast("Digite um nome", "error");
    if (equipeCache.find(m => m.nome.toLowerCase() === nome.toLowerCase())) {
        return showToast("Membro já existe", "error");
    }
    try {
        await addDoc(collection(db, "operacao_equipe"), { nome });
        document.getElementById('novoMembroNome').value = '';
        showToast("Membro adicionado!");
    } catch(e) {
        console.error(e);
        showToast("Erro ao adicionar", "error");
    }
}

window.removerMembro = async function(idMembro, nomeMembro) {
    if (!confirm(`Excluir ${nomeMembro} da equipe?`)) return;
    try {
        await deleteDoc(doc(db, "operacao_equipe", idMembro));
        showToast("Membro removido.");
    } catch(e) {
        console.error(e);
        showToast("Erro ao remover", "error");
    }
}

function renderizarListaEquipeGerenciar() {
    const container = document.getElementById('listaEquipeGerenciar');
    if (!container) return;
    container.innerHTML = '';
    equipeCache.forEach(m => {
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
