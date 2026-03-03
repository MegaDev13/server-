// ================================================
// APP.JS - LÓGICA PRINCIPAL DA APLICAÇÃO
// ================================================

// Estado global
let currentUser = null;
let documents = [];

// ================================================
// INICIALIZAÇÃO
// ================================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Verifica se já existe sessão ativa
        const { data: { session } } = await supabase.auth.getSession();

        if (session && session.user) {
            showDashboard(session.user);
        } else {
            showAuth();
        }
    } catch (err) {
        console.error('[Vault] Erro ao verificar sessão:', err);
        showAuth();
    }

    // Esconde loading screen
    hideLoading();

    // Escuta mudanças de autenticação
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            showDashboard(session.user);
        } else if (event === 'SIGNED_OUT') {
            showAuth();
        } else if (event === 'TOKEN_REFRESHED') {
            console.log('[Vault] Token renovado automaticamente.');
        }
    });

    // Configura drag & drop
    setupDragAndDrop();

    // Configura file input
    document.getElementById('file-input').addEventListener('change', handleFileSelect);

    // Configura barra de força da senha
    const regPassword = document.getElementById('reg-password');
    if (regPassword) {
        regPassword.addEventListener('input', (e) => updateStrengthBar(e.target.value));
    }
});

// ================================================
// NAVEGAÇÃO ENTRE TELAS
// ================================================
function hideLoading() {
    const loader = document.getElementById('loading-screen');
    if (loader) loader.classList.add('hidden');
}

function showAuth() {
    currentUser = null;
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('dashboard-section').classList.add('hidden');
}

function showDashboard(user) {
    currentUser = user;
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
    document.getElementById('user-email').textContent = user.email;
    loadDocuments();
}

function showTab(tab) {
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    // Limpa mensagens
    document.getElementById('login-error').textContent = '';
    document.getElementById('register-error').textContent = '';
    document.getElementById('register-success').textContent = '';

    if (tab === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    } else {
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
    }
}

// ================================================
// DRAG & DROP
// ================================================
function setupDragAndDrop() {
    const dropZone = document.getElementById('drop-zone');

    // Previne comportamento padrão do navegador
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    // Efeito visual ao arrastar sobre a zona
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('dragover');
        });
    });

    // Processa arquivos soltos
    dropZone.addEventListener('drop', (e) => {
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            processFiles(files);
        }
    });
}

// ================================================
// UPLOAD DE ARQUIVOS
// ================================================
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        processFiles(files);
    }
    e.target.value = ''; // Reset para permitir reenvio do mesmo arquivo
}

async function processFiles(files) {
    if (!currentUser) {
        showToast('❌ Sessão expirada. Faça login novamente.', 'error');
        return;
    }

    const progressContainer = document.getElementById('upload-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const progressPercent = document.getElementById('progress-percent');

    progressContainer.classList.remove('hidden');
    progressFill.style.width = '0%';

    let completed = 0;
    let successes = 0;
    const total = files.length;

    for (const file of files) {
        try {
            // Atualiza UI de progresso
            progressText.textContent = `Comprimindo: ${file.name} (${completed + 1}/${total})`;
            progressPercent.textContent = `${Math.round((completed / total) * 100)}%`;
            progressFill.style.width = `${(completed / total) * 100}%`;

            // Upload com compressão
            const result = await uploadFile(file, currentUser.id);

            successes++;
            completed++;

            // Atualiza barra
            progressFill.style.width = `${(completed / total) * 100}%`;
            progressPercent.textContent = `${Math.round((completed / total) * 100)}%`;

            showToast(`✅ ${file.name} — economia de ${result.savings}%`, 'success');

        } catch (err) {
            completed++;
            console.error(`[Vault] Erro em ${file.name}:`, err);
            showToast(`❌ ${file.name}: ${err.message}`, 'error');
        }
    }

    // Finaliza
    progressFill.style.width = '100%';
    progressPercent.textContent = '100%';
    progressText.textContent = `✅ ${successes}/${total} arquivo(s) enviado(s) com sucesso!`;

    setTimeout(() => {
        progressContainer.classList.add('hidden');
    }, 4000);

    // Atualiza lista
    loadDocuments();
}

// ================================================
// LISTAR DOCUMENTOS
// ================================================
async function loadDocuments() {
    if (!currentUser) return;

    try {
        documents = await listDocuments(currentUser.id);
        renderDocuments(documents);
        updateStats();
    } catch (err) {
        console.error('[Vault] Erro ao carregar documentos:', err);
        showToast('❌ Erro ao carregar documentos.', 'error');
    }
}

function renderDocuments(docs) {
    const container = document.getElementById('documents-container');

    if (!docs || docs.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhum documento encontrado. Faça seu primeiro upload! 🚀</p>';
        return;
    }

    container.innerHTML = docs.map(doc => `
        <div class="doc-item" data-id="${doc.id}">
            <div class="doc-info">
                <span class="doc-icon">${getFileIcon(doc.file_name, doc.mime_type)}</span>
                <div class="doc-details">
                    <h3 title="${escapeHtml(doc.file_name)}">${escapeHtml(doc.file_name)}</h3>
                    <div class="doc-meta">
                        <span>${formatSize(doc.original_size)} → ${formatSize(doc.compressed_size)}</span>
                        <span class="separator">·</span>
                        <span class="saved">-${doc.compression_ratio}%</span>
                        <span class="separator">·</span>
                        <span>${formatDate(doc.created_at)}</span>
                    </div>
                </div>
            </div>
            <div class="doc-actions">
                <button class="btn-icon" onclick="handleDownload('${doc.id}')" title="Baixar arquivo original">
                    ⬇️ Baixar
                </button>
                <button class="btn-icon danger" onclick="handleDelete('${doc.id}')" title="Excluir permanentemente">
                    🗑️
                </button>
            </div>
        </div>
    `).join('');
}

// ================================================
// BUSCA / FILTRO
// ================================================
function filterDocuments(query) {
    if (!query || query.trim() === '') {
        renderDocuments(documents);
        return;
    }

    const filtered = documents.filter(doc =>
        doc.file_name.toLowerCase().includes(query.toLowerCase())
    );

    renderDocuments(filtered);
}

// ================================================
// ESTATÍSTICAS
// ================================================
function updateStats() {
    const totalOriginal = documents.reduce((sum, d) => sum + (d.original_size || 0), 0);
    const totalCompressed = documents.reduce((sum, d) => sum + (d.compressed_size || 0), 0);
    const totalSaved = totalOriginal > 0
        ? ((1 - totalCompressed / totalOriginal) * 100).toFixed(1)
        : '0.0';

    document.getElementById('total-docs').textContent = documents.length;
    document.getElementById('total-original').textContent = formatSize(totalOriginal);
    document.getElementById('total-compressed').textContent = formatSize(totalCompressed);
    document.getElementById('total-saved').textContent = totalSaved + '%';
}

// ================================================
// AÇÕES: DOWNLOAD E DELETE
// ================================================
async function handleDownload(docId) {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    try {
        showToast('⬇️ Baixando e descomprimindo...', 'info');
        await downloadFile(doc);
        showToast(`✅ ${doc.file_name} baixado com sucesso!`, 'success');
    } catch (err) {
        console.error('[Vault] Erro no download:', err);
        showToast('❌ Erro no download: ' + err.message, 'error');
    }
}

async function handleDelete(docId) {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    try {
        const deleted = await deleteDocument(doc);
        if (deleted) {
            showToast('🗑️ Documento excluído com sucesso.', 'success');
            loadDocuments();
        }
    } catch (err) {
        console.error('[Vault] Erro ao excluir:', err);
        showToast('❌ Erro ao excluir: ' + err.message, 'error');
    }
}

// ================================================
// UTILITÁRIOS
// ================================================

/**
 * Formata bytes para unidade legível
 */
function formatSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
    return size + ' ' + units[i];
}

/**
 * Formata data para DD/MM/AA HH:MM
 */
function formatDate(dateStr) {
    try {
        return new Date(dateStr).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return dateStr;
    }
}

/**
 * Retorna ícone baseado no tipo de arquivo
 */
function getFileIcon(fileName, mimeType) {
    const ext = fileName.split('.').pop().toLowerCase();

    const iconMap = {
        // Documentos
        'pdf':  '📕',
        'doc':  '📘',
        'docx': '📘',
        'txt':  '📄',
        'rtf':  '📄',
        // Planilhas
        'xlsx': '📗',
        'xls':  '📗',
        'csv':  '📊',
        // Dados
        'json': '📋',
        'xml':  '📋',
        // Imagens
        'png':  '🖼️',
        'jpg':  '🖼️',
        'jpeg': '🖼️',
        'webp': '🖼️',
        'gif':  '🖼️',
        // Compactados
        'zip':  '📦',
        'rar':  '📦',
        '7z':   '📦',
        // Mídia
        'mp3':  '🎵',
        'mp4':  '🎬',
        'ogg':  '🎵',
        'wav':  '🎵'
    };

    return iconMap[ext] || '📄';
}

/**
 * Escapa HTML para prevenir XSS
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Mostra uma notificação toast
 */
function showToast(message, type = 'success') {
    // Cria container se não existir
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    // Remove após 4 segundos com animação
    setTimeout(() => {
        toast.classList.add('leaving');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
