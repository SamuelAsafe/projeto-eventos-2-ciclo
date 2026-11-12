/*
 * Inscrições = tabela `eventos_participantes` (id, created_at, id_evento, id_participante),
 * com dados de `participantes` e `eventos` via relacionamento (FK).
 */
const inscricoesService = (function () {
    "use strict";

    const TABLE = "eventos_participantes";
    const LIST_COLUMNS = `
        id,
        created_at,
        participante:participantes ( id, nome, email, whatsapp ),
        evento:eventos ( id, nome )
    `;

    return Object.freeze({
        /**
         * Lista paginada, mais recentes primeiro.
         * @param {{ page: number, pageSize: number, eventoId?: string|number|null }} options
         * @returns {Promise<{ items: Array, total: number }>}
         */
        async list({ page, pageSize, eventoId = null }) {
            const { from, to } = pagination.toRange(page, pageSize);

            let query = window.supabaseClient
                .from(TABLE)
                .select(LIST_COLUMNS, { count: "exact" })
                .order("created_at", { ascending: false })
                .range(from, to);

            if (eventoId) query = query.eq("id_evento", eventoId);

            const { data, error, count } = await query;
            if (error) throw error;

            return { items: data ?? [], total: count ?? 0 };
        },

        /** Remove a inscrição (vínculo). O participante continua cadastrado. */
        async remove(id) {
            const { data, error } = await window.supabaseClient
                .from(TABLE)
                .delete()
                .eq("id", id)
                .select("id");

            if (error) throw error;
            if (!data?.length) throw new Error("Nenhuma inscrição foi removida (inexistente ou sem permissão).");
        }
    });
})();
