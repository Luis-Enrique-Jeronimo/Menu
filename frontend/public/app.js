document.addEventListener('DOMContentLoaded', () => {
    cargarPromociones();
    cargarMenu();
});

async function cargarPromociones() {
    try {
        const respuesta = await fetch('/api/promos');
        const promos = await respuesta.json();
        const contenedor = document.getElementById('promociones-container');

        const promosActivas = promos.filter(p => p.activa);

        if (promosActivas.length > 0) {
            contenedor.classList.remove('hidden');
            let html = '<h2>Promociones Especiales</h2>';
            promosActivas.forEach(promo => {
                html += `
                    <div class="promo-card">
                        <h3>${promo.titulo}</h3>
                        <p>${promo.descripcion}</p>
                    </div>
                `;
            });
            contenedor.innerHTML = html;
        }
    } catch (error) {
        console.error('Error cargando promociones:', error);
    }
}

async function cargarMenu() {
    try {
        const respuesta = await fetch('/api/menu');
        const datos = await respuesta.json();
        const contenedor = document.getElementById('menu-container');

        let html = '';
        datos.categorias.forEach(categoria => {
            html += `
                <section class="categoria-card">
                    <div class="categoria-header">
                        <h2>${categoria.nombre.toUpperCase()}</h2>
                    </div>
                    <ul class="articulos-lista">
            `;
            
            categoria.articulos.forEach(articulo => {
                html += `
                    <li class="articulo-item">
                        <span class="articulo-nombre">${articulo.nombre.toUpperCase()}</span>
                        <span class="articulo-precio">$${articulo.precio}</span>
                    </li>
                `;
            });

            html += `
                    </ul>
                </section>
            `;
        });

        contenedor.innerHTML = html;
    } catch (error) {
        console.error('Error cargando el menú:', error);
        document.getElementById('menu-container').innerHTML = '<p>Error al cargar el menú. Intenta nuevamente más tarde.</p>';
    }
}