# SiteOrders — versión modular completa

## Contenido

- `index.html`: estructura de la aplicación y modales.
- `css/styles.css`: todos los estilos.
- `js/config.js`: URL y clave pública anon de Supabase.
- `js/state.js`: estado compartido y constantes.
- `js/core.js`: inicialización y carga del perfil.
- `js/settings.js`: unidades y categorías.
- `js/projects-data.js`: carga y selectores de proyectos.
- `js/auth.js`: autenticación y aprobación pendiente.
- `js/navigation.js`: navegación y metadatos de páginas.
- `js/orders.js`: dashboard, pedidos y creación de solicitudes.
- `js/materials.js`: catálogo, inventario e imágenes.
- `js/users.js`: administración de usuarios.
- `js/projects-admin.js`: administración de proyectos.
- `js/documents.js`: generación de PDF y Excel.
- `js/ui.js`: modales y menú móvil.
- `js/material-returns.js`: devoluciones de materiales, borradores y PDF.
- `database/material-returns.sql`: tablas, permisos y almacenamiento privado para devoluciones.
- `assets/templates/material-request-template.xlsx`: plantilla Excel original.

## Cómo ejecutarla

No abras `index.html` directamente con `file://`, porque el navegador puede bloquear la carga de la plantilla Excel. Utiliza un servidor local.

### Opción con VS Code

1. Instala la extensión **Live Server**.
2. Abre esta carpeta.
3. Haz clic derecho en `index.html`.
4. Selecciona **Open with Live Server**.

### Opción con Python

Desde esta carpeta ejecuta:

```bash
python -m http.server 5500
```

Luego abre:

```text
http://localhost:5500
```

## Supabase

La aplicación conserva la URL y la clave pública `anon` que estaban en el archivo original. La protección real debe implementarse mediante políticas RLS en Supabase.

### Devoluciones de materiales

La migración `database/material-returns.sql` ya se aplicó al proyecto **MATERIAL REQUEST**. Para otra instancia de Supabase, ejecútala antes de usar esta página. El menú **Material Returns** está disponible para administrador, supervisor y trabajador (`encargado`). Se pueden guardar listas con proyecto, fecha, SKU (`materiales.id_material`), descripción, cantidad y unidad; los cambios se guardan en Supabase y se respaldan localmente mientras se sincronizan. Los trabajadores acceden a sus propias listas; administradores y supervisores acceden a todas.

Solamente administrador y supervisor pueden generar el PDF. Un administrador debe configurar primero el nombre de la empresa y subir el logo desde **Return Branding**. La imagen PNG se conserva en la ruta fija `company-logo.png` de un bucket privado; el PDF la obtiene de allí. El logo todavía no está cargado: súbelo desde esa pantalla antes de generar el primer PDF.

## Excel

Al abrir un pedido aparece el botón **Excel**. El archivo se genera localmente a partir de la plantilla incluida. No se guarda en Supabase Storage y no consume almacenamiento adicional del proyecto.

La plantilla admite 21 materiales originalmente. El código agrega filas adicionales y copia el formato cuando el pedido supera esa cantidad.

## Compatibilidad

Esta versión conserva los `onclick` del HTML y usa scripts tradicionales, no módulos ES. Esto permite dividir el proyecto sin reescribir simultáneamente toda la capa de eventos.
