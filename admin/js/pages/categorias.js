/*
 * Página de categorias do painel (admin/categorias.html) — CRUD completo.
 * Depende de: categoriasService, dom, text, validation.
 */
(function categoriasPage() {
    "use strict";

    const TABLE_COLUMNS = 4;
    const DEFAULT_COLOR = "#e20543";
    const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
    const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

    const elements = {
        tableBody: document.getElementById("categorias"),
        form: document.getElementById("categoria-form"),
        formTitle: document.getElementById("categoria-form-title"),
        nameInput: document.getElementById("campo-nome-categoria"),
        slugInput: document.getElementById("campo-slug-categoria"),
        colorInput: document.getElementById("campo-cor-categoria"),
        submitButton: document.getElementById("salvar-categoria"),
        cancelButton: document.getElementById("cancelar-edicao"),
        newButton: document.getElementById("nova-categoria"),
        feedback: document.getElementById("categoria-feedback")
    };

    const state = {
        categorias: new Map(), // id → categoria (cache da última listagem)
        editingId: null,       // null = criando; id = editando
        slugTouched: false     // usuário editou o slug manualmente?
    };

    /* ---------- Validação (utils/validation.js) ---------- */

    const { read, rules } = validation;

    const FIELDS = [
        { id: "campo-nome-categoria", key: "nome", read: read.text,
          rules: [
              rules.required("O nome é obrigatório"),
              rules.minLength(2, "O nome deve ter ao menos 2 caracteres"),
              rules.maxLength(60, "O nome deve ter no máximo 60 caracteres")
          ] },
        // O slug é normalizado na leitura ("Feira X" → "feira-x").
        { id: "campo-slug-categoria", key: "slug", read: (input) => text.slugify(input.value),
          rules: [
              rules.required("O slug é obrigatório"),
              rules.pattern(SLUG_PATTERN, "Use apenas letras minúsculas, números e hífens")
          ] },
        { id: "campo-cor-categoria", key: "cor", read: read.text,
          rules: [rules.pattern(HEX_COLOR_PATTERN, "Cor inválida")] }
    ];

    /* ---------- Helpers ---------- */

    /** Só usa a cor no atributo style se for um hex válido (evita injeção de CSS). */
    function safeColor(color) {
        return HEX_COLOR_PATTERN.test(color ?? "") ? color : "transparent";
    }

    /** Converte erros do Supabase em mensagens amigáveis. */
    function describeError(error, fallback) {
        const { UNIQUE_VIOLATION, FOREIGN_KEY_VIOLATION } = categoriasService.ERROR_CODES;
        if (error?.code === UNIQUE_VIOLATION) return "Já existe uma categoria com este slug.";
        if (error?.code === FOREIGN_KEY_VIOLATION) return "Esta categoria possui eventos vinculados e não pode ser excluída.";
        return fallback;
    }

    /* ---------- Tabela ---------- */

    function renderMessageRow(message) {
        elements.tableBody.innerHTML = `
            <tr><td colspan="${TABLE_COLUMNS}">${dom.escapeHtml(message)}</td></tr>
        `;
    }

    function rowTemplate(categoria) {
        const id = dom.escapeHtml(categoria.id);
        const nome = dom.escapeHtml(categoria.nome);
        const hasEvents = categoria.totalEventos > 0;
        const deleteAttrs = hasEvents
            ? `disabled title="Remova ou altere os eventos vinculados antes de excluir"`
            : "";

        return `
            <tr>
                <td><span class="color-dot" style="background-color:${safeColor(categoria.cor)}"></span>${nome}</td>
                <td>${dom.escapeHtml(categoria.slug)}</td>
                <td>${dom.escapeHtml(categoria.totalEventos)}</td>
                <td class="actions">
                    <button type="button" class="btn-sm btn-edit" data-action="edit" data-id="${id}">Editar</button>
                    <button type="button" class="btn-sm btn-delete" data-action="delete" data-id="${id}" ${deleteAttrs}>Excluir</button>
                </td>
            </tr>
        `;
    }

    async function loadCategorias() {
        renderMessageRow("Carregando categorias...");

        try {
            const categorias = await categoriasService.listWithEventCount();
            state.categorias = new Map(categorias.map((categoria) => [String(categoria.id), categoria]));

            if (categorias.length === 0) {
                renderMessageRow("Nenhuma categoria cadastrada.");
                return;
            }

            elements.tableBody.innerHTML = categorias.map(rowTemplate).join("");
        } catch (error) {
            console.error("[categorias] Falha ao listar:", error);
            renderMessageRow("Não foi possível carregar as categorias.");
        }
    }

    /* ---------- Formulário (modo criar / editar) ---------- */

    function resetForm() {
        elements.form.reset();
        elements.colorInput.value = DEFAULT_COLOR;
        validation.clearForm(FIELDS);

        state.editingId = null;
        state.slugTouched = false;

        elements.formTitle.textContent = "Nova categoria";
        elements.submitButton.textContent = "Salvar categoria";
        elements.cancelButton.classList.add("hide");
    }

    function startEditing(categoria) {
        validation.clearForm(FIELDS);
        dom.hideFeedback(elements.feedback);

        state.editingId = categoria.id;
        // Slug personalizado (diferente do gerado pelo nome) não deve ser sobrescrito ao editar o nome.
        state.slugTouched = categoria.slug !== text.slugify(categoria.nome);

        elements.nameInput.value = categoria.nome ?? "";
        elements.slugInput.value = categoria.slug ?? "";
        elements.colorInput.value = HEX_COLOR_PATTERN.test(categoria.cor ?? "") ? expandHex(categoria.cor) : DEFAULT_COLOR;

        elements.formTitle.textContent = `Editar categoria: ${categoria.nome}`;
        elements.submitButton.textContent = "Salvar alterações";
        elements.cancelButton.classList.remove("hide");

        elements.form.scrollIntoView({ behavior: "smooth", block: "start" });
        elements.nameInput.focus({ preventScroll: true });
    }

    /** <input type="color"> só aceita #rrggbb; converte "#000" → "#000000". */
    function expandHex(color) {
        if (color.length !== 4) return color.toLowerCase();
        return "#" + [...color.slice(1)].map((char) => char + char).join("").toLowerCase();
    }

    // Gera o slug automaticamente a partir do nome, até o usuário editar o slug manualmente.
    function handleNameInput() {
        if (!state.slugTouched) {
            elements.slugInput.value = text.slugify(elements.nameInput.value);
        }
    }

    function handleSlugInput() {
        state.slugTouched = elements.slugInput.value.trim() !== "";
    }

    async function handleSubmit(event) {
        event.preventDefault();
        dom.hideFeedback(elements.feedback);

        const payload = validation.validateForm(FIELDS);
        if (!payload) return;

        elements.slugInput.value = payload.slug; // mostra o slug normalizado
        const isEditing = state.editingId !== null;

        dom.setLoading(elements.submitButton, true, "Salvando...");

        try {
            if (isEditing) {
                await categoriasService.update(state.editingId, payload);
            } else {
                await categoriasService.create(payload);
            }

            dom.setLoading(elements.submitButton, false);
            resetForm();
            dom.showFeedback(elements.feedback, "success",
                isEditing ? "Categoria atualizada com sucesso!" : "Categoria cadastrada com sucesso!");
            await loadCategorias();
        } catch (error) {
            console.error("[categorias] Falha ao salvar:", error);
            dom.setLoading(elements.submitButton, false);

            if (error?.code === categoriasService.ERROR_CODES.UNIQUE_VIOLATION) {
                dom.showFieldError(elements.slugInput, "Já existe uma categoria com este slug");
                elements.slugInput.focus();
            }
            dom.showFeedback(elements.feedback, "error",
                describeError(error, "Não foi possível salvar a categoria. Tente novamente."));
        }
    }

    /* ---------- Ações da tabela ---------- */

    async function handleDelete(button, categoria) {
        if (!window.confirm(`Excluir a categoria "${categoria.nome}"? Esta ação não pode ser desfeita.`)) return;

        dom.setLoading(button, true, "Excluindo...");

        try {
            await categoriasService.remove(categoria.id);
            if (String(state.editingId) === String(categoria.id)) resetForm();
            dom.showFeedback(elements.feedback, "success", "Categoria excluída.");
            await loadCategorias();
        } catch (error) {
            console.error("[categorias] Falha ao excluir:", error);
            dom.showFeedback(elements.feedback, "error",
                describeError(error, "Não foi possível excluir a categoria."));
            dom.setLoading(button, false);
        }
    }

    // Delegação: um único listener no <tbody> atende todas as linhas, inclusive as re-renderizadas.
    function handleTableClick(event) {
        const button = event.target.closest("button[data-action]");
        if (!button || button.disabled) return;

        const categoria = state.categorias.get(button.dataset.id);
        if (!categoria) return;

        if (button.dataset.action === "edit") startEditing(categoria);
        if (button.dataset.action === "delete") handleDelete(button, categoria);
    }

    function init() {
        elements.form.addEventListener("submit", handleSubmit);
        elements.nameInput.addEventListener("input", handleNameInput);
        elements.slugInput.addEventListener("input", handleSlugInput);
        elements.cancelButton.addEventListener("click", resetForm);
        elements.newButton.addEventListener("click", resetForm);
        elements.tableBody.addEventListener("click", handleTableClick);

        resetForm();
        loadCategorias();
    }

    init();
})();
