// ================================================
// CONFIGURAÇÃO DO SUPABASE
// ================================================

// ⚠️ SUBSTITUA PELOS SEUS DADOS DO SUPABASE
const SUPABASE_URL = 'https://sb_publishable_3pTvvItTMwAZ40LIZm0CcQ_M0prM6Q-.supabase.co';   // ← Seu Project URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjZ3Bva2ttcXJxaWNkcHFnY2J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MzI0OTQsImV4cCI6MjA4ODEwODQ5NH0.mpI5lV1yWfagLMzzQoFN69gusWmTyiwKTWd111GNFDo';         // ← Sua anon/public key

// Inicializa o cliente Supabase com segurança
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce'  // Fluxo mais seguro para SPA
    }
});

// ================================================
// CONSTANTES GLOBAIS
// ================================================

// Tamanho máximo por arquivo (50 MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Tipos de arquivo aceitos
const ALLOWED_EXTENSIONS = [
    'pdf', 'doc', 'docx', 'txt', 'rtf',
    'xlsx', 'xls', 'csv',
    'json', 'xml',
    'png', 'jpg', 'jpeg', 'webp', 'gif',
    'zip', 'rar', '7z',
    'mp3', 'mp4', 'ogg', 'wav'
];

// Nome do bucket no Supabase Storage
const BUCKET_NAME = 'documents';

// Nome da tabela no banco
const TABLE_NAME = 'documents';
