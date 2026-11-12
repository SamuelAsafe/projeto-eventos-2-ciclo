/*
 * Validação declarativa de formulários.
 * Depende de: dom (showFieldError / clearFieldError).
 *
 * Um formulário é descrito por uma lista de campos:
 *   { id: "campo-nome", key: "nome", read: validation.read.text, rules: [validation.rules.required("...")] }
 *
 * - `read` converte o valor do input.
 * - `rules` rodam em ordem; a primeira que retornar mensagem define o erro do campo.
 * - Cada regra recebe (valor, todosOsValores), permitindo validações entre campos.
 */
const validation = (function () {
    "use strict";

    const read = Object.freeze({
        text: (input) => input.value.trim(),
        integer: (input) => (input.value === "" ? null : Number(input.value)),
        checked: (input) => input.checked
    });

    const rules = Object.freeze({
        required: (message) => (value) =>
            value === null || value === "" ? message : null,

        minLength: (size, message) => (value) =>
            typeof value === "string" && value.length < size ? message : null,

        maxLength: (size, message) => (value) =>
            typeof value === "string" && value.length > size ? message : null,

        pattern: (regex, message) => (value) =>
            typeof value === "string" && value !== "" && !regex.test(value) ? message : null,

        nonNegativeInteger: (message) => (value) =>
            value !== null && (!Number.isInteger(value) || value < 0) ? message : null
    });

    /**
     * Lê e valida todos os campos, exibindo todos os erros de uma vez
     * e focando o primeiro campo inválido.
     * @returns {object|null} valores lidos (por `key`), ou null se inválido
     */
    function validateForm(fields) {
        const values = {};
        const inputs = {};

        fields.forEach((field) => {
            inputs[field.key] = document.getElementById(field.id);
            values[field.key] = field.read(inputs[field.key]);
        });

        let firstInvalid = null;

        fields.forEach((field) => {
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

        return values;
    }

    /** Remove mensagens de erro de todos os campos (ex.: ao cancelar/limpar o form). */
    function clearForm(fields) {
        fields.forEach((field) => {
            const input = document.getElementById(field.id);
            if (input) dom.clearFieldError(input);
        });
    }

    return Object.freeze({ read, rules, validateForm, clearForm });
})();
