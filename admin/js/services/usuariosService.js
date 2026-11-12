/*
 * Usuários do painel = contas do Supabase Authentication.
 *
 * O navegador NÃO fala direto com auth.admin (exigiria a service_role key).
 * Todas as operações passam pela Edge Function `admin-users`
 * (supabase/functions/admin-users/index.ts), que valida a sessão de quem chama.
 */
const usuariosService = (function () {
    "use strict";

    const FUNCTION_NAME = "admin-users";

    /**
     * Chama a Edge Function e normaliza erros em `Error` com mensagem amigável
     * (a função responde `{ error: "mensagem" }` com status HTTP adequado).
     */
    async function call(action, payload = {}) {
        const { data, error } = await window.supabaseClient.functions.invoke(FUNCTION_NAME, {
            body: { action, ...payload }
        });

        if (!error) return data;

        let message = "Não foi possível completar a operação.";
        let status = error.context?.status;

        try {
            const body = await error.context?.json();
            if (body?.error) message = body.error;
        } catch {
            // resposta sem JSON (ex.: função não publicada / rede)
        }

        if (error.name === "FunctionsFetchError" || error.name === "FunctionsRelayError") {
            message = "Serviço de usuários indisponível. Verifique se a Edge Function 'admin-users' foi publicada.";
        }

        const normalized = new Error(message);
        normalized.status = status;
        normalized.cause = error;
        throw normalized;
    }

    return Object.freeze({
        /** @returns {Promise<{ items: Array, total: number }>} */
        list: ({ page, pageSize }) => call("list", { page, perPage: pageSize }),
        create: (usuario) => call("create", usuario),
        update: (id, usuario) => call("update", { id, ...usuario }),
        remove: (id) => call("delete", { id })
    });
})();
