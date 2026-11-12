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

    return Object.freeze({ slugify, formatDate });
})();
