/*
 * Página de detalhes (evento.html?id=N).
 * Depende de: catalogoService, eventoView, dom, text, motion.
 */
(function eventoPage() {
    "use strict";

    const elements = {
        skeleton: document.getElementById("detalhe-skeleton"),
        content: document.getElementById("detalhe-conteudo"),
        notFound: document.getElementById("detalhe-nao-encontrado"),
        breadcrumb: document.getElementById("breadcrumb-titulo")
    };

    const { ICONS } = eventoView;

    const capitalize = (value) => value ? value.charAt(0).toUpperCase() + value.slice(1) : "";

    function readId() {
        const id = new URLSearchParams(window.location.search).get("id");
        return /^\d+$/.test(id ?? "") ? id : null;
    }

    function infoItem(icon, label, value) {
        if (!value) return "";
        return `
            <li class="info-item">
                <span class="info-icon">${icon}</span>
                <span>
                    <span class="info-label">${dom.escapeHtml(label)}</span>
                    <span class="info-value">${dom.escapeHtml(value)}</span>
                </span>
            </li>`;
    }

    function ctaHtml(evento, situacao) {
        if (situacao.aberto) {
            return `<a class="btn-cta btn-cta--block" href="inscricao.html?id=${encodeURIComponent(evento.id)}">
                Quero me inscrever ${ICONS.arrow}
            </a>`;
        }
        const motivo = situacao.status === "encerrado" ? "Este evento já aconteceu." : "Todas as vagas foram preenchidas.";
        return `<button type="button" class="btn-cta btn-cta--block" disabled>${dom.escapeHtml(situacao.label)}</button>
                <p class="cta-note">${motivo}</p>`;
    }

    function render(evento) {
        const situacao = eventoView.situacao(evento);
        const { weekday } = text.dateParts(evento.data);
        const categoria = evento.categoria?.nome ?? "Evento";
        const mapsUrl = evento.endereco
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evento.endereco)}`
            : null;

        elements.content.innerHTML = `
            <article class="detail-layout" ${eventoView.accentStyle(evento)}>
                <header class="detail-hero" data-reveal="scale">
                    <span class="event-cover-watermark" aria-hidden="true">${dom.escapeHtml(categoria)}</span>
                    ${eventoView.dateBadge(evento.data)}
                    <div class="detail-hero-text">
                        <div class="detail-tags">
                            <span class="tag tag--glass">${dom.escapeHtml(categoria)}</span>
                            ${evento.destaque ? '<span class="tag tag--highlight">Destaque</span>' : ""}
                        </div>
                        <h1 class="detail-title">${dom.escapeHtml(evento.nome)}</h1>
                        <p class="detail-subtitle">${dom.escapeHtml(capitalize(weekday))}, ${dom.escapeHtml(text.formatDateLong(evento.data))}</p>
                    </div>
                </header>

                <div class="detail-columns">
                    <section class="detail-main" data-reveal>
                        <h2 class="detail-section-title">Sobre o evento</h2>
                        <p class="detail-description">${dom.escapeHtml(evento.descricao ?? "Descrição em breve.")}</p>

                        <h2 class="detail-section-title">Informações</h2>
                        <ul class="info-list">
                            ${infoItem(ICONS.calendar, "Data", text.formatDateLong(evento.data))}
                            ${infoItem(ICONS.clock, "Horário", evento.horario)}
                            ${infoItem(ICONS.pin, "Local", evento.local)}
                            ${infoItem(ICONS.map, "Endereço", evento.endereco)}
                            ${infoItem(ICONS.user, "Organização", evento.responsavel)}
                        </ul>
                        ${mapsUrl ? `<a class="btn-ghost" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">${ICONS.map} Ver no mapa</a>` : ""}
                    </section>

                    <aside class="detail-aside" data-reveal>
                        <div class="ticket-card">
                            <p class="ticket-label">Inscrição gratuita</p>
                            ${eventoView.progress(evento)}
                            ${ctaHtml(evento, situacao)}
                        </div>
                    </aside>
                </div>
            </article>
        `;

        elements.breadcrumb.textContent = evento.nome;
        document.title = `${evento.nome} | Eventos Fatec`;
        elements.skeleton.hidden = true;
        elements.content.hidden = false;
        motion.observe(elements.content);
    }

    function showNotFound() {
        elements.skeleton.hidden = true;
        elements.content.hidden = true;
        elements.notFound.hidden = false;
        elements.breadcrumb.textContent = "Evento não encontrado";
    }

    function showError() {
        showNotFound();
        elements.notFound.querySelector(".empty-state-title").textContent = "Não foi possível carregar o evento";
        elements.notFound.querySelector("p:not(.empty-state-title)").textContent = "Verifique sua conexão e tente novamente.";
    }

    async function init() {
        const id = readId();
        if (!id) {
            showNotFound();
            return;
        }

        try {
            const evento = await catalogoService.getEvento(id);
            if (evento) render(evento);
            else showNotFound();
        } catch (error) {
            console.error("[evento] Falha ao carregar:", error);
            showError();
        }
    }

    init();
})();
