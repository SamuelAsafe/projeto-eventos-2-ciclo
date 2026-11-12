/*
 * Dados públicos do site (somente leitura + inscrição).
 * Lê `eventos` e `categorias` (SELECT público pelo RLS) e inscreve via a
 * função `inscrever_participante` (supabase/migrations/20261112000000_inscricao_publica.sql).
 */
const catalogoService = (function () {
    "use strict";

    const EVENT_COLUMNS = `
        id,
        nome,
        slug,
        data,
        horario,
        local,
        endereco,
        responsavel,
        vagas_totais,
        vagas_restantes,
        destaque,
        descricao,
        categoria:categorias ( id, nome, slug, cor )
    `;

    // Mensagens para os `hint` lançados pela função/trigger no banco.
    const INSCRICAO_ERRORS = Object.freeze({
        nome_invalido: { field: "nome", message: "Informe seu nome completo." },
        email_invalido: { field: "email", message: "Informe um e-mail válido." },
        documento_invalido: { field: "documento", message: "Informe um CPF válido." },
        whatsapp_invalido: { field: "whatsapp", message: "Informe um WhatsApp válido com DDD." },
        data_nascimento_invalida: { field: "data_nascimento", message: "Informe uma data de nascimento válida." },
        evento_nao_encontrado: { message: "Este evento não existe mais." },
        inscricoes_encerradas: { message: "As inscrições para este evento estão encerradas." },
        vagas_esgotadas: { message: "As vagas deste evento esgotaram." },
        ja_inscrito: { field: "email", message: "Este e-mail já está inscrito neste evento." }
    });

    return Object.freeze({
        async listEventos() {
            const { data, error } = await window.supabaseClient
                .from("eventos")
                .select(EVENT_COLUMNS)
                .order("data", { ascending: true });

            if (error) throw error;
            return data ?? [];
        },

        /** @returns {Promise<object|null>} null se não existir */
        async getEvento(id) {
            const { data, error } = await window.supabaseClient
                .from("eventos")
                .select(EVENT_COLUMNS)
                .eq("id", id)
                .maybeSingle();

            if (error) throw error;
            return data;
        },

        async listCategorias() {
            const { data, error } = await window.supabaseClient
                .from("categorias")
                .select("id, nome, slug, cor")
                .order("nome", { ascending: true });

            if (error) throw error;
            return data ?? [];
        },

        /**
         * Inscreve o participante no evento.
         * @returns {Promise<{ inscricaoId: number, codigo: string }>}
         * @throws {Error & { field?: string }} mensagem pronta para exibir
         */
        async inscrever(idEvento, dados) {
            const { data, error } = await window.supabaseClient.rpc("inscrever_participante", {
                p_id_evento: Number(idEvento),
                p_nome: dados.nome,
                p_email: dados.email,
                p_documento: dados.documento,
                p_data_nascimento: dados.data_nascimento,
                p_whatsapp: dados.whatsapp
            });

            if (error) {
                const known = INSCRICAO_ERRORS[error.hint];
                const friendly = new Error(known?.message ?? "Não foi possível concluir a inscrição. Tente novamente.");
                friendly.field = known?.field;
                friendly.cause = error;
                throw friendly;
            }

            const [row] = data ?? [];
            return { inscricaoId: row?.inscricao_id, codigo: row?.codigo };
        }
    });
})();
