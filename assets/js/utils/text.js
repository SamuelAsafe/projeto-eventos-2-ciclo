/*
 * Helpers de texto e formatação.
 */
const text = (function () {
    "use strict";

    const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC" // datas "YYYY-MM-DD" são interpretadas em UTC; evita exibir o dia anterior
    });

    const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short"
        // sem timeZone: timestamptz é exibido no fuso de quem está vendo
    });

    const longDateFormatter = new Intl.DateTimeFormat("pt-BR", {
        day: "numeric", month: "long", year: "numeric", timeZone: "UTC"
    });
    const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" });
    const dayFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: "UTC" });
    const monthShortFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });

    /** "Curso de Banco de Dados!" → "curso-de-banco-de-dados" */
    function slugify(value) {
        return String(value ?? "")
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "") // remove acentos
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, "")    // remove caracteres especiais
            .replace(/[\s_-]+/g, "-")        // espaços/underscores → hífen
            .replace(/^-+|-+$/g, "");        // hífens nas pontas
    }

    /** "2026-11-11" → "11/11/2026". Retorna o valor original se inválido. */
    function formatDate(isoDate) {
        if (!isoDate) return "";
        const date = new Date(isoDate);
        return Number.isNaN(date.getTime()) ? String(isoDate) : dateFormatter.format(date);
    }

    /** "2026-09-02T17:32:00+00:00" → "02/09/2026, 14:32" (fuso local). */
    function formatDateTime(isoDateTime) {
        if (!isoDateTime) return "";
        const date = new Date(isoDateTime);
        return Number.isNaN(date.getTime()) ? String(isoDateTime) : dateTimeFormatter.format(date);
    }

    /** "2026-10-10" → "10 de outubro de 2026" */
    function formatDateLong(isoDate) {
        const date = new Date(isoDate ?? "");
        return Number.isNaN(date.getTime()) ? String(isoDate ?? "") : longDateFormatter.format(date);
    }

    /** "2026-10-10" → { day: "10", month: "out", weekday: "sábado" } (para "selos" de data). */
    function dateParts(isoDate) {
        const date = new Date(isoDate ?? "");
        if (Number.isNaN(date.getTime())) return { day: "--", month: "", weekday: "" };
        return {
            day: dayFormatter.format(date),
            month: monthShortFormatter.format(date).replace(".", ""),
            weekday: weekdayFormatter.format(date)
        };
    }

    /** Data de hoje no fuso local, formato "YYYY-MM-DD" (comparável com colunas `date`). */
    function todayIso() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    }

    /** true se a data (YYYY-MM-DD) já passou. */
    function isPast(isoDate) {
        return Boolean(isoDate) && isoDate < todayIso();
    }

    return Object.freeze({ slugify, formatDate, formatDateTime, formatDateLong, dateParts, todayIso, isPast });
})();
