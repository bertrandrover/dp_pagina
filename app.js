// =======================================================
// OITIVASPRO - SISTEMA DE GESTÃO (Versão Otimizada)
// =======================================================

/// --- VARIÁVEIS GLOBAIS ---
let hearings = [];
let calendar = null;
// OBS: A variável 'currentTenant' já vem do firebase-config.js, não declare ela aqui!

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
});

// --- AUTENTICAÇÃO ---
function initAuth() {
    // Monitora se o usuário está logado ou não
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentTenant = user.uid;
            
            // Verifica se é Admin (lógica mantida do seu arquivo original)
            if (user.email === 'admin@oitivaspro.com') {
                showToast('Modo Admin Ativado', 'success');
                // Se tiver função específica de admin, chamaria aqui
            }
            
            await initApp(); // Carrega o sistema
            showLoginScreen(false); // Esconde login e mostra App
        } else {
            showLoginScreen(true); // Mostra login e esconde App
        }
    });

    // Listener do Formulário de Login
    const loginForm = document.getElementById('form-login');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-pass').value;
            const btn = e.target.querySelector('button');
            const originalText = btn.innerHTML;

            try {
                // Feedback visual de carregamento
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Entrando...';
                btn.disabled = true;
                
                // Define persistência de sessão (fecha aba = desloga)
                await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
                await auth.signInWithEmailAndPassword(email, pass);
                
                // O onAuthStateChanged lá em cima vai assumir a partir daqui
            } catch (error) {
                console.error("Erro no Login:", error);
                
                let msg = 'Erro ao entrar. Verifique suas credenciais.';
                if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                    msg = 'E-mail ou senha incorretos.';
                } else if (error.code === 'auth/user-not-found') {
                    msg = 'Usuário não cadastrado.';
                } else if (error.code === 'auth/too-many-requests') {
                    msg = 'Muitas tentativas. Aguarde um pouco.';
                }
                
                showToast(msg, 'error');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }
}

// --- CORE DA APLICAÇÃO ---
async function initApp() {
    console.log("Iniciando carregamento do sistema...");
    try {
        // 1. Carrega dados do Firebase
        await loadHearings();
        
        // 2. Renderiza a lista de oitivas (Relatórios)
        renderHearingsPage();
        
        // 3. Renderiza o Calendário (com pequeno delay para o HTML estar pronto)
        setTimeout(() => {
            renderCalendar();
            updateTodayStats(); // Atualiza card de hoje
        }, 100);

    } catch (error) {
        console.error("Erro fatal na inicialização:", error);
        showToast("Erro ao carregar alguns dados.", "warning");
    }
}

// --- LÓGICA DE BUSCA GLOBAL ---
document.getElementById('global-search').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    
    // Se o campo estiver vazio, mostra tudo normal
    if (term === '') {
        renderHearingsPage(hearings); // Passa a lista completa
        // Se quiser, pode esconder a seção de relatórios se ela estiver oculta por padrão
        // document.getElementById('hearings-view').classList.add('hidden'); 
        return;
    }

    // Filtra a lista global
    const filtered = hearings.filter(h => 
        (h.name && h.name.toLowerCase().includes(term)) ||
        (h.proc && h.proc.toLowerCase().includes(term)) ||
        (h.phone && h.phone.includes(term)) ||
        (h.delegate && h.delegate.toLowerCase().includes(term))
    );

    // Garante que a seção de relatórios esteja visível para mostrar o resultado
    const reportsSection = document.getElementById('hearings-view');
    if(reportsSection) reportsSection.classList.remove('hidden');

    // Renderiza apenas os filtrados
    renderHearingsPage(filtered);
});

// --- CARREGAMENTO DE DADOS (FIREBASE) ---
async function loadHearings() {
    try {
        // Busca na referência do usuário atual
        const snapshot = await getTenantRef('hearings').once('value');
        hearings = []; // Limpa array local
        
        snapshot.forEach(child => {
            hearings.push({ id: child.key, ...child.val() });
        });
        
        console.log(`${hearings.length} oitivas carregadas.`);
    } catch (e) { 
        console.error("Erro ao baixar oitivas:", e); 
        hearings = []; 
    }
}

// --- CALENDÁRIO (LÓGICA VISUAL) ---
// --- CALENDÁRIO ATUALIZADO (Versão 2.0) ---
function renderCalendar() {
    const calendarEl = document.getElementById('calendar');
    const titleEl = document.getElementById('calendar-title'); // Elemento do título
    
    if (!calendarEl) return;
    if (calendar) calendar.destroy();

    const counts = {};
    hearings.forEach(h => {
        if (h.date) counts[h.date] = (counts[h.date] || 0) + 1;
    });

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'pt-br',
        headerToolbar: false, // Desligamos o padrão para usar o nosso customizado
        height: 'auto',
        
        // Eventos invisíveis (apenas para lógica)
        events: hearings.map(h => ({
            start: h.date,
            display: 'background',
            className: 'invisible'
        })),

        // 1. ATUALIZAÇÃO DO TÍTULO E LISTA LATERAL (O Pulo do Gato!)
        datesSet: function(info) {
            // Atualiza o texto do título (ex: "Fevereiro de 2026")
            if(titleEl) {
                // Pega o título nativo do FullCalendar que já vem traduzido
                titleEl.innerText = info.view.title; 
            }
            
            // Chama a função para preencher a lista lateral com as datas visíveis
            updateSideList(info.start, info.end);
        },

        // Pintura das Células (Igual anterior)
        dayCellDidMount: function(info) {
            const dateStr = info.date.toISOString().split('T')[0];
            const count = counts[dateStr] || 0;
            const cell = info.el;
            cell.style.backgroundColor = '';
            
            if (count >= 8) {
                cell.style.backgroundColor = '#fef2f2'; 
                cell.classList.add('day-full');
            } else if (count > 0) {
                cell.style.backgroundColor = '#fffbeb'; 
                cell.classList.add('day-busy');
            }
        },

        // Clique no dia (Popover)
        dateClick: function(info) {
            openDayPopover(info.dateStr, info.jsEvent);
        }
    });

    calendar.render();
}

// =======================================================
// LÓGICA DO POPOVER (MENU FLUTUANTE DE DIA)
// =======================================================

function openDayPopover(dateStr, jsEvent) {
    const popover = document.getElementById('day-popover');
    const title = document.getElementById('popover-date');
    const list = document.getElementById('popover-list');
    const emptyState = document.getElementById('popover-empty');
    const btnAdd = document.getElementById('btn-add-on-date');
    
    if(!popover) return;

    // 1. Configura Data e Botão
    const dataFormatada = new Date(dateStr).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
    title.innerText = dataFormatada;
    
    // Configura o botão para abrir modal já com a data
    btnAdd.onclick = () => {
        closePopover();
        openNewHearingModal(dateStr);
    };

    // 2. Filtra Oitivas APENAS do dia clicado
    const dailyHearings = hearings.filter(h => h.date === dateStr).sort((a,b) => a.time.localeCompare(b.time));
    
    // 3. Monta a Microlista
    list.innerHTML = '';
    if (dailyHearings.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        dailyHearings.forEach(h => {
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-100 group';
            item.onclick = () => { editHearing(h.id); closePopover(); };
            
            item.innerHTML = `
                <div class="flex items-center gap-3">
                    <span class="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-100">${h.time}</span>
                    <div class="leading-tight">
                        <div class="text-xs font-bold text-slate-700">${h.name}</div>
                        <div class="text-[10px] text-slate-400">${h.type}</div>
                    </div>
                </div>
                <i class="fas fa-chevron-right text-[10px] text-slate-300 opacity-0 group-hover:opacity-100"></i>
            `;
            list.appendChild(item);
        });
    }

    // 4. Posicionamento Inteligente (Mouse)
    // Evita que o popover saia da tela se clicar muito à direita ou embaixo
    const rect = jsEvent.target.getBoundingClientRect();
    const x = jsEvent.clientX;
    const y = jsEvent.clientY;
    
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    
    let left = x + 10;
    let top = y - 50;
    
    // Se estiver muito à direita, joga para esquerda
    if (x > screenW - 350) left = x - 330;
    // Se estiver muito embaixo, joga para cima
    if (y > screenH - 300) top = y - 250;

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;

    // 5. Exibe com animação
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

// Fecha ao clicar fora
document.addEventListener('click', (e) => {
    const popover = document.getElementById('day-popover');
    // Se o clique NÃO foi no popover E NÃO foi num dia do calendário
    if (popover && !popover.classList.contains('hidden')) {
        if (!e.target.closest('#day-popover') && !e.target.closest('.fc-daygrid-day')) {
            closePopover();
        }
    }
});

/// --- FUNÇÃO DA LISTA LATERAL (DIREITA) ---
function updateSideList(startDate, endDate) {
    const listEl = document.getElementById('month-list');
    if(!listEl) return;

    listEl.innerHTML = '';

    // Filtra oitivas que estão dentro do intervalo visualizado no calendário
    const visibleHearings = hearings.filter(h => {
        const hDate = new Date(h.date + 'T00:00:00'); // Garante hora zerada para comparar
        return hDate >= startDate && hDate < endDate;
    });

    // Ordena por data e hora
    visibleHearings.sort((a, b) => {
        return new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time);
    });

    if (visibleHearings.length === 0) {
        listEl.innerHTML = `
            <div class="flex flex-col items-center justify-center h-48 text-slate-400 opacity-60">
                <i class="far fa-calendar-times text-4xl mb-3"></i>
                <p class="text-sm font-medium">Sem agendamentos neste mês.</p>
            </div>
        `;
        return;
    }

    // Gera o HTML Minimalista e Elegante
    visibleHearings.forEach(h => {
        // Formata data (ex: 12 Fev)
        const day = new Date(h.date).getDate();
        const monthShort = new Date(h.date).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        
        // Define cor da borda lateral baseada no tipo
        let borderClass = 'border-indigo-500'; // Padrão
        if(h.type === 'Investigado') borderClass = 'border-rose-500';
        if(h.type === 'Vítima') borderClass = 'border-amber-500';

        const item = document.createElement('div');
        item.className = `bg-white p-3 rounded-xl border-l-4 ${borderClass} shadow-sm hover:shadow-md transition-all border-y border-r border-slate-50 cursor-pointer group`;
        item.onclick = () => editHearing(h.id); // Clicar abre edição

        item.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="flex flex-col items-center justify-center bg-slate-50 min-w-[3.5rem] py-2 rounded-lg border border-slate-100">
                    <span class="text-xl font-bold text-slate-700 leading-none">${day}</span>
                    <span class="text-[10px] uppercase font-bold text-slate-400 leading-none mt-1">${monthShort}</span>
                </div>

                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start">
                        <h4 class="font-bold text-slate-800 text-sm truncate pr-2">${h.name}</h4>
                        <span class="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">${h.time}</span>
                    </div>
                    
                    <div class="text-xs text-slate-500 mt-1 truncate">
                        <i class="fas fa-folder text-slate-300 mr-1"></i> ${h.proc || 'S/N'}
                    </div>
                    
                    <div class="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <i class="fas fa-user-shield text-[9px]"></i> 
                        <span class="truncate">${h.delegate || 'Sem delegado'}</span>
                    </div>
                </div>
                
                <div class="self-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <i class="fas fa-chevron-right text-slate-300"></i>
                </div>
            </div>
        `;
        listEl.appendChild(item);
    });
}

function closePopover() {
    const popover = document.getElementById('day-popover');
    if(!popover) return;
    
    popover.classList.remove('opacity-100', 'scale-100');
    popover.classList.add('opacity-0', 'scale-95');
    
    setTimeout(() => {
        popover.classList.add('hidden');
    }, 200); // Espera animação acabar
}

// Fecha o popover se clicar fora dele
document.addEventListener('click', (e) => {
    const popover = document.getElementById('day-popover');
    // Verifica se o clique NÃO foi dentro do popover e NÃO foi numa célula do calendário
    if (popover && !popover.classList.contains('hidden') && !e.target.closest('#day-popover') && !e.target.closest('.fc-daygrid-day')) {
        closePopover();
    }
});

// --- UI: RELATÓRIOS E LISTAS ---
// --- UI: RELATÓRIOS (Atualizada com Ordem Correta) ---
// Agora aceita um argumento 'dataset'. Se não for passado, usa 'hearings' global.
function renderHearingsPage(dataset = null) {
    const dataToRender = dataset || hearings;
    const container = document.getElementById('reports-container');
    
    if (!container) return;

    container.innerHTML = '';
    
    if (dataToRender.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <i class="fas fa-search text-2xl mb-2 opacity-50"></i>
                <p>Nenhum registro encontrado.</p>
            </div>
        `;
        return;
    }

    const groups = {};
    
    // Agrupa por Mês (YYYY-MM)
    dataToRender.forEach(h => {
        const key = h.date.substring(0, 7);
        if (!groups[key]) groups[key] = [];
        groups[key].push(h);
    });

    // ORDENAÇÃO DOS GRUPOS (MESES)
    // Antes estava .reverse(), agora tiramos para ficar Crescente (Fev -> Mar -> Abr)
    const sortedKeys = Object.keys(groups).sort(); 

    sortedKeys.forEach((key, idx) => {
        const [year, month] = key.split('-');
        const nomeMes = new Date(year, month - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        const nomeMesCap = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
        
        // Se for uma busca (dataset passado), abre todos os accordions para facilitar
        // Se for carregamento normal, abre só o primeiro (mês atual/próximo)
        const isOpen = (dataset !== null && dataset !== hearings) || idx === 0 ? 'open' : '';

        // Ordena as oitivas DENTRO do mês (Data mais próxima primeiro)
        const monthHearings = groups[key].sort((a,b) => {
            return new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time);
        });

        const html = `
            <details class="group bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4" ${isOpen}>
                <summary class="flex justify-between items-center p-4 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors select-none">
                    <div class="flex items-center gap-3">
                        <i class="far fa-calendar-check text-indigo-500"></i>
                        <span class="font-bold text-slate-700 text-lg capitalize">${nomeMesCap}</span>
                    </div>
                    <span class="bg-indigo-100 text-indigo-800 text-xs font-bold px-3 py-1 rounded-full">
                        ${monthHearings.length} registros
                    </span>
                </summary>
                
                <div class="p-0 border-t border-slate-100">
                    <table class="w-full text-sm text-left">
                        <thead class="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                            <tr>
                                <th class="px-4 py-3">Data</th>
                                <th class="px-4 py-3">Envolvido</th>
                                <th class="px-4 py-3 hidden md:table-cell">Procedimento</th>
                                <th class="px-4 py-3">Condição</th>
                                <th class="px-4 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${monthHearings.map(h => `
                                <tr class="hover:bg-slate-50 transition-colors">
                                    <td class="px-4 py-3 whitespace-nowrap">
                                        <div class="font-medium text-slate-800">${new Date(h.date).toLocaleDateString('pt-BR')}</div>
                                        <div class="text-xs text-slate-500 bg-slate-100 inline-block px-1 rounded">${h.time}</div>
                                    </td>
                                    <td class="px-4 py-3">
                                        <div class="font-bold text-slate-700">${h.name}</div>
                                        <div class="text-xs text-slate-500 flex items-center gap-1">
                                            ${h.phone ? `<i class="fab fa-whatsapp text-green-500"></i> ${h.phone}` : ''}
                                        </div>
                                    </td>
                                    <td class="px-4 py-3 hidden md:table-cell text-slate-500 text-xs">
                                        ${h.proc || '-'}
                                        ${h.delegate ? `<div class="mt-1 text-[10px] text-slate-400">Dr. ${h.delegate}</div>` : ''}
                                    </td>
                                    <td class="px-4 py-3">
                                        <span class="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${getBadgeColor(h.type)}">
                                            ${h.type}
                                        </span>
                                    </td>
                                    <td class="px-4 py-3 text-right">
                                        <button onclick="editHearing('${h.id}')" class="text-indigo-600 hover:bg-indigo-50 p-2 rounded transition-colors" title="Editar"><i class="fas fa-edit"></i></button>
                                        <button onclick="deleteHearing('${h.id}')" class="text-red-500 hover:bg-red-50 p-2 rounded transition-colors" title="Excluir"><i class="fas fa-trash"></i></button>
                                    </td>
                                </div>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </details>
        `;
        container.innerHTML += html;
    });
}

// Atualiza o card de "Oitivas de Hoje" no Dashboard
function updateTodayStats() {
    const todayDiv = document.getElementById('today-hearings');
    if (!todayDiv) return;

    const hoje = new Date().toISOString().split('T')[0];
    const todayHearings = hearings.filter(h => h.date === hoje).sort((a,b) => a.time.localeCompare(b.time));

    if (todayHearings.length === 0) {
        todayDiv.innerHTML = '<p class="text-slate-400 text-sm italic py-2">Nenhuma oitiva para hoje.</p>';
    } else {
        todayDiv.innerHTML = todayHearings.map(h => `
            <div class="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                <div class="flex items-center gap-3">
                    <div class="bg-white p-2 rounded text-indigo-600 font-bold text-xs shadow-sm">
                        ${h.time}
                    </div>
                    <div>
                        <div class="font-bold text-slate-800 text-sm">${h.name}</div>
                        <div class="text-xs text-slate-500">${h.type} • ${h.mode || 'Presencial'}</div>
                    </div>
                </div>
                <button onclick="editHearing('${h.id}')" class="text-indigo-400 hover:text-indigo-700"><i class="fas fa-pencil-alt"></i></button>
            </div>
        `).join('');
    }
}

// --- OPERAÇÕES CRUD (SALVAR/EDITAR/EXCLUIR) ---
const formHearing = document.getElementById('form-hearing');
if (formHearing) {
    formHearing.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Coleta dados
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
            updatedAt: new Date().toISOString()
        };
        
        const id = document.getElementById('h-id').value;
        const btn = formHearing.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;

        try {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            btn.disabled = true;

            if (id) {
                await getTenantRef(`hearings/${id}`).update(data);
                showToast('Atualizado com sucesso!', 'success');
            } else {
                data.createdAt = new Date().toISOString();
                await getTenantRef('hearings').push(data);
                showToast('Agendamento criado!', 'success');
            }
            
            closeModal('modal-hearing');
            
            // Recarrega dados e atualiza UI
            await loadHearings();
            renderHearingsPage();
            renderCalendar();
            updateTodayStats();
            
        } catch (error) {
            console.error(error);
            showToast('Erro ao salvar.', 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}

// --- MODAIS E UTILITÁRIOS ---
window.openNewHearingModal = function(dateStr) {
    const form = document.getElementById('form-hearing');
    if(form) form.reset();
    
    document.getElementById('h-id').value = '';
    
    // Se veio uma data do clique no calendário, preenche
    if (dateStr) document.getElementById('h-date').value = dateStr;
    
    toggleModal('modal-hearing', true);
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

    toggleModal('modal-hearing', true);
}

window.deleteHearing = async function(id) {
    if(confirm('Tem certeza que deseja excluir este agendamento?')) {
        try {
            await getTenantRef(`hearings/${id}`).remove();
            showToast('Excluído com sucesso.', 'success');
            await loadHearings();
            renderHearingsPage();
            renderCalendar();
            updateTodayStats();
        } catch (e) {
            console.error(e);
            showToast('Erro ao excluir.', 'error');
        }
    }
}

window.closeModal = function(id) {
    toggleModal(id, false);
}

function toggleModal(id, show) {
    const el = document.getElementById(id);
    if (!el) return;
    
    if (show) {
        el.classList.remove('hidden');
        el.classList.add('flex');
    } else {
        el.classList.add('hidden');
        el.classList.remove('flex');
    }
}

// --- HELPERS E FIREBASE ---
function getTenantRef(path) {
    if (!currentTenant) throw new Error("Usuário não autenticado.");
    // Caminho no DB: tenants/{UserID}/{path}
    return db.ref(`tenants/${currentTenant}/${path}`);
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    
    // Classes Tailwind para cores
    let colors = 'bg-slate-800 text-white';
    if (type === 'success') colors = 'bg-emerald-600 text-white';
    if (type === 'error') colors = 'bg-rose-600 text-white';
    if (type === 'warning') colors = 'bg-amber-500 text-white';

    toast.className = `${colors} px-6 py-3 rounded-lg shadow-xl mb-3 flex items-center gap-3 animate-fade-in transform transition-all`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span class="font-medium">${message}</span>
    `;

    container.appendChild(toast);

    // Remove após 3s
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Controle de Telas (Login vs App)
function showLoginScreen(show) {
    const loginEl = document.getElementById('login-screen');
    const appEl = document.getElementById('app-content');
    
    if (show) {
        if(loginEl) loginEl.classList.remove('hidden');
        if(appEl) appEl.classList.add('hidden');
    } else {
        if(loginEl) loginEl.classList.add('hidden');
        if(appEl) appEl.classList.remove('hidden');
        
        // Garante que o dashboard e relatórios estão visíveis
        const dashView = document.getElementById('dashboard-view');
        const reportView = document.getElementById('hearings-view');
        if(dashView) dashView.classList.remove('hidden');
        // Report view pode começar oculto ou visível, conforme sua preferência
        if(reportView) reportView.classList.remove('hidden'); 
    }
}

// Helper para cores das badges
function getBadgeColor(type) {
    const colors = {
        'Investigado': 'bg-rose-100 text-rose-700',
        'Vítima': 'bg-amber-100 text-amber-700',
        'Testemunha': 'bg-sky-100 text-sky-700',
        'Denunciante': 'bg-emerald-100 text-emerald-700'
    };
    return colors[type] || 'bg-slate-100 text-slate-700';
}