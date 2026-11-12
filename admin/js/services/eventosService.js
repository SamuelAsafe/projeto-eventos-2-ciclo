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

        /** Lista enxuta para filtros/selects. */
        async listOptions() {
            const { data, error } = await window.supabaseClient
                .from(TABLE)
                .select("id, nome")
                .order("nome", { ascending: true });

            if (error) throw error;
            return data ?? [];
        },

        /** Evento completo para preencher o formulário de edição. */
        async getById(id) {
            const { data, error } = await window.supabaseClient
                .from(TABLE)
                .select(`id, nome, categoria_id, data, horario, local, endereco, responsavel,
                         vagas_totais, vagas_restantes, destaque, descricao`)
                .eq("id", id)
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
                .single(); // sem linha (RLS/inexistente) → erro, em vez de "sucesso" silencioso

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
