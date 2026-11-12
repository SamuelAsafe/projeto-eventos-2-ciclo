/*
 * Acesso à tabela `categorias`.
 */
const categoriasService = (function () {
    "use strict";

    const TABLE = "categorias";

    return Object.freeze({
        /** @returns {Promise<Array<{ id: number, nome: string }>>} */
        async list() {
            const { data, error } = await window.supabaseClient
                .from(TABLE)
                .select("id, nome")
                .order("nome", { ascending: true });

            if (error) throw error;
            return data ?? [];
        }
    });
})();
