/*
 * Acesso à tabela `eventos`.
 * Funções lançam o erro do Supabase; a camada de UI decide como exibir.
 */
const eventosService = (function () {
    "use strict";

    const TABLE = "eventos";
    const LIST_COLUMNS = `
        id,
        nome,
        data,
        local,
        vagas_totais,
        vagas_restantes,
        categoria:categorias ( id, nome )
    `;

    return Object.freeze({
        async list() {
            const { data, error } = await window.supabaseClient
                .from(TABLE)
                .select(LIST_COLUMNS)
                .order("data", { ascending: true });

            if (error) throw error;
            return data ?? [];
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

        async remove(id) {
            const { data, error } = await window.supabaseClient
                .from(TABLE)
                .delete()
                .eq("id", id)
                .select("id");

            if (error) throw error;
            // Sem erro e sem linhas = registro inexistente ou bloqueado pelo RLS.
            if (!data?.length) throw new Error("Nenhum evento foi excluído (inexistente ou sem permissão).");
        }
    });
})();
