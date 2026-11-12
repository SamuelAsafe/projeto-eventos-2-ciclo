/*
 * Acesso à tabela `categorias` (id, created_at, nome, slug, cor).
 * Funções lançam o erro do Supabase; a camada de UI decide como exibir.
 */
const categoriasService = (function () {
    "use strict";

    const TABLE = "categorias";

    // Códigos de erro do Postgres repassados pelo Supabase.
    const ERROR_CODES = Object.freeze({
        UNIQUE_VIOLATION: "23505",      // ex.: slug duplicado (se houver índice único)
        FOREIGN_KEY_VIOLATION: "23503"  // ex.: excluir categoria com eventos vinculados
    });

    return Object.freeze({
        ERROR_CODES,

        /** Lista enxuta para selects (ex.: formulário de eventos). */
        async list() {
            const { data, error } = await window.supabaseClient
                .from(TABLE)
                .select("id, nome")
                .order("nome", { ascending: true });

            if (error) throw error;
            return data ?? [];
        },

        /**
         * Lista completa para a tela de categorias, com total de eventos vinculados.
         * @returns {Promise<Array<{ id, nome, slug, cor, totalEventos: number }>>}
         */
        async listWithEventCount() {
            const { data, error } = await window.supabaseClient
                .from(TABLE)
                .select("id, nome, slug, cor, eventos(count)")
                .order("nome", { ascending: true });

            if (error) throw error;

            return (data ?? []).map(({ eventos, ...categoria }) => ({
                ...categoria,
                totalEventos: eventos?.[0]?.count ?? 0
            }));
        },

        async getById(id) {
            const { data, error } = await window.supabaseClient
                .from(TABLE)
                .select("id, nome, slug, cor")
                .eq("id", id)
                .single();

            if (error) throw error;
            return data;
        },

        async create(payload) {
            const { data, error } = await window.supabaseClient
                .from(TABLE)
                .insert(payload)
                .select("id")
                .single();

            if (error) throw error;
            return data;
        },

        async update(id, payload) {
            const { data, error } = await window.supabaseClient
                .from(TABLE)
                .update(payload)
                .eq("id", id)
                .select("id")
                .single();

            if (error) throw error;
            return data;
        },

        async remove(id) {
            const { data, error } = await window.supabaseClient
                .from(TABLE)
                .delete()
                .eq("id", id)
                .select("id");

            if (error) throw error;
            // Sem erro e sem linhas = registro inexistente ou bloqueado pelo RLS.
            if (!data?.length) throw new Error("Nenhuma categoria foi excluída (inexistente ou sem permissão).");
        }
    });
})();
