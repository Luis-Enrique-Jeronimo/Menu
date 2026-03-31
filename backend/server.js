const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Rutas absolutas a los archivos de datos
const dataPath = {
    menu: path.join(__dirname, 'data', 'menu.json'),
    promos: path.join(__dirname, 'data', 'promos.json')
};

// Middlewares
app.use(express.json()); // Para parsear el body de las peticiones POST/PUT
app.use(express.static(path.join(__dirname, '../frontend/public'))); // Servir vista cliente
app.use('/admin', express.static(path.join(__dirname, '../frontend/admin'))); // Servir vista admin

// ==========================================
// SEGURIDAD Y MIDDLEWARES
// ==========================================

// Set para almacenar en memoria los tokens de sesión activos
const validTokens = new Set();

// Middleware para proteger rutas
const verificarToken = (req, res, next) => {

    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
        return res.status(403).json({ error: 'Acceso denegado. Token requerido.' });
    }

    const token = authHeader.split(' ')[1];

    // 4. Validar si el token existe en nuestros registros activos
    if (!validTokens.has(token)) {
        return res.status(401).json({ error: 'Token inválido o sesión expirada.' });
    }

    next();
};

// ==========================================
// FUNCIONES AUXILIARES (Lógica de persistencia)
// ==========================================

// Leer datos de forma segura
async function readData(file) {
    try {
        const data = await fs.readFile(dataPath[file], 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error leyendo ${file}:`, error);
        // Si el archivo no existe, retornamos una estructura base
        return file === 'menu' ? { categorias: [] } : [];
    }
}

// Escribir datos de forma segura
async function writeData(file, data) {
    try {
        await fs.writeFile(dataPath[file], JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error(`Error escribiendo ${file}:`, error);
        throw new Error('No se pudo guardar la información');
    }
}

// ==========================================
// RUTAS RESTful (API)
// ==========================================

// --- ENDPOINTS DE MENÚ ---

// Leer todo el menú (Protegido)
app.get('/api/menu', async (req, res) => {
    const menu = await readData('menu');
    res.json(menu);
});

// Actualizar el menú completo (Protegido)
app.put('/api/menu', verificarToken, async (req, res) => {
    try {
        const newMenu = req.body;
        await writeData('menu', newMenu);
        res.json({ message: 'Menú actualizado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Agregar una nueva promoción (Protegido)
app.post('/api/promos', verificarToken, async (req, res) => {
    try {
        const promos = await readData('promos');
        const newPromo = { id: Date.now().toString(), ...req.body };
        promos.push(newPromo);
        
        await writeData('promos', promos);
        res.status(201).json({ message: 'Promoción creada', promo: newPromo });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ENDPOINTS DE PROMOCIONES ---

const nodemailer = require('nodemailer');

// ==========================================
// CONFIGURACIÓN DE AUTENTICACIÓN Y CORREO
// ==========================================

const otpStore = {}; 
const ADMIN_EMAIL = 'letitia61@ethereal.email';


const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
        user: 'letitia61@ethereal.email',
        pass: 'xFfFmJDGSuuTNvaC3d'
    }
});


// Ruta 1: Solicitar inicio de sesión (Generar y enviar OTP)
app.post('/api/auth/login', async (req, res) => {
    const { email } = req.body;

    if (email !== ADMIN_EMAIL) {
        return res.status(401).json({ error: 'Correo no autorizado' });
    }

    // Generar código de 6 dígitos
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Guardar código con expiración de 10 minutos
    otpStore[email] = {
        code: otpCode,
        expires: Date.now() + 10 * 60 * 1000 
    };
    

    try {
        const info = await transporter.sendMail({
            from: '"Sistema Coyo" <no-reply@cafescoyo.com>',
            to: email,
            subject: 'Tu código de acceso - Los Cafés de Coyo',
            text: `Tu código de acceso es: ${otpCode}. Expira en 10 minutos.`
        });
        
        res.json({ message: 'Código enviado al correo' });
    } catch (error) {
        console.error('Error enviando correo:', error);
        res.status(500).json({ error: 'Error al enviar el código' });
    }
});

// Ruta 2: Verificar el OTP y entregar el Token
app.post('/api/auth/verify', (req, res) => {
    const { email, code } = req.body;
    const record = otpStore[email];

    if (!record || record.code !== code) {
        return res.status(401).json({ error: 'Código inválido o incorrecto' });
    }

    if (Date.now() > record.expires) {
        delete otpStore[email];
        return res.status(401).json({ error: 'El código ha expirado' });
    }

    // Si es correcto, borramos el código usado y generamos un token simple
    delete otpStore[email];
    const sessionToken = `token_${Date.now()}_${Math.random().toString(36).substr(2)}`;
    
    validTokens.add(sessionToken);
    // Usar JWT en product.
    res.json({ message: 'Autenticación exitosa', token: sessionToken });
});

// Leer promociones activas (Público)
app.get('/api/promos', async (req, res) => {
    const promos = await readData('promos');
    res.json(promos);
});

// Agregar una nueva promoción (Admin)
app.post('/api/promos', async (req, res) => {
    try {
        const promos = await readData('promos');
        const newPromo = { id: Date.now().toString(), ...req.body };
        promos.push(newPromo);
        
        await writeData('promos', promos);
        res.status(201).json({ message: 'Promoción creada', promo: newPromo });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log(`Vista cliente: http://localhost:${PORT}/`);
    console.log(`Vista admin: http://localhost:${PORT}/admin`);
});

