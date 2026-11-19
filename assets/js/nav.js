(function () {
    "use strict";

    const placeholder = document.getElementById("site-navigation");
    if (!placeholder) return;

    const scriptUrl = new URL(document.currentScript.src);
    const templateUrl = new URL("../html/nav.html", scriptUrl);

    const path = window.location.pathname.replace(/\\/g, "/");
    const inAdmin = /\/admin\/[^/]*\.html$/i.test(path);
    const isLogin = /\/admin\/login\.html$/i.test(path);
    const base = inAdmin ? "../" : "./";

    fetch(templateUrl)
        .then((response) => {
            if (!response.ok) throw new Error("Não foi possível carregar a navegação.");
            return response.text();
        })
        .then((html) => {
            const documentTemplate = new DOMParser().parseFromString(html, "text/html");
            const type = isLogin ? "admin-login" : inAdmin ? "admin" : "public";
            const navTemplate = documentTemplate.querySelector(`#nav-${type}`);
            if (!navTemplate) throw new Error(`Modelo de navegação não encontrado: ${type}`);

            const nav = navTemplate.content.firstElementChild.cloneNode(true);
            nav.querySelectorAll("[href], [src]").forEach((element) => {
                ["href", "src"].forEach((attribute) => {
                    if (element.hasAttribute(attribute)) {
                        element.setAttribute(attribute, element.getAttribute(attribute).replaceAll("{{base}}", base));
                    }
                });
            });

            const fileName = path.split("/").pop() || "index.html";
            nav.querySelectorAll(".link").forEach((link) => {
                const linkPath = (link.getAttribute("href") || "").split(/[?#]/)[0];
                const isActive = (type === "public" && fileName === "index.html" && link.dataset.nav === "inicio")
                    || (type === "admin" && link.dataset.nav === fileName.replace(".html", ""));

                if (isActive) {
                    link.classList.add("active");
                    link.setAttribute("aria-current", "page");
                }

                if (linkPath && linkPath === base + fileName) {
                    link.classList.add("active");
                    link.setAttribute("aria-current", "page");
                }
            });

            placeholder.replaceWith(nav);
            document.dispatchEvent(new CustomEvent("navigationLoaded"));
        })
        .catch((error) => {
            console.error(error);
            placeholder.hidden = true;
        });
})();
