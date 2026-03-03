// ================================================
// AUTENTICAÇÃO - SEGURANÇA FORTE
// ================================================

/**
 * Avalia a força da senha em uma escala de 0 a 5
 */
function evaluatePasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return Math.min(score, 5);
}

/**
 * Atualiza a barra visual de força da senha
 */
function updateStrengthBar(password) {
    const fill = document.getElementById('strength-fill');
    const text = document.getElementById('strength-text');

    if (!password || password.length === 0) {
        fill.style.width = '0%';
        fill.style.background = 'transparent';
        text.textContent = '';
        return;
    }

    const score = evaluatePasswordStrength(password);
    const levels = [
        { width: '5%',   color: '#ef4444', label: 'Muito fraca' },
        { width: '20%',  color: '#ef4444', label: 'Fraca' },
        { width: '40%',  color: '#f59e0b', label: 'Razoável' },
        { width: '60%',  color: '#3b82f6', label: 'Boa' },
        { width: '80%',  color: '#10b981', label: 'Forte' },
        { width: '100%', color: '#10b981', label: 'Excelente 💪' }
    ];

    fill.style.width = levels[score].width;
    fill.style.background = levels[score].color;
    text.textContent = levels[score].label;
    text.style.color = levels[score].color;
}

/**
 * Valida a senha com critérios rigorosos
 * Retorna array de erros (vazio se tudo OK)
 */
function validatePassword(password) {
    const errors = [];
    if (password.length < 8)          errors.push('mínimo 8 caracteres');
    if (!/[A-Z]/.test(password))      errors.push('uma letra maiúscula');
    if (!/[a-z]/.test(password))      errors.push('uma letra minúscula');
    if (!/[0-9]/.test(password))      errors.push('um número');
    if (!/[^A-Za-z0-9]/.test(password)) errors.push('um caractere especial (!@#$%&*)');
    return errors;
}

/**
 * Sanitiza string contra XSS
 */
function sanitizeInput(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Alterna visibilidade da senha
 */
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
}

/**
 * LOGIN
 */
async function handleLogin(e) {
    e.preventDefault();

    const btn = document.getElementById('login-btn');
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';

    const email = sanitizeInput(document.getElementById('login-email').value.trim());
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        errorEl.textContent = 'Preencha todos os campos.';
        return false;
    }

    btn.disabled = true;
    btn.textContent = 'Entrando...';

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        showToast('✅ Login realizado com sucesso!', 'success');
        showDashboard(data.user);

    } catch (err) {
        errorEl.textContent = translateAuthError(err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Entrar';
    }

    return false;
}

/**
 * REGISTRO
 */
async function handleRegister(e) {
    e.preventDefault();

    const btn = document.getElementById('register-btn');
    const errorEl = document.getElementById('register-error');
    const successEl = document.getElementById('register-success');
    errorEl.textContent = '';
    successEl.textContent = '';

    const email = sanitizeInput(document.getElementById('reg-email').value.trim());
    const password = document.getElementById('reg-password').value;
    const passwordConfirm = document.getElementById('reg-password-confirm').value;

    // Validação de senha forte
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
        errorEl.textContent = 'A senha precisa ter: ' + passwordErrors.join(', ') + '.';
        return false;
    }

    // Senhas coincidem?
    if (password !== passwordConfirm) {
        errorEl.textContent = 'As senhas não coincidem!';
        return false;
    }

    btn.disabled = true;
    btn.textContent = 'Criando conta...';

    try {
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                emailRedirectTo: window.location.origin
            }
        });

        if (error) throw error;

        if (data.user && data.user.identities && data.user.identities.length === 0) {
            errorEl.textContent = 'Este email já está cadastrado.';
        } else {
            successEl.textContent = '✅ Conta criada! Verifique seu email para confirmar o cadastro.';
            document.getElementById('register-form').reset();
            updateStrengthBar('');
        }

    } catch (err) {
        errorEl.textContent = translateAuthError(err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Criar Conta';
    }

    return false;
}

/**
 * LOGOUT
 */
async function handleLogout() {
    await supabase.auth.signOut();
    currentUser = null;
    documents = [];
    showAuth();
    showToast('👋 Sessão encerrada.', 'info');
}

/**
 * Traduz erros de autenticação do Supabase
 */
function translateAuthError(msg) {
    const map = {
        'Invalid login credentials':        'Email ou senha incorretos.',
        'Email not confirmed':              'Confirme seu email antes de entrar.',
        'User already registered':          'Este email já está cadastrado.',
        'Password should be at least':      'Senha muito curta.',
        'Email rate limit exceeded':        'Muitas tentativas. Aguarde alguns minutos.',
        'Too many requests':                'Muitas tentativas. Aguarde.',
        'Signup requires a valid password': 'Insira uma senha válida.',
        'Unable to validate email address': 'Email inválido.',
        'For security purposes':            'Muitas tentativas. Aguarde 60 segundos.'
    };

    for (const [key, value] of Object.entries(map)) {
        if (msg.includes(key)) return value;
    }
    return 'Erro: ' + msg;
}
