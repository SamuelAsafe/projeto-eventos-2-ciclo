/*
 * Camada de acesso ao Supabase Auth.
 * Não manipula DOM; apenas retorna dados ou erros normalizados.
 */
const authService = (function () {
    "use strict";

    const auth = () => window.supabaseClient.auth;

    return Object.freeze({
        /**
         * Login com e-mail e senha.
         * @returns {Promise<{ user: object|null, error: Error|null }>}
         */
        async signIn(email, password) {
            const { data, error } = await auth().signInWithPassword({ email, password });
            return { user: data?.user ?? null, error };
        },

        /**
         * Encerra a sessão.
         * @param {"local"|"global"|"others"} scope "local" = só este navegador (padrão do painel)
         */
        async signOut(scope = "local") {
            const { error } = await auth().signOut({ scope });
            return { error };
        },

        /**
         * Sessão salva localmente (rápido, sem rede).
         * NÃO usar sozinho para autorizar: o token pode estar revogado.
         */
        async getSession() {
            const { data, error } = await auth().getSession();
            return { session: data?.session ?? null, error };
        },

        /** Valida o token no servidor do Supabase e retorna o usuário. */
        async getUser() {
            const { data, error } = await auth().getUser();
            return { user: data?.user ?? null, error };
        },

        /**
         * Observa mudanças de autenticação (login, logout, refresh de token).
         * @param {(event: string, session: object|null) => void} callback
         * @returns {() => void} função para cancelar a inscrição
         */
        onAuthChange(callback) {
            const { data } = auth().onAuthStateChange(callback);
            return () => data.subscription.unsubscribe();
        }
    });
})();
