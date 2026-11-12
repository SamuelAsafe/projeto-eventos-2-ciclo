/*
 * Página de usuários do painel (admin/usuarios.html) — CRUD de contas do Supabase Auth.
 * Depende de: usuariosService, authService, dom, validation, pagination.
 */
(function usuariosPage() {
    "use strict";

    const PAGE_SIZE = 10;
    const TABLE_COLUMNS = 5;
    const MIN_PASSWORD = 8;
    const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const PAPEIS = {
        administrador: { label: "Administrador", badge: "badge-admin" },
        usuario: { label: "Usuário", badge: "badge-user" }
    };
    const STATUS = {
        ativo: { label: "Ativo", badge: "badge-active" },
        inativo: { label: "Inativo", badge: "badge-inactive" }
    };

    const elements = {
        tableBody: document.getElementById("usuarios"),
        pagination: document.getElementById("usuarios-paginacao"),
        form: document.getElementById("usuario-form"),
        formTitle: document.getElementById("usuario-form-title"),
        nameInput: document.getElementById("campo-nome-usuario"),
        emailInput: document.getElementById("campo-email-usuario"),
        passwordInput: document.getElementById("campo-senha-usuario"),
        passwordHint: document.getElementById("ajuda-senha"),
        roleSelect: document.getElementById("campo-papel-usuario"),
        statusSelect: document.getElementById("campo-status-usuario"),
        submitButton: document.getElementById("salvar-usuario"),
        cancelButton: document.getElementById("cancelar-edicao-usuario"),
        newButton: document.getElementById("novo-usuario"),
        feedback: document.getElementById("usuario-feedback")
    };

    const state = {
        page: 1,
        usuarios: new Map(), // id → usuário da página atual
        editingId: null,
        currentUserId: null
    };

    const pager = pagination.create(elements.pagination, {
        onChange: (page) => loadPage(page)
    });

    /* ---------- Validação (utils/validation.js) ---------- */

    const { read, rules } = validation;

    const FIELDS = [
        { id: "campo-nome-usuario", key: "nome", read: read.text,
          rules: [
              rules.required("O nome é obrigatório"),
              rules.minLength(2, "O nome deve ter ao menos 2 caracteres"),
              rules.maxLength(100, "O nome deve ter no máximo 100 caracteres")
          ] },
        { id: "campo-email-usuario", key: "email", read: (input) => input.value.trim().toLowerCase(),
          rules: [rules.required("O e-mail é obrigatório"), rules.pattern(EMAIL_PATTERN, "Informe um e-mail válido")] },
        // Senha: obrigatória ao criar; ao editar, vazia = mantém a atual.
        { id: "campo-senha-usuario", key: "senha", read: (input) => input.value,
          rules: [
              (value) => state.editingId === null && !value ? "A senha é obrigatória" : null,
              rules.minLength(MIN_PASSWORD, `A senha deve ter ao menos ${MIN_PASSWORD} caracteres`)
          ] },
        { id: "campo-papel-usuario", key: "papel", read: read.text,
          rules: [(value) => (value in PAPEIS ? null : "Selecione um papel")] },
        { id: "campo-status-usuario", key: "status", read: read.text,
          rules: [
              (value) => (value in STATUS ? null : "Selecione um status"),
              (value) => value === "inativo" && state.editingId === state.currentUserId
                  ? "Você não pode desativar a sua própria conta"
                  : null
          ] }
    ];

    /* ---------- Tabela ---------- */

    function badge(map, key) {
        const item = map[key] ?? { label: key, badge: "" };
        return `<span class="badge ${item.badge}">${dom.escapeHtml(item.label)}</span>`;
    }

    function renderMessageRow(message) {
        elements.tableBody.innerHTML = `
            <tr><td colspan="${TABLE_COLUMNS}">${dom.escapeHtml(message)}</td></tr>
        `;
    }

    function rowTemplate(usuario) {
        const id = dom.escapeHtml(usuario.id);
        const isSelf = usuario.id === state.currentUserId;
        const deleteAttrs = isSelf ? `disabled title="Você não pode excluir a sua própria conta"` : "";

        return `
            <tr>
                <td>${dom.escapeHtml(usuario.nome || "—")}${isSelf ? " <small>(você)</small>" : ""}</td>
                <td>${dom.escapeHtml(usuario.email)}</td>
                <td>${badge(PAPEIS, usuario.papel)}</td>
                <td>${badge(STATUS, usuario.status)}</td>
                <td class="actions">
                    <button type="button" class="btn-sm btn-edit" data-action="edit" data-id="${id}">Editar</button>
                    <button type="button" class="btn-sm btn-delete" data-action="delete" data-id="${id}" ${deleteAttrs}>Excluir</button>
                </td>
            </tr>
        `;
    }

    async function loadPage(page = state.page) {
        state.page = page;
        renderMessageRow("Carregando usuários...");

        try {
            const { items, total } = await usuariosService.list({ page: state.page, pageSize: PAGE_SIZE });

            const lastPage = pagination.totalPages(total, PAGE_SIZE);
            if (items.length === 0 && total > 0 && state.page > lastPage) {
                return loadPage(lastPage);
            }

            state.usuarios = new Map(items.map((usuario) => [usuario.id, usuario]));
            pager.render({ page: state.page, pageSize: PAGE_SIZE, total });

            if (items.length === 0) {
                renderMessageRow("Nenhum usuário cadastrado.");
                return;
            }

            elements.tableBody.innerHTML = items.map(rowTemplate).join("");
        } catch (error) {
            console.error("[usuarios] Falha ao listar:", error);
            pager.render({ page: 1, pageSize: PAGE_SIZE, total: 0 });
            renderMessageRow(error.message || "Não foi possível carregar os usuários.");
        }
    }

    /* ---------- Formulário (modo criar / editar) ---------- */

    function resetForm() {
        elements.form.reset();
        validation.clearForm(FIELDS);
        state.editingId = null;

        elements.formTitle.textContent = "Novo usuário";
        elements.submitButton.textContent = "Salvar usuário";
        elements.passwordInput.placeholder = "Senha provisória";
        elements.passwordInput.autocomplete = "new-password";
        elements.passwordHint.textContent = `Mínimo de ${MIN_PASSWORD} caracteres. Repasse ao usuário com segurança.`;
        elements.cancelButton.classList.add("hide");
    }

    function startEditing(usuario) {
        validation.clearForm(FIELDS);
        dom.hideFeedback(elements.feedback);
        state.editingId = usuario.id;

        elements.nameInput.value = usuario.nome ?? "";
        elements.emailInput.value = usuario.email ?? "";
        elements.passwordInput.value = "";
        elements.roleSelect.value = usuario.papel in PAPEIS ? usuario.papel : "usuario";
        elements.statusSelect.value = usuario.status in STATUS ? usuario.status : "ativo";

        elements.formTitle.textContent = `Editar usuário: ${usuario.nome || usuario.email}`;
        elements.submitButton.textContent = "Salvar alterações";
        elements.passwordInput.placeholder = "Deixe em branco para manter a atual";
        elements.passwordHint.textContent = "Preencha apenas para definir uma nova senha.";
        elements.cancelButton.classList.remove("hide");

        elements.form.scrollIntoView({ behavior: "smooth", block: "start" });
        elements.nameInput.focus({ preventScroll: true });
    }

    async function handleSubmit(event) {
        event.preventDefault();
        dom.hideFeedback(elements.feedback);

        const values = validation.validateForm(FIELDS);
        if (!values) return;

        const isEditing = state.editingId !== null;
        const payload = { ...values };
        if (isEditing && !payload.senha) delete payload.senha; // não envia senha vazia

        dom.setLoading(elements.submitButton, true, "Salvando...");

        try {
            if (isEditing) {
                await usuariosService.update(state.editingId, payload);
            } else {
                await usuariosService.create(payload);
            }

            dom.setLoading(elements.submitButton, false);
            resetForm();
            dom.showFeedback(elements.feedback, "success",
                isEditing ? "Usuário atualizado com sucesso!" : "Usuário criado com sucesso!");
            await loadPage(isEditing ? state.page : 1);
        } catch (error) {
            console.error("[usuarios] Falha ao salvar:", error);
            dom.setLoading(elements.submitButton, false);

            if (error.status === 409) {
                dom.showFieldError(elements.emailInput, "Já existe um usuário com este e-mail");
                elements.emailInput.focus();
            }
            dom.showFeedback(elements.feedback, "error", error.message);
        }
    }

    /* ---------- Ações da tabela ---------- */

    async function handleDelete(button, usuario) {
        const label = usuario.nome ? `${usuario.nome} (${usuario.email})` : usuario.email;
        const confirmed = await modal.confirm({
            title: "Excluir usuário?",
            message: `${label} perderá o acesso ao painel. Esta ação não pode ser desfeita.`,
            confirmLabel: "Excluir usuário"
        });
        if (!confirmed) return;

        dom.setLoading(button, true, "Excluindo...");

        try {
            await usuariosService.remove(usuario.id);
            if (state.editingId === usuario.id) resetForm();
            dom.showFeedback(elements.feedback, "success", "Usuário excluído.");
            await loadPage();
        } catch (error) {
            console.error("[usuarios] Falha ao excluir:", error);
            dom.showFeedback(elements.feedback, "error", error.message);
            dom.setLoading(button, false);
        }
    }

    function handleTableClick(event) {
        const button = event.target.closest("button[data-action]");
        if (!button || button.disabled) return;

        const usuario = state.usuarios.get(button.dataset.id);
        if (!usuario) return;

        if (button.dataset.action === "edit") startEditing(usuario);
        if (button.dataset.action === "delete") handleDelete(button, usuario);
    }

    async function init() {
        elements.form.addEventListener("submit", handleSubmit);
        elements.cancelButton.addEventListener("click", resetForm);
        elements.newButton.addEventListener("click", resetForm);
        elements.tableBody.addEventListener("click", handleTableClick);
        resetForm();

        // Identifica o usuário logado (para bloquear auto-exclusão/desativação).
        const { session } = await authService.getSession();
        state.currentUserId = session?.user?.id ?? null;

        loadPage();
    }

    init();
})();
