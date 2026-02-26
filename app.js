// =======================================================
// OITIVASPRO - SISTEMA DE GESTÃO (VERSÃO MULTI-UNIDADES)
// =======================================================

// --- VARIÁVEIS GLOBAIS ---
let hearings = [];
let calendar = null;
let currentUserEmail = null;

// =======================================================
// 1. INICIALIZAÇÃO
// =======================================================
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    
    // Configura botões de busca
    const btnClear = document.getElementById('btn-clear-search');
    if(btnClear) btnClear.addEventListener('click', clearSearch);
    
    // Inicializa listeners para o popover
    initPopoverListeners();
});

// =======================================================
// 2. AUTENTICAÇÃO E LOGIN
// =======================================================
function initAuth() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Salva o email do usuário
            currentUserEmail = user.email;
            
            // Converte o email para um ID seguro para usar no Firebase
            currentUnit = getUnitIdFromEmail(user.email);
            
            console.log(`Usuário logado: ${user.email}`);
            console.log(`Unidade: ${currentUnit}`);
            
            // Mostra qual unidade está acessando
            showToast(`Acessando: ${user.email}`, 'success');
            
            // Inicializa o app com os dados DESTA unidade
            await initApp();
            
            // Esconde a tela de login
            showLoginScreen(false);
        } else {
            // Usuário não logado
            currentUnit = null;
            currentUserEmail = null;
            showLoginScreen(true);
        }
    });

    const loginForm = document.getElementById('form-login');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-pass').value;
            const btn = e.target.querySelector('button');
            const originalText = btn.innerHTML;

            try {
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Entrando...';
                btn.disabled = true;
                
                await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
                await auth.signInWithEmailAndPassword(email, pass);
                
                // O onAuthStateChanged vai cuidar do resto!
                
            } catch (error) {
                console.error(error);
                let msg = 'Erro ao entrar. Verifique credenciais.';
                if (error.code === 'auth/invalid-credential') msg = 'E-mail ou senha incorretos.';
                if (error.code === 'auth/user-not-found') msg = 'Usuário não encontrado.';
                if (error.code === 'auth/wrong-password') msg = 'Senha incorreta.';
                
                showToast(msg, 'error');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }
}

// =======================================================
// 3. FUNÇÕES DE LOGOUT
// =======================================================
window.logout = async function() {
    try {
        await auth.signOut();
        currentUnit = null;
        currentUserEmail = null;
        hearings = [];
        showToast('Desconectado com sucesso!', 'success');
    } catch (error) {
        showToast('Erro ao sair', 'error');
    }
}

// =======================================================
// 4. CORE DA APLICAÇÃO
// =======================================================
async function initApp() {
    console.log(`Iniciando sistema para unidade: ${currentUnit}`);
    try {
        await loadHearings();
        
        // Atualiza o título com o email da unidade
        updateUnitHeader();
        
        // Adiciona botão de logout
        addLogoutButton();
        
        renderHearingsPage();
        setTimeout(() => {
            renderCalendar();
        }, 200);
    } catch (error) {
        console.error("Erro fatal:", error);
        showToast("Erro ao carregar dados.", "error");
    }
}

function updateUnitHeader() {
    const headerTitle = document.querySelector('.bg-indigo-900 .text-2xl.font-bold');
    if (headerTitle && currentUserEmail) {
        // Extrai o nome antes do @ para mostrar
        const unitName = currentUserEmail.split('@')[0];
        headerTitle.innerHTML = `📋 ${unitName}`;
    }
}

function addLogoutButton() {
    const container = document.getElementById('logout-button-container');
    if (container && !document.getElementById('logout-btn-header')) {
        const logoutBtn = document.createElement('button');
        logoutBtn.id = 'logout-btn-header';
        logoutBtn.onclick = logout;
        logoutBtn.className = 'flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold py-3 px-4 rounded-xl transition-all transform hover:scale-105';
        logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> <span class="hidden md:inline">Sair</span>';
        
        container.appendChild(logoutBtn);
        console.log('Botão de logout adicionado!');
    }
}

async function loadHearings() {
    try {
        // Usa getUnitRef para carregar SÓ os dados desta unidade
        const snap = await getUnitRef('hearings').once('value');
        hearings = [];
        
        if(snap.exists()){
            snap.forEach(child => {
                hearings.push({ id: child.key, ...child.val() });
            });
        }
        
        console.log(`Carregadas ${hearings.length} oitivas para ${currentUnit}`);
        
    } catch (e) {
        console.error("Erro ao ler banco:", e);
        hearings = [];
    }
}

// =======================================================
// 5. CALENDÁRIO & POPOVER
// =======================================================
function renderCalendar() {
    const calendarEl = document.getElementById('calendar');
    const titleEl = document.getElementById('calendar-title');
    
    if (!calendarEl) {
        console.error('Elemento do calendário não encontrado!');
        return;
    }
    
    if (calendar) {
        calendar.destroy();
    }

    // Contagem para cores
    const counts = {};
    hearings.forEach(h => { 
        if (h.date) counts[h.date] = (counts[h.date] || 0) + 1; 
    });

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'pt-br',
        headerToolbar: false,
        height: 'auto',
        
        datesSet: function(info) {
            if(titleEl) {
                titleEl.innerText = info.view.title.charAt(0).toUpperCase() + info.view.title.slice(1);
            }
            updateSideList(info.start, info.end);
        },

        dayCellDidMount: function(info) {
            const dateStr = info.date.toISOString().split('T')[0];
            const count = counts[dateStr] || 0;
            const cell = info.el;
            
            cell.style.backgroundColor = '';
            cell.classList.remove('day-busy', 'day-full');

            if (count >= 8) {
                cell.style.backgroundColor = '#fef2f2';
                cell.classList.add('day-full');
            } else if (count > 0) {
                cell.style.backgroundColor = '#fffbeb';
                cell.classList.add('day-busy');
            }
            
            // Adiciona atributo de data para facilitar o clique
            cell.setAttribute('data-date', dateStr);
        },

        dateClick: function(info) {
            if (info.jsEvent) {
                info.jsEvent.preventDefault();
                info.jsEvent.stopPropagation();
            }
            openDayPopover(info.dateStr, info.jsEvent);
        }
    });

    calendar.render();
    
    // Atualiza título inicial
    if (titleEl) {
        titleEl.innerText = calendar.view.title.charAt(0).toUpperCase() + calendar.view.title.slice(1);
    }
    
    // Atualiza lista lateral
    updateSideList(calendar.view.activeStart, calendar.view.activeEnd);
}

function initPopoverListeners() {
    // Fecha popover ao clicar fora
    document.addEventListener('click', function(e) {
        const popover = document.getElementById('day-popover');
        
        if (popover && !popover.classList.contains('hidden')) {
            // Se o clique NÃO foi no popover E NÃO foi em um dia do calendário
            const clickedOnPopover = popover.contains(e.target);
            const clickedOnCalendarDay = e.target.closest('.fc-daygrid-day');
            
            if (!clickedOnPopover && !clickedOnCalendarDay) {
                closePopover();
            }
        }
    });
    
    // Previne que cliques dentro do popover fechem ele
    const popoverElement = document.getElementById('day-popover');
    if (popoverElement) {
        popoverElement.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
}

function updateSideList(startDate, endDate) {
    const listEl = document.getElementById('month-list');
    if(!listEl) return;
    listEl.innerHTML = '';

    const visible = hearings.filter(h => {
        if(!h.date) return false;
        const d = new Date(h.date + 'T00:00:00');
        return d >= startDate && d < endDate;
    }).sort((a,b) => {
        const timeA = a.time || '00:00';
        const timeB = b.time || '00:00';
        return new Date(a.date+'T'+timeA) - new Date(b.date+'T'+timeB);
    });

    if (visible.length === 0) {
        listEl.innerHTML = `<div class="text-center py-10 text-slate-400 text-sm">Sem agendamentos.</div>`;
        return;
    }

    visible.forEach(h => {
        const [year, month, day] = h.date.split('-');
        const dObj = new Date(year, month - 1, day);
        
        const dayNum = dObj.getDate();
        const monthName = dObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.','');
        
        const isDone = h.status === 'realizada';
        const opacityClass = isDone ? 'opacity-60 grayscale' : '';
        const iconStatus = isDone ? '<i class="fas fa-check-circle text-emerald-500 ml-2"></i>' : '';
        
        let border = 'border-slate-400';
        if(h.type === 'Investigado') border = 'border-rose-500';
        if(h.type === 'Vítima') border = 'border-amber-500';
        if(isDone) border = 'border-emerald-500';

        const item = document.createElement('div');
        item.className = `bg-white p-3 rounded-xl border-l-4 ${border} shadow-sm hover:shadow-md transition-all border-y border-r border-slate-50 cursor-pointer group mb-2 ${opacityClass}`;
        item.onclick = () => editHearing(h.id);

        item.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="flex flex-col items-center justify-center bg-slate-50 min-w-[3rem] py-2 rounded-lg border border-slate-100">
                    <span class="text-lg font-bold text-slate-700 leading-none">${dayNum}</span>
                    <span class="text-[10px] uppercase font-bold text-slate-400 mt-1">${monthName}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between">
                        <h4 class="font-bold text-slate-800 text-sm truncate pr-2 flex items-center">
                            ${h.name} ${iconStatus}
                        </h4>
                        <span class="text-[10px] bg-slate-100 text-slate-500 px-1 rounded">${h.time}</span>
                    </div>
                    <div class="text-xs text-slate-500 mt-1 truncate">${h.proc || 'S/N'}</div>
                </div>
            </div>
        `;
        listEl.appendChild(item);
    });
}

function openDayPopover(dateStr, jsEvent) {
    const popover = document.getElementById('day-popover');
    const title = document.getElementById('popover-date');
    const list = document.getElementById('popover-list');
    const emptyState = document.getElementById('popover-empty');
    const btnAdd = document.getElementById('btn-add-on-date');
    
    if(!popover) {
        console.error('Popover não encontrado!');
        return;
    }

    const [year, month, day] = dateStr.split('-');
    const localDate = new Date(year, month - 1, day);
    
    const dataFormatada = localDate.toLocaleDateString('pt-BR', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long' 
    });
    
    title.innerText = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);
    
    btnAdd.onclick = () => {
        closePopover();
        openNewHearingModal(dateStr);
    };

    const dailyHearings = hearings.filter(h => h.date === dateStr)
        .sort((a,b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
    
    list.innerHTML = '';
    if (dailyHearings.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        dailyHearings.forEach(h => {
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-100 group';
            item.onclick = () => { 
                editHearing(h.id); 
                closePopover(); 
            };
            
            const isDone = h.status === 'realizada';
            const doneIcon = isDone ? '<i class="fas fa-check-circle text-emerald-500 ml-1 text-xs"></i>' : '';
            
            item.innerHTML = `
                <div class="flex items-center gap-3">
                    <span class="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-100">
                        ${h.time || '--:--'}
                    </span>
                    <div class="leading-tight">
                        <div class="text-xs font-bold text-slate-700 flex items-center">
                            ${h.name || 'Sem nome'} ${doneIcon}
                        </div>
                        <div class="text-[10px] text-slate-400">${h.type || 'Sem tipo'}</div>
                    </div>
                </div>
                <i class="fas fa-chevron-right text-[10px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"></i>
            `;
            list.appendChild(item);
        });
    }

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    
    let left = jsEvent.clientX + 10;
    let top = jsEvent.clientY + 10;
    
    if (left + 320 > screenW) {
        left = jsEvent.clientX - 330;
    }
    
    if (top + 200 > screenH) {
        top = jsEvent.clientY - 210;
    }

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;

    popover.classList.remove('hidden');
    setTimeout(() => {
        popover.classList.remove('opacity-0', 'scale-95');
        popover.classList.add('opacity-100', 'scale-100');
    }, 10);
}

function closePopover() {
    const popover = document.getElementById('day-popover');
    if(!popover) return;
    
    popover.classList.remove('opacity-100', 'scale-100');
    popover.classList.add('opacity-0', 'scale-95');
    setTimeout(() => popover.classList.add('hidden'), 200);
}

// =======================================================
// 6. BUSCA GLOBAL INTELIGENTE
// =======================================================
const searchInput = document.getElementById('global-search');
const searchDropdown = document.getElementById('search-dropdown');
const suggestionsList = document.getElementById('search-suggestions-list');
const btnClear = document.getElementById('btn-clear-search');

if(searchInput) {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        if(term.length > 0) btnClear.classList.remove('hidden');
        else btnClear.classList.add('hidden');

        if (term.length < 2) {
            searchDropdown.classList.add('hidden');
            if (term.length === 0) renderHearingsPage(hearings);
            return;
        }

        const matches = hearings.filter(h => filterHearing(h, term));
        renderSuggestions(matches, term);
        renderHearingsPage(matches, term);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            searchDropdown.classList.add('hidden');
            const term = e.target.value.toLowerCase().trim();
            const matches = hearings.filter(h => filterHearing(h, term));
            renderHearingsPage(matches, term);
            
            const reports = document.getElementById('hearings-view');
            if(reports) {
                reports.classList.remove('hidden');
                reports.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });
}

function forceSearch() {
    const term = searchInput.value.toLowerCase().trim();
    const matches = hearings.filter(h => filterHearing(h, term));
    renderHearingsPage(matches, term);
    const reports = document.getElementById('hearings-view');
    if(reports) {
        reports.classList.remove('hidden');
        reports.scrollIntoView({ behavior: 'smooth' });
    }
}

function filterHearing(h, term) {
    const cleanTerm = term.replace(/[^a-z0-9]/g, '');
    const name = (h.name || '').toLowerCase();
    const proc = (h.proc || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const phone = (h.phone || '').replace(/[^0-9]/g, '');
    const del = (h.delegate || '').toLowerCase();
    return name.includes(term) || proc.includes(cleanTerm) || phone.includes(cleanTerm) || del.includes(term);
}

function renderSuggestions(matches, term) {
    suggestionsList.innerHTML = '';
    if (matches.length === 0) {
        suggestionsList.innerHTML = `<div class="p-4 text-center text-slate-400 text-sm">Nada encontrado.</div>`;
    } else {
        matches.slice(0, 5).forEach(h => {
            const div = document.createElement('div');
            div.className = 'p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 transition-colors';
            div.onclick = () => {
                searchInput.value = h.name;
                searchDropdown.classList.add('hidden');
                renderHearingsPage([h], h.name.toLowerCase());
                const reports = document.getElementById('hearings-view');
                if(reports) {
                    reports.classList.remove('hidden');
                    reports.scrollIntoView({ behavior: 'smooth' });
                }
            };
            
            const isDone = h.status === 'realizada';
            const icon = isDone ? '<i class="fas fa-check-circle text-emerald-500 ml-1"></i>' : '';
            
            div.innerHTML = `
                <div class="flex justify-between">
                    <div class="font-bold text-slate-700 text-sm">${highlightText(h.name, term)} ${icon}</div>
                    <span class="text-[10px] text-slate-400">${new Date(h.date).toLocaleDateString('pt-BR')}</span>
                </div>
                <div class="text-[10px] text-slate-400">${h.proc ? 'IP: '+highlightText(h.proc, term) : 'Sem IP'}</div>
            `;
            suggestionsList.appendChild(div);
        });
    }
    searchDropdown.classList.remove('hidden');
}

function clearSearch() {
    searchInput.value = '';
    searchDropdown.classList.add('hidden');
    renderHearingsPage(hearings);
    btnClear.classList.add('hidden');
}

function highlightText(text, term) {
    if (!text || !term) return text || '';
    const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safeTerm})`, 'gi');
    return text.toString().replace(regex, '<span class="highlight-term">$1</span>');
}

// =======================================================
// 7. RELATÓRIOS (ACCORDION)
// =======================================================
function renderHearingsPage(dataset = null, searchTerm = '') {
    const dataToRender = dataset || hearings;
    
    const parentSection = document.getElementById('hearings-view');
    const container = document.getElementById('reports-container');
    
    if (!container) return;
    if (parentSection) parentSection.classList.remove('hidden');

    container.innerHTML = '';

    if (dataToRender.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">Nenhum registro encontrado.</div>`;
        return;
    }

    const groups = {};
    dataToRender.forEach(h => {
        if(!h.date) return;
        const key = h.date.substring(0, 7);
        if (!groups[key]) groups[key] = [];
        groups[key].push(h);
    });

    Object.keys(groups).sort().forEach((key, idx) => {
        const [year, month] = key.split('-');
        const nomeMes = new Date(year, month - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        const nomeMesCap = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
        
        const isOpen = (searchTerm || idx === 0) ? 'open' : '';
        const border = searchTerm ? 'border-l-4 border-l-amber-500' : 'border border-slate-200';
        
        const list = groups[key].sort((a,b) => {
            const timeA = a.time || '00:00';
            const timeB = b.time || '00:00';
            return new Date(a.date+'T'+timeA) - new Date(b.date+'T'+timeB);
        });

        const html = `
            <details class="group bg-white rounded-xl shadow-sm ${border} overflow-hidden mb-4" ${isOpen}>
                <summary class="flex justify-between items-center p-4 cursor-pointer bg-slate-50 hover:bg-slate-100 select-none">
                    <span class="font-bold text-slate-700 text-lg capitalize">${nomeMesCap}</span>
                    <span class="bg-slate-200 text-slate-600 text-xs font-bold px-3 py-1 rounded-full">${list.length}</span>
                </summary>
                <div class="p-0 border-t border-slate-100">
                    <table class="w-full text-sm text-left">
                        <tbody class="divide-y divide-slate-100">
                            ${list.map(h => {
                                const isDone = h.status === 'realizada';
                                const rowOpacity = isDone ? 'opacity-50 bg-slate-50' : 'hover:bg-slate-50';
                                const iconDone = isDone ? '<i class="fas fa-check-circle text-emerald-500 ml-2" title="Realizada"></i>' : '';
                                const textDecoration = isDone ? 'line-through text-slate-400' : 'text-slate-700';
                                
                                return `
                                <tr class="${rowOpacity} transition-colors">
                                    <td class="px-4 py-3 whitespace-nowrap">
                                        <div class="font-bold text-slate-800">${new Date(h.date).toLocaleDateString('pt-BR')}</div>
                                        <div class="text-xs text-slate-500">${h.time}</div>
                                    </td>
                                    <td class="px-4 py-3">
                                        <div class="font-bold ${textDecoration}">${highlightText(h.name, searchTerm)} ${iconDone}</div>
                                        <div class="text-xs text-slate-500">${h.phone ? highlightText(h.phone, searchTerm) : ''}</div>
                                    </td>
                                    <td class="px-4 py-3 hidden md:table-cell text-xs text-slate-500">
                                        ${highlightText(h.proc || 'S/N', searchTerm)}
                                        ${h.delegate ? `<div class="mt-1 text-slate-400">${highlightText(h.delegate, searchTerm)}</div>` : ''}
                                    </td>
                                    <td class="px-4 py-3 text-right">
                                        <button onclick="editHearing('${h.id}')" class="text-indigo-600 p-2 hover:bg-indigo-50 rounded"><i class="fas fa-edit"></i></button>
                                        <button onclick="deleteHearing('${h.id}')" class="text-red-500 p-2 hover:bg-red-50 rounded"><i class="fas fa-trash"></i></button>
                                    </td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </details>
        `;
        container.innerHTML += html;
    });
}

// =======================================================
// 8. AÇÕES CRUD (SALVAR, EDITAR, EXCLUIR)
// =======================================================
const formHearing = document.getElementById('form-hearing');
if(formHearing) {
    formHearing.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Verifica se tem unidade selecionada
        if (!currentUnit) {
            showToast('Nenhuma unidade selecionada!', 'error');
            return;
        }
        
        const id = document.getElementById('h-id').value;
        const checkStatus = document.getElementById('h-status'); 
        
        const data = {
            name: document.getElementById('h-name').value,
            phone: document.getElementById('h-phone').value,
            type: document.getElementById('h-type').value,
            date: document.getElementById('h-date').value,
            time: document.getElementById('h-time').value,
            mode: document.getElementById('h-mode').value,
            proc: document.getElementById('h-proc').value,
            delegate: document.getElementById('h-delegate').value,
            agent: document.getElementById('h-agent').value,
            obs: document.getElementById('h-obs').value,
            status: checkStatus && checkStatus.checked ? 'realizada' : 'pendente', 
            unit: currentUserEmail, // Salva qual unidade criou
            updatedAt: new Date().toISOString()
        };

        const btn = formHearing.querySelector('button[type="submit"]');
        const oldText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
        btn.disabled = true;

        try {
            if (id) {
                // Atualiza existente
                await getUnitRef(`hearings/${id}`).update(data);
            } else {
                // Novo registro
                data.createdAt = new Date().toISOString();
                data.createdBy = currentUserEmail;
                await getUnitRef('hearings').push(data);
            }
            
            showToast('Salvo com sucesso!', 'success');
            closeModal('modal-hearing');
            
            // Recarrega os dados
            await loadHearings();
            renderHearingsPage();
            renderCalendar();
            
        } catch (error) {
            console.error(error);
            showToast('Erro ao salvar.', 'error');
        } finally {
            btn.innerHTML = oldText;
            btn.disabled = false;
        }
    });
}

// DECLARAMOS NO WINDOW PARA GARANTIR QUE O HTML ENCONTRE AS FUNÇÕES
window.openNewHearingModal = function(dateStr) {
    const form = document.getElementById('form-hearing');
    if(form) form.reset();
    document.getElementById('h-id').value = '';
    
    const checkStatus = document.getElementById('h-status');
    if(checkStatus) checkStatus.checked = false;

    if(dateStr && typeof dateStr === 'string') {
        document.getElementById('h-date').value = dateStr;
        console.log('Data definida no modal:', dateStr);
    } else {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        document.getElementById('h-date').value = `${year}-${month}-${day}`;
    }
    
    document.getElementById('h-time').value = '10:00';
    
    const m = document.getElementById('modal-hearing');
    if(m) {
        m.classList.remove('hidden');
        m.classList.add('flex');
    }
}

window.editHearing = function(id) {
    const h = hearings.find(x => x.id === id);
    if (!h) return;
    
    document.getElementById('h-id').value = h.id;
    document.getElementById('h-name').value = h.name;
    document.getElementById('h-phone').value = h.phone || '';
    document.getElementById('h-type').value = h.type;
    document.getElementById('h-date').value = h.date;
    document.getElementById('h-time').value = h.time;
    document.getElementById('h-mode').value = h.mode || 'Presencial';
    document.getElementById('h-proc').value = h.proc || '';
    document.getElementById('h-delegate').value = h.delegate || '';
    document.getElementById('h-agent').value = h.agent || '';
    document.getElementById('h-obs').value = h.obs || '';
    
    const checkStatus = document.getElementById('h-status');
    if(checkStatus) checkStatus.checked = (h.status === 'realizada');

    const m = document.getElementById('modal-hearing');
    if(m) {
        m.classList.remove('hidden');
        m.classList.add('flex');
    }
}

window.deleteHearing = async function(id) {
    if(confirm('Tem certeza que deseja excluir?')) {
        try {
            await getUnitRef(`hearings/${id}`).remove();
            showToast('Registro excluído.', 'success');
            await loadHearings();
            renderHearingsPage();
            renderCalendar();
        } catch(e) { 
            showToast('Erro ao excluir', 'error'); 
        }
    }
}

window.closeModal = function(id) {
    const m = document.getElementById(id);
    if(m) { 
        m.classList.add('hidden'); 
        m.classList.remove('flex'); 
    }
}

function showToast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    if(!c) return alert(msg);
    const t = document.createElement('div');
    let color = 'bg-slate-800';
    if(type === 'success') color = 'bg-emerald-600';
    if(type === 'error') color = 'bg-rose-600';
    
    t.className = `${color} text-white px-6 py-3 rounded-lg shadow-lg mb-3 animate-fade-in`;
    t.innerText = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function showLoginScreen(show) {
    const l = document.getElementById('login-screen');
    const a = document.getElementById('app-content');
    if(show) {
        if(l) l.classList.remove('hidden');
        if(a) a.classList.add('hidden');
    } else {
        if(l) l.classList.add('hidden');
        if(a) a.classList.remove('hidden');
    }
}

// Exporta funções para o HTML
window.closePopover = closePopover;
window.calendar = {
    prev: () => calendar?.prev(),
    today: () => calendar?.today(),
    next: () => calendar?.next()
};