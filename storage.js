// ================================================
// STORAGE - COMPRESSÃO GZIP + UPLOAD/DOWNLOAD
// ================================================

/**
 * Comprime um ArrayBuffer usando GZIP nível máximo (9)
 * Retorna o menor resultado entre original e comprimido
 */
function compressData(arrayBuffer) {
    const originalBytes = new Uint8Array(arrayBuffer);

    try {
        const compressed = pako.gzip(originalBytes, { level: 9 });

        // Usa comprimido SOMENTE se for menor que o original
        if (compressed.length < originalBytes.length) {
            return {
                data: compressed,
                isCompressed: true,
                originalSize: originalBytes.length,
                compressedSize: compressed.length
            };
        }
    } catch (e) {
        console.warn('[Vault] Compressão falhou, enviando original:', e.message);
    }

    // Fallback: envia original se compressão não ajudar
    return {
        data: originalBytes,
        isCompressed: false,
        originalSize: originalBytes.length,
        compressedSize: originalBytes.length
    };
}

/**
 * Descomprime dados GZIP de volta ao original
 */
function decompressData(compressedBuffer) {
    try {
        const bytes = new Uint8Array(compressedBuffer);
        return pako.ungzip(bytes);
    } catch (e) {
        console.warn('[Vault] Descompressão falhou, retornando raw:', e.message);
        return new Uint8Array(compressedBuffer);
    }
}

/**
 * Obtém extensão do arquivo
 */
function getFileExtension(filename) {
    return filename.split('.').pop().toLowerCase();
}

/**
 * Valida o arquivo antes do upload
 */
function validateFile(file) {
    const ext = getFileExtension(file.name);

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        throw new Error(`Tipo .${ext} não permitido. Aceitos: ${ALLOWED_EXTENSIONS.join(', ')}`);
    }

    if (file.size > MAX_FILE_SIZE) {
        const maxMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
        throw new Error(`Arquivo muito grande. Máximo: ${maxMB}MB`);
    }

    if (file.size === 0) {
        throw new Error('Arquivo está vazio.');
    }

    return true;
}

/**
 * Upload de arquivo com compressão GZIP
 */
async function uploadFile(file, userId) {
    // Valida arquivo
    validateFile(file);

    // Lê o arquivo como ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Comprime com GZIP nível 9
    const compressed = compressData(arrayBuffer);

    // Gera path único: userId/timestamp_nomeArquivo.gz
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${userId}/${timestamp}_${safeName}.gz`;

    // Cria blob para upload
    const uploadBlob = new Blob([compressed.data], { type: 'application/gzip' });

    // Upload para o Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, uploadBlob, {
            cacheControl: '3600',
            upsert: false,
            contentType: 'application/gzip'
        });

    if (uploadError) throw uploadError;

    // Calcula economia
    const ratio = compressed.originalSize > 0
        ? ((1 - compressed.compressedSize / compressed.originalSize) * 100).toFixed(1)
        : 0;

    // Salva metadados no banco
    const { data: docData, error: docError } = await supabase
        .from(TABLE_NAME)
        .insert({
            user_id: userId,
            file_name: file.name,
            original_size: compressed.originalSize,
            compressed_size: compressed.compressedSize,
            compression_ratio: parseFloat(ratio),
            mime_type: file.type || 'application/octet-stream',
            storage_path: storagePath
        })
        .select()
        .single();

    if (docError) throw docError;

    return {
        ...docData,
        savings: ratio
    };
}

/**
 * Download de arquivo com descompressão automática
 */
async function downloadFile(doc) {
    // Baixa do Supabase Storage
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .download(doc.storage_path);

    if (error) throw error;

    // Descomprime para o formato original
    const compressedBuffer = await data.arrayBuffer();
    const originalBytes = decompressData(compressedBuffer);

    // Cria blob com o MIME type original
    const blob = new Blob([originalBytes], { type: doc.mime_type });

    // Dispara download no navegador
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = doc.file_name;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    // Limpa memória
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Deleta um documento (storage + banco)
 */
async function deleteDocument(doc) {
    if (!confirm(`⚠️ Tem certeza que deseja excluir "${doc.file_name}"?\n\nEsta ação não pode ser desfeita.`)) {
        return false;
    }

    // Remove do Storage
    const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([doc.storage_path]);

    if (storageError) throw storageError;

    // Remove do banco
    const { error: dbError } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq('id', doc.id);

    if (dbError) throw dbError;

    return true;
}

/**
 * Lista todos os documentos do usuário (ordenados por data)
 */
async function listDocuments(userId) {
    const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}
