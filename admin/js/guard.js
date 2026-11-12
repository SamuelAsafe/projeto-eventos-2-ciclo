/*
 * Proteção das páginas do painel administrativo.
 *
 * Uso: carregar no <head> de toda página protegida, depois de supabaseClient.js
 * e authService.js, com <html data-auth="required">.
 * O CSS esconde o <body> enquanto o atributo existir, evitando "flash" de conteúdo.
 *
 * IMPORTANTE: isto é proteção de interface. A proteção real dos dados é feita
 * pelas políticas de RLS no Supabase.
 */
(function authGuard() {
    "use strict";

    const LOGIN_PAGE = "login.html";
    const root = document.documentElement;
    let isLoggingOut = false;

    function currentPage() {
        return window.location.pathname.split("/").pop() || "index.html";
    }

    function redirectToLogin({ keepReturnPage = true } = {}) {
        const page = currentPage();
        const target = keepReturnPage && page !== "index.html"
            ? `${LOGIN_PAGE}?redirect=${encodeURIComponent(page)}`
            : LOGIN_PAGE;

        // replace: a página protegida não fica no histórico (botão "voltar" não retorna a ela)
        window.location.replace(target);
    }

    async function verifyAccess() {
        try {
            // 1. Checagem rápida local: sem sessão salva, nem consulta o servidor.
            const { session } = await authService.getSession();
            if (!session) {
                redirectToLogin();
                return;
            }

            // 2. Validação no servidor: cobre token revogado ou usuário removido.
            const { user, error } = await authService.getUser();
            if (error || !user) {
                await authService.signOut();
                redirectToLogin();
                return;
            }

            root.removeAttribute("data-auth");
        } catch (error) {
            console.error("[authGuard] Falha ao verificar sessão:", error);
            redirectToLogin();
        }
    }

    function bindLogout() {
        const logoutLink = document.getElementById("logout");
        if (!logoutLink) return;

        logoutLink.addEventListener("click", async (event) => {
            event.preventDefault();
            isLoggingOut = true;
            await authService.signOut();
            redirectToLogin({ keepReturnPage: false });
        });
    }

    // Sessão encerrada em outra aba ou expirada sem possibilidade de refresh.
    authService.onAuthChange((event) => {
        if (event === "SIGNED_OUT" && !isLoggingOut) {
            redirectToLogin();
        }
    });

    verifyAccess();

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bindLogout);
    } else {
        bindLogout();
    }
})();
