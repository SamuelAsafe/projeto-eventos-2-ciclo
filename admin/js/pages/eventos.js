/*
 * Página de eventos do painel (admin/eventos.html) — listar, criar, editar e excluir.
 * Criar/editar acontecem em modal (utils/modal.js), com o mesmo formulário.
 * Depende de: eventosService, categoriasService, dom, text, validation, modal.
 */
(function eventosPage() {
    "use strict";

    const TABLE_COLUMNS = 6;

    const elements = {
        tableBody: document.getElementById("events"),
        newButton: document.getElementById("novo-evento"),
        form: document.getElementById("evento-form"),
        formFeedback: document.getElementById("evento-form-feedback"),
        categorySelect: document.getElementById("campo-categoria"),
        submitButton: document.getElementById("salvar-evento"),
        feedback: document.getElementById("evento-feedback")
    };

    const state = {
        editingId: null, // null = criando
        dialog: null     // controle do modal aberto
    };

    /* ---------- Validação (utils/validation.js) ---------- */

    const { read, rules } = validation;
    const { required, minLength, nonNegativeInteger } = rules;

    const FIELDS = [
        { id: "campo-titulo", key: "nome", read: read.text,
          rules: [required("O nome é obrigatório"), minLength(3, "O nome deve ter ao menos 3 caracteres")] },
        { id: "campo-categoria", key: "categoria_id", read: read.text,
          rules: [required("Selecione uma categoria")] },
        { id: "campo-data", key: "data", read: read.text,
          rules: [required("A data é obrigatória")] },
        { id: "campo-horario", key: "horario", read: read.text,
          rules: [required("O horário é obrigatório")] },
        { id: "campo-local", key: "local", read: read.text,
          rules: [required("O local é obrigatório")] },
        { id: "campo-endereco", key: "endereco", read: read.text,
          rules: [required("O endereço é obrigatório")] },
        { id: "campo-organizador", key: "responsavel", read: read.text,
          rules: [required("O organizador é obrigatório")] },
        { id: "campo-vagas-totais", key: "vagas_totais", read: read.integer,
          rules: [required("Vagas totais é obrigatório"), nonNegativeInteger("Informe um número inteiro maior ou igual a 0")] },
        { id: "campo-vagas-restantes", key: "vagas_restantes", read: read.integer,
          rules: [
              required("Vagas restantes é obrigatório"),
              nonNegativeInteger("Informe um número inteiro maior ou igual a 0"),
              (value, values) => value !== null && values.vagas_totais !== null && value > values.vagas_totais
                  ? "Vagas restantes não pode ser maior que vagas totais"
                  : null
          ] },
        { id: "campo-destaque", key: "destaque", read: read.checked, rules: [] },
        { id: "campo-descricao", key: "descricao", read: read.text,
          rules: [required("Descrição completa é obrigatória")] }
    ];

    // Campo do formulário → coluna do banco (para preencher na edição).
    const FORM_BINDINGS = {
        "campo-titulo": "nome",
        "campo-categoria": "categoria_id",
        "campo-data": "data",
        "campo-horario": "horario",
        "campo-local": "local",
        "campo-endereco": "endereco",
        "campo-organizador": "responsavel",
        "campo-vagas-totais": "vagas_totais",
        "campo-vagas-restantes": "vagas_restantes",
        "campo-descricao": "descricao"
    };

    /** @returns {object|null} payload pronto para salvar, ou null se inválido */
    function readForm() {
        const values = validation.validateForm(FIELDS);
        return values ? { ...values, slug: text.slugify(values.nome) } : null;
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
        const encerrado = text.isPast(evento.data);

        return `
            <tr>
                <td>${nome}${encerrado ? ' <span class="badge badge-inactive">Encerrado</span>' : ""}</td>
                <td>${dom.escapeHtml(evento.categoria?.nome ?? "—")}</td>
                <td>${dom.escapeHtml(text.formatDate(evento.data))}</td>
                <td>${dom.escapeHtml(evento.local)}</td>
                <td>${dom.escapeHtml(evento.vagas_restantes)} / ${dom.escapeHtml(evento.vagas_totais)}</td>
                <td class="actions">
                    <a class="btn-sm btn-edit" href="inscritos.html?evento=${encodeURIComponent(evento.id)}">Ver inscritos</a>
                    <button type="button" class="btn-sm btn-edit" data-action="edit" data-id="${id}">Editar</button>
                    <button type="button" class="btn-sm btn-delete" data-action="delete" data-id="${id}" data-nome="${nome}">Excluir</button>
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

    /* ---------- Modal de criar / editar ---------- */

    function resetForm() {
        elements.form.reset();
        validation.clearForm(FIELDS);
        dom.hideFeedback(elements.formFeedback);
        elements.categorySelect.selectedIndex = 0;
    }

    function openForm({ title, submitLabel }) {
        elements.submitButton.textContent = submitLabel;
        dom.hideFeedback(elements.feedback);
        state.dialog = modal.form({ title, form: elements.form, size: "lg" });
        state.dialog.closed.then(() => {
            state.dialog = null;
            state.editingId = null;
        });
    }

    function openCreate() {
        resetForm();
        state.editingId = null;
        openForm({ title: "Novo evento", submitLabel: "Cadastrar evento" });
    }

    async function openEdit(id, button) {
        dom.setLoading(button, true, "Abrindo...");

        try {
            const evento = await eventosService.getById(id);
            resetForm();

            Object.entries(FORM_BINDINGS).forEach(([inputId, column]) => {
                document.getElementById(inputId).value = evento[column] ?? "";
            });
            document.getElementById("campo-destaque").checked = Boolean(evento.destaque);

            state.editingId = evento.id;
            openForm({ title: `Editar evento`, submitLabel: "Salvar alterações" });
        } catch (error) {
            console.error("[eventos] Falha ao carregar evento:", error);
            dom.showFeedback(elements.feedback, "error", "Não foi possível abrir o evento para edição.");
        } finally {
            dom.setLoading(button, false);
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();
        dom.hideFeedback(elements.formFeedback);

        const payload = readForm();
        if (!payload) return;

        const isEditing = state.editingId !== null;
        dom.setLoading(elements.submitButton, true, "Salvando...");

        try {
            if (isEditing) {
                await eventosService.update(state.editingId, payload);
            } else {
                await eventosService.create(payload);
            }

            state.dialog?.close("saved");
            dom.showFeedback(elements.feedback, "success",
                isEditing ? "Evento atualizado com sucesso!" : "Evento cadastrado com sucesso!");
            await loadEvents();
        } catch (error) {
            console.error("[eventos] Falha ao salvar:", error);
            // Modal continua aberto com os dados, para tentar de novo.
            dom.showFeedback(elements.formFeedback, "error", "Não foi possível salvar o evento. Tente novamente.");
        } finally {
            dom.setLoading(elements.submitButton, false);
        }
    }

    /* ---------- Exclusão ---------- */

    async function handleDelete(button) {
        const { id, nome } = button.dataset;
        const confirmed = await modal.confirm({
            title: "Excluir evento?",
            message: `O evento "${nome}" será removido. Esta ação não pode ser desfeita.`,
            confirmLabel: "Excluir evento"
        });
        if (!confirmed) return;

        dom.setLoading(button, true, "Excluindo...");

        try {
            await eventosService.remove(id);
            dom.showFeedback(elements.feedback, "success", "Evento excluído.");
            await loadEvents();
        } catch (error) {
            console.error("[eventos] Falha ao excluir:", error);
            const message = error?.code === "23503"
                ? "Este evento possui inscrições. Remova as inscrições antes de excluir."
                : "Não foi possível excluir o evento.";
            dom.showFeedback(elements.feedback, "error", message);
            dom.setLoading(button, false);
        }
    }

    // Delegação: um único listener no <tbody> atende todas as linhas, inclusive as re-renderizadas.
    function handleTableClick(event) {
        const button = event.target.closest("button[data-action]");
        if (!button || button.disabled) return;

        if (button.dataset.action === "edit") openEdit(button.dataset.id, button);
        if (button.dataset.action === "delete") handleDelete(button);
    }

    function init() {
        elements.form.addEventListener("submit", handleSubmit);
        elements.newButton.addEventListener("click", openCreate);
        elements.tableBody.addEventListener("click", handleTableClick);
        loadCategories();
        loadEvents();
    }

    init();
})();
