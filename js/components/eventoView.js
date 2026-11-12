/*
 * Peças visuais de evento reutilizadas pelas páginas públicas.
 * Depende de: dom (escapeHtml), text (datas).
 *
 * Tudo que vem do banco passa por escapeHtml; a cor da categoria só entra
 * no CSS se for um hex válido.
 */
const eventoView = (function () {
    "use strict";

    const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
    const ULTIMAS_VAGAS_PERCENT = 80;

    const ICONS = Object.freeze({
        pin: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
        calendar: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>',
        clock: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
        user: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>',
        map: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/></svg>',
        arrow: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
        grid: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2"/></svg>',
        search: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>'
    });

    /** style="--accent: #hex" com a cor da categoria (ou nada → CSS usa a cor primária). */
    function accentStyle(evento) {
        const cor = evento?.categoria?.cor;
        return HEX_COLOR.test(cor ?? "") ? `style="--accent: ${cor}"` : "";
    }

    /**
     * Situação de vagas/inscrição.
     * @returns {{ percent: number, label: string, status: "aberto"|"ultimas"|"esgotado"|"encerrado", aberto: boolean }}
     */
    function situacao(evento) {
        const total = Number(evento.vagas_totais) || 0;
        const restantes = Math.max(0, Number(evento.vagas_restantes) || 0);
        const percent = total > 0 ? Math.round(((total - restantes) / total) * 100) : 0;

        if (text.isPast(evento.data)) {
            return { percent, label: "Evento encerrado", status: "encerrado", aberto: false };
        }
        if (restantes === 0) {
            return { percent: 100, label: "Esgotado", status: "esgotado", aberto: false };
        }

        const label = `${restantes} ${restantes === 1 ? "vaga restante" : "vagas restantes"}`;
        return { percent, label, status: percent >= ULTIMAS_VAGAS_PERCENT ? "ultimas" : "aberto", aberto: true };
    }

    /**
     * Botão de inscrição conforme a situação do evento.
     * Aberto → link para a inscrição. Encerrado/esgotado → botão desabilitado.
     */
    function inscricaoCta(evento, { block = false, extraClass = "" } = {}) {
        const info = situacao(evento);
        const classes = `btn-cta${block ? " btn-cta--block" : ""}${extraClass ? ` ${extraClass}` : ""}`;

        if (info.aberto) {
            return `<a class="${classes}" href="inscricao.html?id=${encodeURIComponent(evento.id)}">
                Inscrever-se ${ICONS.arrow}
            </a>`;
        }

        const label = info.status === "encerrado" ? "Inscrição encerrada" : "Vagas esgotadas";
        return `<button type="button" class="${classes}" disabled>${label}</button>`;
    }

    function dateBadge(isoDate) {
        const { day, month } = text.dateParts(isoDate);
        return `
            <time class="date-badge" datetime="${dom.escapeHtml(isoDate)}">
                <span class="date-badge-day">${dom.escapeHtml(day)}</span>
                <span class="date-badge-month">${dom.escapeHtml(month)}</span>
            </time>
        `;
    }

    function progress(evento, { compact = false } = {}) {
        const info = situacao(evento);
        return `
            <div class="capacity capacity--${info.status}${compact ? " capacity--compact" : ""}">
                <div class="capacity-row">
                    <span>${dom.escapeHtml(info.label)}</span>
                    <span>${info.percent}%</span>
                </div>
                <div class="capacity-track" role="progressbar" aria-valuemin="0" aria-valuemax="100"
                    aria-valuenow="${info.percent}" aria-label="Ocupação do evento">
                    <span class="capacity-fill" style="--fill: ${info.percent}%"></span>
                </div>
            </div>
        `;
    }

    /**
     * Card de evento (link para a página de detalhes).
     * @param {"grid"|"featured"} variant
     */
    function card(evento, { variant = "grid" } = {}) {
        const info = situacao(evento);
        const categoria = evento.categoria?.nome ?? "Evento";
        const href = `evento.html?id=${encodeURIComponent(evento.id)}`;

        const flags = [
            evento.destaque ? '<span class="tag tag--highlight">Destaque</span>' : "",
            info.status === "esgotado" ? '<span class="tag tag--muted">Esgotado</span>' : "",
            info.status === "encerrado" ? '<span class="tag tag--muted">Encerrado</span>' : "",
            info.status === "ultimas" ? '<span class="tag tag--warning">Últimas vagas</span>' : ""
        ].join("");

        return `
            <article class="event-card event-card--${variant}${info.aberto ? "" : " is-closed"}" ${accentStyle(evento)}
                data-evento-id="${dom.escapeHtml(evento.id)}" data-reveal>
                <a class="event-card-link" href="${href}" aria-label="${dom.escapeHtml(evento.nome)} — ver detalhes">
                    <div class="event-cover">
                        <span class="event-cover-watermark" aria-hidden="true">${dom.escapeHtml(categoria)}</span>
                        ${dateBadge(evento.data)}
                        <div class="event-cover-tags">${flags}</div>
                        <span class="event-cover-category">${dom.escapeHtml(categoria)}</span>
                    </div>
                    <div class="event-body">
                        <h3 class="event-title">${dom.escapeHtml(evento.nome)}</h3>
                        <ul class="event-meta">
                            <li>${ICONS.pin}<span>${dom.escapeHtml(evento.local ?? "A definir")}</span></li>
                            <li>${ICONS.calendar}<span>${dom.escapeHtml(text.formatDate(evento.data))}</span></li>
                        </ul>
                        ${progress(evento, { compact: true })}
                    </div>
                </a>
                <div class="event-actions">
                    ${inscricaoCta(evento, { block: true, extraClass: "btn-cta--sm" })}
                </div>
            </article>
        `;
    }

    function skeletonCards(quantity, variant = "grid") {
        return Array.from({ length: quantity }, () =>
            `<div class="event-card event-card--${variant} is-skeleton" aria-hidden="true">
                <div class="event-cover"></div>
                <div class="event-body"><span class="sk-line"></span><span class="sk-line sk-line--short"></span></div>
            </div>`
        ).join("");
    }

    /**
     * Atualiza, no lugar, as barras de ocupação dentro de `scope` (sem re-renderizar):
     * texto, porcentagem, largura (animada pelo CSS) e estado.
     */
    function updateCapacity(scope, evento) {
        const info = situacao(evento);

        scope.querySelectorAll(".capacity").forEach((capacity) => {
            const [label, percent] = capacity.querySelectorAll(".capacity-row span");
            if (label) label.textContent = info.label;
            if (percent) percent.textContent = `${info.percent}%`;

            capacity.querySelector(".capacity-fill")?.style.setProperty("--fill", `${info.percent}%`);
            capacity.querySelector(".capacity-track")?.setAttribute("aria-valuenow", String(info.percent));

            capacity.classList.remove("capacity--aberto", "capacity--ultimas", "capacity--esgotado", "capacity--encerrado");
            capacity.classList.add(`capacity--${info.status}`, "is-updated");
            setTimeout(() => capacity.classList.remove("is-updated"), 1200);
        });

        return info;
    }

    /** Preenche `<span data-icon="nome">` com o SVG correspondente (ícones estáticos do HTML). */
    function hydrateIcons(scope = document) {
        scope.querySelectorAll("[data-icon]").forEach((element) => {
            const svg = ICONS[element.dataset.icon];
            if (svg && !element.firstElementChild) element.innerHTML = svg;
        });
    }

    return Object.freeze({ ICONS, accentStyle, situacao, inscricaoCta, dateBadge, progress, card, skeletonCards, hydrateIcons, updateCapacity });
})();
