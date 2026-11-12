/*
 * Página de login do painel (admin/login.html).
 */
(function loginPage() {
    "use strict";

    const DEFAULT_PAGE = "index.html";
    // Só aceita redirecionar para páginas locais do painel (evita open redirect).
    const SAFE_PAGE_PATTERN = /^[a-z0-9-]+\.html$/;
    const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const GENERIC_LOGIN_ERROR = "E-mail ou senha inválidos.";
    const UNEXPECTED_ERROR = "Não foi possível entrar agora. Tente novamente em instantes.";

    const form = document.getElementById("form-login");
    const emailInput = document.getElementById("campo-email");
    const passwordInput = document.getElementById("campo-senha");
    const submitButton = form.querySelector("button[type='submit']");
    const feedback = document.getElementById("login-feedback");

    function resolveRedirectTarget() {
        const requested = new URLSearchParams(window.location.search).get("redirect");
        if (requested && SAFE_PAGE_PATTERN.test(requested) && requested !== "login.html") {
            return requested;
        }
        return DEFAULT_PAGE;
    }

    function goToPanel() {
        window.location.replace(resolveRedirectTarget());
    }

    async function redirectIfAuthenticated() {
        const { session } = await authService.getSession();
        if (!session) return;

        const { user } = await authService.getUser();
        if (user) goToPanel();
    }

    function validate() {
        let isValid = true;

        dom.clearFieldError(emailInput);
        dom.clearFieldError(passwordInput);

        const email = emailInput.value.trim();
        if (!email) {
            dom.showFieldError(emailInput, "Informe o e-mail.");
            isValid = false;
        } else if (!EMAIL_PATTERN.test(email)) {
            dom.showFieldError(emailInput, "Informe um e-mail válido.");
            isValid = false;
        }

        if (!passwordInput.value) {
            dom.showFieldError(passwordInput, "Informe a senha.");
            isValid = false;
        }

        if (!isValid) {
            form.querySelector("[aria-invalid='true']")?.focus();
        }

        return isValid;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        dom.hideFeedback(feedback);

        if (!validate()) return;

        dom.setLoading(submitButton, true, "Entrando...");

        try {
            const { user, error } = await authService.signIn(emailInput.value.trim(), passwordInput.value);

            if (error || !user) {
                // 400 = credenciais inválidas. Mensagem genérica: não revela se o e-mail existe.
                const message = error?.status === 400 ? GENERIC_LOGIN_ERROR : UNEXPECTED_ERROR;
                dom.showFeedback(feedback, "error", message);
                passwordInput.value = "";
                passwordInput.focus();
                return;
            }

            goToPanel();
        } catch (error) {
            console.error("[login] Erro inesperado:", error);
            dom.showFeedback(feedback, "error", UNEXPECTED_ERROR);
        } finally {
            dom.setLoading(submitButton, false);
        }
    });

    redirectIfAuthenticated().catch((error) => {
        console.error("[login] Falha ao verificar sessão existente:", error);
    });
})();
