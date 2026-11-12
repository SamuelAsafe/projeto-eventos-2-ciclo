/*
 * Página de inscrição (inscricao.html?id=N).
 * Depende de: catalogoService, eventoView, dom, text, validation, motion.
 *
 * A validação aqui é para dar retorno rápido ao usuário; o banco valida de
 * novo na função `inscrever_participante` (não confiamos no navegador).
 */
(function inscricaoPage() {
    "use strict";

    const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const elements = {
        loading: document.getElementById("inscricao-carregando"),
        empty: document.getElementById("inscricao-vazio"),
        emptyTitle: document.getElementById("inscricao-vazio-titulo"),
        emptyText: document.getElementById("inscricao-vazio-texto"),
        content: document.getElementById("inscricao-conteudo"),
        summary: document.getElementById("resumo-evento"),
        form: document.getElementById("form-inscricao"),
        feedback: document.getElementById("inscricao-feedback"),
        submit: document.getElementById("botao-inscrever"),
        cpf: document.getElementById("campo-documento"),
        whatsapp: document.getElementById("campo-whatsapp"),
        birth: document.getElementById("campo-nascimento"),
        confirmation: document.getElementById("inscricao-confirmada"),
        confirmationTitle: document.getElementById("confirmacao-titulo"),
        confirmationCode: document.getElementById("codigo-confirmacao"),
        confirmationEvent: document.getElementById("confirmacao-evento"),
        backToEvent: document.getElementById("link-voltar-evento"),
        breadcrumbEvent: document.getElementById("breadcrumb-evento")
    };

    let evento = null;

    /* ---------- Máscaras e regras específicas ---------- */

    const onlyDigits = (value) => String(value ?? "").replace(/\D/g, "");

    function maskCpf(value) {
        return onlyDigits(value).slice(0, 11)
            .replace(/^(\d{3})(\d)/, "$1.$2")
            .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
            .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
    }

    function maskPhone(value) {
        const digits = onlyDigits(value).slice(0, 11);
        if (digits.length <= 2) return digits.length ? `(${digits}` : "";
        if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }

    /** Valida dígitos verificadores do CPF. */
    function isValidCpf(value) {
        const cpf = onlyDigits(value);
        if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

        const digit = (length) => {
            const sum = [...cpf.slice(0, length)].reduce((acc, num, index) => acc + Number(num) * (length + 1 - index), 0);
            const rest = (sum * 10) % 11;
            return rest === 10 ? 0 : rest;
        };

        return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
    }

    const { read, rules } = validation;

    const FIELDS = [
        { id: "campo-nome", key: "nome", read: read.text,
          rules: [
              rules.required("Informe seu nome completo."),
              rules.minLength(3, "Digite pelo menos 3 letras."),
              (value) => value.split(/\s+/).length < 2 ? "Informe nome e sobrenome." : null
          ] },
        { id: "campo-email", key: "email", read: (input) => input.value.trim().toLowerCase(),
          rules: [rules.required("Informe seu e-mail."), rules.pattern(EMAIL_PATTERN, "Informe um e-mail válido.")] },
        { id: "campo-documento", key: "documento", read: (input) => onlyDigits(input.value),
          rules: [rules.required("Informe seu CPF."), (value) => value && !isValidCpf(value) ? "CPF inválido. Confira os números." : null] },
        { id: "campo-nascimento", key: "data_nascimento", read: read.text,
          rules: [
              rules.required("Informe sua data de nascimento."),
              (value) => value && value >= text.todayIso() ? "A data precisa ser anterior a hoje." : null
          ] },
        { id: "campo-whatsapp", key: "whatsapp", read: (input) => onlyDigits(input.value),
          rules: [
              rules.required("Informe seu WhatsApp."),
              (value) => value && (value.length < 10 || value.length > 11) ? "Informe DDD + número." : null
          ] }
    ];

    const FIELD_INPUT = {
        nome: "campo-nome",
        email: "campo-email",
        documento: "campo-documento",
        data_nascimento: "campo-nascimento",
        whatsapp: "campo-whatsapp"
    };

    /* ---------- Estados da tela ---------- */

    function showEmpty(title, message) {
        elements.loading.hidden = true;
        elements.content.hidden = true;
        elements.emptyTitle.textContent = title;
        elements.emptyText.textContent = message;
        elements.empty.hidden = false;
    }

    function renderSummary() {
        const categoria = evento.categoria?.nome ?? "Evento";
        elements.summary.innerHTML = `
            <div class="summary-cover" ${eventoView.accentStyle(evento)}>
                <span class="event-cover-watermark" aria-hidden="true">${dom.escapeHtml(categoria)}</span>
                ${eventoView.dateBadge(evento.data)}
            </div>
            <div class="summary-body">
                <p class="summary-eyebrow">Você está se inscrevendo em</p>
                <h2 class="summary-title">${dom.escapeHtml(evento.nome)}</h2>
                <ul class="event-meta">
                    <li>${eventoView.ICONS.calendar}<span>${dom.escapeHtml(text.formatDateLong(evento.data))}</span></li>
                    ${evento.horario ? `<li>${eventoView.ICONS.clock}<span>${dom.escapeHtml(evento.horario)}</span></li>` : ""}
                    <li>${eventoView.ICONS.pin}<span>${dom.escapeHtml(evento.local ?? "A definir")}</span></li>
                </ul>
                ${eventoView.progress(evento)}
            </div>
        `;
    }

    function showForm() {
        renderSummary();
        elements.breadcrumbEvent.textContent = evento.nome;
        elements.breadcrumbEvent.href = `evento.html?id=${encodeURIComponent(evento.id)}`;
        document.title = `Inscrição: ${evento.nome} | Eventos Fatec`;
        elements.birth.max = text.todayIso();

        elements.loading.hidden = true;
        elements.content.hidden = false;
        motion.observe(elements.content);
    }

    function showConfirmation(codigo) {
        elements.confirmationCode.textContent = codigo ?? "";
        elements.confirmationEvent.textContent = `${evento.nome} · ${text.formatDateLong(evento.data)}`;
        elements.backToEvent.href = `evento.html?id=${encodeURIComponent(evento.id)}`;

        elements.content.hidden = true;
        elements.confirmation.hidden = false;
        elements.confirmationTitle.focus();
        window.scrollTo({ top: 0 });
    }

    /* ---------- Envio ---------- */

    async function handleSubmit(event) {
        event.preventDefault();
        dom.hideFeedback(elements.feedback);

        const dados = validation.validateForm(FIELDS);
        if (!dados) return;

        dom.setLoading(elements.submit, true, "Confirmando...");

        try {
            const { codigo } = await catalogoService.inscrever(evento.id, dados);
            showConfirmation(codigo);
        } catch (error) {
            console.error("[inscricao] Falha ao inscrever:", error.cause ?? error);

            const input = error.field ? document.getElementById(FIELD_INPUT[error.field]) : null;
            if (input) {
                dom.showFieldError(input, error.message);
                input.focus();
            }
            dom.showFeedback(elements.feedback, "error", error.message);
        } finally {
            dom.setLoading(elements.submit, false);
        }
    }

    function bindEvents() {
        elements.form.addEventListener("submit", handleSubmit);
        elements.cpf.addEventListener("input", () => { elements.cpf.value = maskCpf(elements.cpf.value); });
        elements.whatsapp.addEventListener("input", () => { elements.whatsapp.value = maskPhone(elements.whatsapp.value); });

        // Limpa o erro do campo assim que o usuário corrige.
        elements.form.addEventListener("input", (event) => {
            if (event.target.matches("input")) dom.clearFieldError(event.target);
        });
    }

    async function init() {
        const id = new URLSearchParams(window.location.search).get("id");
        if (!/^\d+$/.test(id ?? "")) {
            showEmpty("Nenhum evento selecionado", "Escolha um evento para se inscrever.");
            return;
        }

        try {
            evento = await catalogoService.getEvento(id);
        } catch (error) {
            console.error("[inscricao] Falha ao carregar evento:", error);
            showEmpty("Não foi possível carregar o evento", "Verifique sua conexão e tente novamente.");
            return;
        }

        if (!evento) {
            showEmpty("Evento não encontrado", "O link pode estar incorreto ou o evento foi removido.");
            return;
        }

        const situacao = eventoView.situacao(evento);
        if (!situacao.aberto) {
            const message = situacao.status === "encerrado"
                ? "Este evento já aconteceu."
                : "Todas as vagas deste evento foram preenchidas.";
            showEmpty("Inscrições encerradas", message);
            return;
        }

        bindEvents();
        showForm();
    }

    init();
})();
