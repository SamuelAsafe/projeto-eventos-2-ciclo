const eventsController = {
    slugify: (text) => {
    return text
        .toString()
        .normalize('NFD') // Separa os acentos das letras
        .replace(/[\u0300-\u036f]/g, '') // Remove os acentos
        .toLowerCase() // Converte para minúsculas
        .trim() // Remove espaços do início e do fim
        .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
        .replace(/[\s_-]+/g, '-') // Substitui espaços e underscores por hífens
        .replace(/^-+|-+$/g, ''); // Remove hífens do começo e do fim
    },
    templateItem: (item) => {
        return `
            <tr>
                <td>${item.nome}</td>
                <td>${item.categoria.nome}</td>
                <td>${item.data}</td>
                <td>${item.local}</td>
                <td>${item.vagas_restantes} / ${item.vagas_totais}</td>
                <td class="actions">
                    <a class="btn-sm btn-edit" href="inscritos.html?evento=${item.id}">Ver inscritos</a>
                    <button type="button" class="btn-sm btn-edit">Editar</button>
                    <button type="button" class="btn-sm btn-delete">Excluir</button>
                </td>
            </tr>
        ` 
    },
    list: async () => {
        const eventsList = await supabaseClient.from("eventos").select(`
                *,
                categoria:categorias(*)
            `)
        return eventsList.data;
    },
    mountCategories: async () => {
        const categories = await categoriesController.list()

        const template = categories.map(item => {
            return `<option value="${item.id}">${item.nome}</option>`
        }).join("")

        document.querySelector("#campo-categoria").innerHTML = template
    },
    getFormData: () => {
        const nome = document.querySelector("#campo-titulo").value;
        const categoria_id = document.querySelector("#campo-categoria").value;
        const data = document.querySelector("#campo-data").value;
        const horario = document.querySelector("#campo-horario").value;
        const local = document.querySelector("#campo-local").value;
        const endereco = document.querySelector("#campo-endereco").value;
        const responsavel = document.querySelector("#campo-organizador").value;
        const vagas_totais = document.querySelector("#campo-vagas-totais").value;
        const vagas_restantes = document.querySelector("#campo-vagas-restantes").value;
        const destaque = document.querySelector("#campo-destaque").checked;
        const descricao = document.querySelector("#campo-descricao").value;
        const slug = eventsController.slugify(nome);

        return {
            nome,
            categoria_id,
            data,
            horario,
            local,
            endereco,
            vagas_totais,
            vagas_restantes,
            destaque,
            descricao,
            responsavel,
            slug
        }
    },
    bindEventButton: () => {
        document.querySelector("#salvar-evento").addEventListener("click", async ()=> {
            const data = eventsController.getFormData()
            console.log("data", data)
            eventsController.populateEventTable()

            const event = await supabaseClient.from("eventos").insert(data).select()
            if(event.data.id){
                alert(`O evento  ${event.data.id} foi inserido com sucesso`)
            }
        })
    },
    populateEventTable: async () => {
        document.querySelector("#events").innerHTML = ""
        const events = await eventsController.list()
        
        const template = events.map(item => {
            return eventsController.templateItem(item)
        }).join("")
    
        document.querySelector("#events").innerHTML = template
        
    },
    init: async () => {
        eventsController.mountCategories()
        eventsController.bindEventButton()
        eventsController.populateEventTable()
    }
}

document.addEventListener("DOMContentLoaded", eventsController.init)
