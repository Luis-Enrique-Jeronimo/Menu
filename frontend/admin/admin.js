let authToken = null;
let correoActual = '';
let menuData = null;

// ==========================================
// LÓGICA DE AUTENTICACIÓN
// ==========================================

async function solicitarCodigo() {
    const email = document.getElementById('admin-email').value;
    const msgEl = document.getElementById('login-msg');
    
    if (!email) return msgEl.innerText = "Ingresa un correo válido.";

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();

        if (res.ok) {
            correoActual = email;
            document.getElementById('step-email').classList.add('hidden');
            document.getElementById('step-otp').classList.remove('hidden');
            msgEl.innerText = "Código enviado. Revisa tu bandeja.";
            msgEl.style.color = "green";
        } else {
            msgEl.innerText = data.error;
            msgEl.style.color = "red";
        }
    } catch (error) {
        msgEl.innerText = "Error de conexión.";
    }
}

async function verificarCodigo() {
    const code = document.getElementById('admin-otp').value;
    const msgEl = document.getElementById('login-msg');

    try {
        const res = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: correoActual, code })
        });
        const data = await res.json();

        if (res.ok) {
            authToken = data.token; // Guardamos el token en memoria
            document.getElementById('login-section').classList.add('hidden');
            document.getElementById('dashboard-section').classList.remove('hidden');
            iniciarDashboard();
        } else {
            msgEl.innerText = data.error;
        }
    } catch (error) {
        msgEl.innerText = "Error al verificar.";
    }
}

function cerrarSesion() {
    authToken = null;
    document.getElementById('dashboard-section').classList.add('hidden');
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('step-otp').classList.add('hidden');
    document.getElementById('step-email').classList.remove('hidden');
    document.getElementById('admin-email').value = '';
    document.getElementById('admin-otp').value = '';
    document.getElementById('login-msg').innerText = '';
}

// ==========================================
// LÓGICA DEL DASHBOARD Y CRUD
// ==========================================

async function iniciarDashboard() {
    await cargarMenuEditor();
    await cargarPromosEditor();
}

// --- CRUD MENÚ ---

async function cargarMenuEditor() {
    const res = await fetch('/api/menu');
    menuData = await res.json();
    renderizarMenuEditor();
}

function renderizarMenuEditor() {
    const contenedor = document.getElementById('editor-menu');
    let html = '';

    menuData.categorias.forEach((cat, catIndex) => {
        html += `
            <div class="categoria-edit">
                <h4>${cat.nombre}</h4>
                <ul>
        `;
        cat.articulos.forEach((art, artIndex) => {
            html += `
                <li>
                    <input type="text" value="${art.nombre}" onchange="actualizarArticulo(${catIndex}, ${artIndex}, 'nombre', this.value)">
                    <input type="number" value="${art.precio}" onchange="actualizarArticulo(${catIndex}, ${artIndex}, 'precio', this.value)">
                    <button onclick="eliminarArticulo(${catIndex}, ${artIndex})" class="btn-danger btn-sm">X</button>
                </li>
            `;
        });
        html += `
                </ul>
                <button onclick="agregarArticulo(${catIndex})" class="btn-sm">Añadir a ${cat.nombre}</button>
            </div>
        `;
    });
    contenedor.innerHTML = html;
}

function actualizarArticulo(catIndex, artIndex, campo, valor) {
    menuData.categorias[catIndex].articulos[artIndex][campo] = campo === 'precio' ? Number(valor) : valor;
}

function eliminarArticulo(catIndex, artIndex) {
    menuData.categorias[catIndex].articulos.splice(artIndex, 1);
    renderizarMenuEditor();
}

function agregarArticulo(catIndex) {
    const nuevoId = Date.now().toString();
    menuData.categorias[catIndex].articulos.push({ id: nuevoId, nombre: "Nuevo Artículo", precio: 0 });
    renderizarMenuEditor();
}

async function guardarMenu() {
    // Al guardar, enviamos el objeto completo modificado. 
    // Aquí es donde el backend necesitaría validar el authToken (que implementaremos si lo requieres).
    try {
        const res = await fetch('/api/menu', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}` 
            },
            body: JSON.stringify(menuData)
        });
        if (res.ok) alert('Menú actualizado correctamente en el servidor.');
    } catch (error) {
        alert('Error al guardar el menú.');
    }
}

// --- CRUD PROMOCIONES ---

async function cargarPromosEditor() {
    const res = await fetch('/api/promos');
    const promos = await res.json();
    const lista = document.getElementById('lista-promos');
    
    lista.innerHTML = promos.map(p => `
        <li style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">
            <div>
                <strong>${p.titulo}</strong> - ${p.descripcion}
            </div>
            <button onclick="eliminarPromocion('${p.id}')" class="btn-danger btn-sm">Eliminar</button>
        </li>
    `).join('');
}

async function eliminarPromocion(id) {
    if (!confirm('¿Seguro que deseas eliminar esta promoción?')) return;

    try {
        const res = await fetch(`/api/promos/${id}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (res.ok) {
            cargarPromosEditor(); // Recargamos la lista desde el servidor
        } else {
            alert("Error al eliminar la promoción");
        }
    } catch (error) {
        alert("Error de conexión al intentar eliminar");
    }
}

async function crearPromocion() {
    const titulo = document.getElementById('promo-titulo').value;
    const desc = document.getElementById('promo-desc').value;

    if (!titulo || !desc) return alert("Completa los campos");

    try {
        const res = await fetch('/api/promos', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ titulo, descripcion: desc, activa: true })
        });
        
        if (res.ok) {
            document.getElementById('promo-titulo').value = '';
            document.getElementById('promo-desc').value = '';
            cargarPromosEditor(); // Recargar lista
        }
    } catch (error) {
        alert("Error al crear promoción");
    }
}

// Eliminar una promoción (Protegido)
app.delete('/api/promos/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        let promos = await readData('promos');
        
        // Filtramos el arreglo para excluir el ID proporcionado
        const promosFiltradas = promos.filter(p => p.id !== id);

        // Si la longitud es la misma, el ID no existía
        if (promos.length === promosFiltradas.length) {
            return res.status(404).json({ error: 'Promoción no encontrada' });
        }

        // Sobreescribimos el archivo con el nuevo arreglo
        await writeData('promos', promosFiltradas);
        res.json({ message: 'Promoción eliminada correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});