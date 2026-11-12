/*
 * Cria o client único do Supabase usado por todo o painel.
 *
 * Depende de (nesta ordem):
 *   1. SDK supabase-js (UMD)     → window.supabase
 *   2. ../supabase-credentials.js → SUPABASE_URL, SUPABASE_ANON_KEY
 */
(function createSupabaseClient() {
    "use strict";

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
        throw new Error("[supabaseClient] SDK do Supabase não carregado. Verifique a tag <script> do supabase-js.");
    }

    if (typeof SUPABASE_URL !== "string" || typeof SUPABASE_ANON_KEY !== "string" || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error("[supabaseClient] Credenciais ausentes. Crie supabase-credentials.js a partir de supabase-credentials.example.js.");
    }

    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
        }
    });
})();
