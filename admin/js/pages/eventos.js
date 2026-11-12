/*
 * Página de eventos do painel (admin/eventos.html).
 * Depende de: eventosService, categoriasService, dom, text.
 */
(function eventosPage() {
    "use strict";

    const TABLE_COLUMNS = 6;

    const elements = {
        tableBody: document.getElementById("events"),
        form: document.getElementById("evento-form"),
        categorySelect: document.getElementById("campo-categoria"),
        submitButton: document.getElementById("salvar-evento"),
        feedback: document.getElementById("evento-feedback")
    };

    /* ---------- Validação declarativa ---------- */

    const asText = (input) => input.value.trim();
    const asInteger = (input) => (input.value === "" ? null : Number(input.value));

    const required = (message) => (value) =>
        value === null || value === "" ? message : null;

    const minLength = (size, message) => (value) =>
        typeof value === "string" && value.length < size ? message : null;

    const nonNegativeInteger = (message) => (value) =>
        value !== null && (!Number.isInteger(value) || value < 0) ? message : null;

    /**
     * Cada campo: id do input, chave enviada ao Supabase, como ler o valor
     * e regras (executadas em ordem; a primeira que falhar define a mensagem).
     * Regras recebem (valor, todosOsValores) para validações entre campos.
     */
    const FIELDS = [
        { id: "campo-titulo", key: "nome", read: asText,
          rules: [required("O nome é obrigatório"), minLength(3, "O nome deve ter ao menos 3 caracteres")] },
        { id: "campo-categoria", key: "categoria_id", read: asText,
          rules: [required("Selecione uma categoria")] },
        { id: "campo-data", key: "data", read: asText,
          rules: [required("A data é obrigatória")] },
        { id: "campo-horario", key: "horario", read: asText,
          rules: [required("O horário é obrigatório")] },
        { id: "campo-local", key: "local", read: asText,
          rules: [required("O local é obrigatório")] },
        { id: "campo-endereco", key: "endereco", read: asText,
          rules: [required("O endereço é obrigatório")] },
        { id: "campo-organizador", key: "responsavel", read: asText,
          rules: [required("O organizador é obrigatório")] },
        { id: "campo-vagas-totais", key: "vagas_totais", read: asInteger,
          rules: [required("Vagas totais é obrigatório"), nonNegativeInteger("Informe um número inteiro maior ou igual a 0")] },
        { id: "campo-vagas-restantes", key: "vagas_restantes", read: asInteger,
          rules: [
              required("Vagas restantes é obrigatório"),
              nonNegativeInteger("Informe um número inteiro maior ou igual a 0"),
              (value, values) => value !== null && values.vagas_totais !== null && value > values.vagas_totais
                  ? "Vagas restantes não pode ser maior que vagas totais"
                  : null
          ] },
        { id: "campo-destaque", key: "destaque", read: (input) => input.checked, rules: [] },
        { id: "campo-descricao", key: "descricao", read: asText,
          rules: [required("Descrição completa é obrigatória")] }
    ];

    /**
     * Lê e valida o formulário inteiro, exibindo todos os erros de uma vez.
     * @returns {object|null} payload pronto para inserir, ou null se inválido
     */
    function readForm() {
        const values = {};
        const inputs = {};

        FIELDS.forEach((field) => {
            inputs[field.key] = document.getElementById(field.id);
            values[field.key] = field.read(inputs[field.key]);
        });

        let firstInvalid = null;

        FIELDS.forEach((field) => {
            const input = inputs[field.key];
            const message = field.rules
                .map((rule) => rule(values[field.key], values))
                .find(Boolean);

            if (message) {
                dom.showFieldError(input, message);
                firstInvalid ??= input;
            } else {
                dom.clearFieldError(input);
            }
        });

        if (firstInvalid) {
            firstInvalid.focus();
            return null;
        }

        return { ...values, slug: text.slugify(values.nome) };
    }

    /* ---------- Tabela ---------- */

    function renderMessageRow(message) {
        elements.tableBody.innerHTML = `
            <tr><td colspan="${TABLE_COLUMNS}">${dom.escapeHtml(message)}</td></tr>
        `;
    }

    function rowTemplate(evento) {
        const id = dom.escapeHtml(evento.id);
        const nome = dom.escapeHtml(evento.nome);

        return `
            <tr>
                <td>${nome}</td>
                <td>${dom.escapeHtml(evento.categoria?.nome ?? "—")}</td>
                <td>${dom.escapeHtml(text.formatDate(evento.data))}</td>
                <td>${dom.escapeHtml(evento.local)}</td>
                <td>${dom.escapeHtml(evento.vagas_restantes)} / ${dom.escapeHtml(evento.vagas_totais)}</td>
                <td class="actions">
                    <a class="btn-sm btn-edit" href="inscritos.html?evento=${encodeURIComponent(evento.id)}">Ver inscritos</a>
                    <button type="button" class="btn-sm btn-edit" disabled title="Em breve">Editar</button>
                    <button type="button" class="btn-sm btn-delete" data-id="${id}" data-nome="${nome}">Excluir</button>
                </td>
            </tr>
        `;
    }

    async function loadEvents() {
        renderMessageRow("Carregando eventos...");

        try {
            const eventos = await eventosService.list();

            if (eventos.length === 0) {
                renderMessageRow("Nenhum evento cadastrado.");
                return;
            }

            elements.tableBody.innerHTML = eventos.map(rowTemplate).join("");
        } catch (error) {
            console.error("[eventos] Falha ao listar:", error);
            renderMessageRow("Não foi possível carregar os eventos.");
        }
    }

    async function loadCategories() {
        const placeholder = '<option value="" disabled selected>Selecione uma categoria</option>';

        try {
            const categorias = await categoriasService.list();
            const options = categorias
                .map((categoria) => `<option value="${dom.escapeHtml(categoria.id)}">${dom.escapeHtml(categoria.nome)}</option>`)
                .join("");

            elements.categorySelect.innerHTML = placeholder + options;
        } catch (error) {
            console.error("[eventos] Falha ao listar categorias:", error);
            elements.categorySelect.innerHTML = '<option value="" disabled selected>Erro ao carregar categorias</option>';
        }
    }

    /* ---------- Ações ---------- */

    async function handleSubmit(event) {
        event.preventDefault();
        dom.hideFeedback(elements.feedback);

        const payload = readForm();
        if (!payload) return;

        dom.setLoading(elements.submitButton, true, "Salvando...");

        try {
            await eventosService.create(payload);
            elements.form.reset();
            dom.showFeedback(elements.feedback, "success", "Evento cadastrado com sucesso!");
            await loadEvents();
        } catch (error) {
            console.error("[eventos] Falha ao inserir:", error);
            dom.showFeedback(elements.feedback, "error", "Não foi possível salvar o evento. Tente novamente.");
        } finally {
            dom.setLoading(elements.submitButton, false);
        }
    }

    // Delegação: um único listener no <tbody> atende todas as linhas, inclusive as re-renderizadas.
    async function handleTableClick(event) {
        const button = event.target.closest(".btn-delete");
        if (!button) return;

        const { id, nome } = button.dataset;
        if (!window.confirm(`Excluir o evento "${nome}"? Esta ação não pode ser desfeita.`)) return;

        dom.setLoading(button, true, "Excluindo...");

        try {
            await eventosService.remove(id);
            dom.showFeedback(elements.feedback, "success", "Evento excluído.");
            await loadEvents();
        } catch (error) {
            console.error("[eventos] Falha ao excluir:", error);
            dom.showFeedback(elements.feedback, "error", "Não foi possível excluir o evento.");
            dom.setLoading(button, false);
        }
    }

    function init() {
        elements.form.addEventListener("submit", handleSubmit);
        elements.tableBody.addEventListener("click", handleTableClick);
        loadCategories();
        loadEvents();
    }

    init();
})();
