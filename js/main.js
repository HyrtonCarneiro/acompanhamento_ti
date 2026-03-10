// js/main.js
import { db, collection, addDoc, getDocs, updateDoc, doc, deleteDoc, query, where } from './firebase.js';

let currentUser = sessionStorage.getItem('loggedUser') || null;
let allUsersCache = [];

function showToast(msg, type = 'success') {
    Toastify({
        text: msg, duration: 3000, gravity: "bottom", position: "right",
        style: { background: type === 'success' ? "var(--success)" : "var(--danger)", borderRadius: "6px", fontFamily: "Inter" }
    }).showToast();
}

window.handleAuth = async function () {
    const user = document.getElementById('userInput').value.trim();
    const pass = document.getElementById('passInput').value.trim();

    if (!user || !pass) return showToast("Preencha todos os campos", "error");

    try {
        const q = query(collection(db, "users"), where("user", "==", user));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            if (user === 'admin' && pass === '$@np@010') {
                const allSectors = ["Diretoria", "TI", "Auditoria", "Controladoria", "Expansao", "Fiscal", "Financeiro", "Marketing", "Gente_Gestao", "Operacao", "Varejo"];
                await addDoc(collection(db, "users"), { user: 'admin', pass: '$@np@010', setores_permitidos: allSectors });
                sessionStorage.setItem('loggedUser', user);
                sessionStorage.setItem('userSectors', JSON.stringify(allSectors));
                currentUser = user;
                initApp();
            } else {
                showToast("Credenciais inválidas", "error");
            }
            return;
        }

        const docRef = querySnapshot.docs[0];
        const userData = docRef.data();

        // Corrige senha do admin se ele já existia mas com a credencial antiga
        if (user === 'admin' && pass === '$@np@010' && userData.pass !== '$@np@010') {
            await updateDoc(doc(db, "users", docRef.id), { pass: '$@np@010' });
            userData.pass = '$@np@010';
        }

        if (userData.pass === pass) {
            let sectors = userData.setores_permitidos || ["TI"];
            if (user === 'admin') {
                sectors = ["Diretoria", "TI", "Auditoria", "Controladoria", "Expansao", "Fiscal", "Financeiro", "Marketing", "Gente_Gestao", "Operacao", "Varejo"];
            }
            sessionStorage.setItem('userSectors', JSON.stringify(sectors));
            sessionStorage.setItem('loggedUser', user);
            currentUser = user;
            initApp();
        } else {
            showToast("Credenciais inválidas", "error");
        }
    } catch (e) {
        console.error(e);
        showToast("Erro na autenticação", "error");
    }
}

window.logout = function () {
    sessionStorage.removeItem('loggedUser');
    sessionStorage.removeItem('userSectors');
    location.reload();
}

function initApp() {
    document.getElementById('login-container').style.display = 'none';

    let sectors = [];
    try {
        sectors = JSON.parse(sessionStorage.getItem('userSectors')) || ["TI"];
    } catch (e) {
        sectors = ["TI"];
    }

    const urlParams = new URLSearchParams(window.location.search);
    const forceHub = urlParams.get('hub') === '1';

    if (sectors.length === 1 && sectors[0] !== 'Admin' && !forceHub) {
        window.location.href = `./setores/${sectors[0]}/index.html`;
        return;
    }

    document.getElementById('hub-container').style.display = 'block';

    const allHubSectors = ["Diretoria", "TI", "Auditoria", "Controladoria", "Expansao", "Fiscal", "Financeiro", "Marketing", "Gente_Gestao", "Operacao", "Varejo"];
    allHubSectors.forEach(sec => {
        const card = document.getElementById('hub-card-' + sec);
        if (card) {
            if (sectors.includes(sec) || currentUser === 'admin') {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        }
    });

    const adminBtn = document.getElementById('adminPanelBtn');
    if (adminBtn) {
        if (currentUser === 'admin') adminBtn.style.display = 'inline-flex';
        else adminBtn.style.display = 'none';
    }
}

window.goToSector = function (sector) {
    window.location.href = `./setores/${sector}/index.html`;
}

// =================== ADMIN PANEL ===================
window.abrirModalAdmin = async function () {
    const el = document.getElementById('modalAdminUsers');
    el.style.display = 'flex';
    // Timeout to allow display:flex to apply before opacity transition
    setTimeout(() => { el.classList.add('show'); }, 10);
    carregarUsuariosAdmin();
}

window.fecharModalAdmin = function () {
    const el = document.getElementById('modalAdminUsers');
    el.classList.remove('show');
    setTimeout(() => { el.style.display = 'none'; }, 200);
}

async function carregarUsuariosAdmin() {
    const listHtml = document.getElementById('adminUsersList');
    listHtml.innerHTML = '<p style="padding:20px; text-align:center;">Carregando usuários...</p>';

    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        allUsersCache = [];
        querySnapshot.forEach(doc => {
            allUsersCache.push({ id: doc.id, ...doc.data() });
        });

        // Põe o admin em primeiro
        allUsersCache.sort((a, b) => {
            if (a.user === 'admin') return -1;
            if (b.user === 'admin') return 1;
            return a.user.localeCompare(b.user);
        });

        renderAdminUsersList();
    } catch (e) {
        console.error(e);
        listHtml.innerHTML = '<p style="padding:20px; color:var(--danger); text-align:center;">Erro ao carregar usuários do Firebase.</p>';
    }
}

function renderAdminUsersList() {
    const listHtml = document.getElementById('adminUsersList');
    if (!listHtml) return;
    listHtml.innerHTML = '';

    const termo = document.getElementById('buscaUsuarioAdmin') ? document.getElementById('buscaUsuarioAdmin').value.toLowerCase().trim() : '';
    const allSectors = ["Diretoria", "TI", "Auditoria", "Controladoria", "Expansao", "Fiscal", "Financeiro", "Marketing", "Gente_Gestao", "Operacao", "Varejo"];

    let usuariosFiltrados = allUsersCache.filter(u => u.user.toLowerCase().includes(termo));

    if (usuariosFiltrados.length === 0) {
        listHtml.innerHTML = '<p style="padding:20px; text-align:center;">Nenhum usuário encontrado.</p>';
        return;
    }

    usuariosFiltrados.forEach(u => {
        const currentPerms = Array.isArray(u.setores_permitidos) ? u.setores_permitidos : ["TI"];

        let checksHtml = allSectors.map(sec => {
            const isChecked = currentPerms.includes(sec);
            const isAdminStr = u.user === 'admin' ? 'disabled' : '';
            return `
                <label style="display:inline-flex; align-items:center; gap:5px; font-size:0.85rem; padding: 5px; background: var(--bg-color); border-radius: 4px; border: 1px solid var(--border);">
                    <input type="checkbox" value="${sec}" class="chk-sector-${u.id}" ${isChecked ? 'checked' : ''} ${isAdminStr}> ${sec}
                </label>
            `;
        }).join('');

        const d = document.createElement('div');
        d.style.border = '1px solid var(--border)';
        d.style.padding = '15px';
        d.style.marginBottom = '15px';
        d.style.borderRadius = '8px';
        d.style.background = 'var(--panel-bg)';

        const adminBadge = u.user === 'admin' ? '<span class="badge" style="background:var(--primary); color:white;">Super Admin</span>' : '';
        const btnAlterarSenha = `<button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.8rem; margin-right: 5px;" onclick="window.alterarSenhaUsuario('${u.id}', '${u.user}')"><i class="ph ph-key"></i> Senha</button>`;
        const btnDelete = u.user !== 'admin' ? `<button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.8rem;" onclick="window.deletarUsuario('${u.id}', '${u.user}')"><i class="ph ph-trash"></i> Excluir</button>` : '';

        d.innerHTML = `
            <div style="font-weight:bold; margin-bottom:10px; font-size: 1.1rem; color: var(--text-main); display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span><i class="ph ph-user"></i> ${u.user}</span>
                    ${adminBadge}
                </div>
                <div>
                    ${btnAlterarSenha}
                    ${btnDelete}
                </div>
            </div>
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:10px; margin-bottom:15px;">
                ${checksHtml}
            </div>
            ${u.user !== 'admin' ? `<button class="btn btn-primary" style="padding: 6px 12px; font-size:0.85rem;" onclick="window.salvarPermissoesUsuario('${u.id}')"><i class="ph ph-floppy-disk"></i> Salvar Permissões</button>` : '<p style="font-size:0.8rem; color:var(--text-muted);">Permissões de Super Admin não podem ser alteradas.</p>'}
        `;
        listHtml.appendChild(d);
    });
}

window.salvarPermissoesUsuario = async function (userId) {
    const checkboxes = document.querySelectorAll('.chk-sector-' + userId);
    let novasPermissoes = [];
    checkboxes.forEach(chk => {
        if (chk.checked) novasPermissoes.push(chk.value);
    });

    if (novasPermissoes.length === 0) return showToast("Selecione pelo menos um setor", "error");

    try {
        await updateDoc(doc(db, "users", userId), {
            setores_permitidos: novasPermissoes
        });
        showToast("Permissões atualizadas com sucesso!");
    } catch (e) {
        console.error(e);
        showToast("Erro ao atualizar permissões", "error");
    }
}

window.deletarUsuario = async function (userId, userName) {
    if (!confirm(`Tem certeza que deseja apagar o usuário '${userName}' permanentemente?`)) return;

    try {
        await deleteDoc(doc(db, "users", userId));
        showToast("Usuário deletado");
        carregarUsuariosAdmin(); // Refresh da lista
    } catch (e) {
        console.error(e);
        showToast("Erro ao deletar usuário", "error");
    }
}

window.criarUsuarioAdmin = async function () {
    const user = document.getElementById('novoUsuarioAdmin').value.trim();
    const pass = document.getElementById('novaSenhaAdmin').value.trim();

    if (!user || !pass) return showToast("Preencha usuário e senha", "error");

    try {
        const q = query(collection(db, "users"), where("user", "==", user));
        const qs = await getDocs(q);
        if (!qs.empty) return showToast("Usuário já existe", "error");

        await addDoc(collection(db, "users"), { user, pass, setores_permitidos: ["TI"] });
        showToast("Usuário criado com sucesso!");
        document.getElementById('novoUsuarioAdmin').value = '';
        document.getElementById('novaSenhaAdmin').value = '';
        carregarUsuariosAdmin();
    } catch (e) {
        console.error(e);
        showToast("Erro ao criar usuário", "error");
    }
}

window.alterarSenhaUsuario = async function (userId, userName) {
    const novaSenha = prompt(`Digite a nova senha para o usuário '${userName}':`);
    if (novaSenha === null) return; // cancelou
    if (!novaSenha.trim()) return showToast("Senha não pode ser vazia", "error");

    try {
        await updateDoc(doc(db, "users", userId), { pass: novaSenha.trim() });
        showToast("Senha alterada com sucesso!");
    } catch (e) {
        console.error(e);
        showToast("Erro ao alterar senha", "error");
    }
}

if (currentUser) initApp();
