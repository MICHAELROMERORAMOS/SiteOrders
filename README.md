# SiteOrders — versión modular completa

## Contenido

- `index.html`: estructura de la aplicación y modales.
- `css/styles.css`: todos los estilos.
- `js/config.js`: URL y clave pública anon de Supabase.
- `js/state.js`: estado compartido y constantes.
- `js/core.js`: inicialización y carga del perfil.
- `js/settings.js`: unidades, categorías y control administrativo de consecutivos.
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
- `database/document-sequence-settings.sql`: RPCs administrativos para consultar y definir el próximo consecutivo de Material Requests y Material Returns.
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

Las migraciones `database/material-returns.sql`, `database/material-returns-project-sequence.sql`, `database/material-returns-counter-hardening.sql`, `database/material-return-review-workflow.sql` y `database/material-return-draft-delete.sql` se aplican en ese orden. La última reinicia los números existentes sin eliminar devoluciones ni materiales. El menú **Material Returns** está disponible para administrador, supervisor y trabajador (`encargado`). La vista principal agrupa las devoluciones por proyecto; dentro de cada proyecto separa borradores y Returns numerados, y el editor se abre en una ventana amplia independiente. Se pueden guardar borradores con proyecto, fecha, SKU (`materiales.id_material`), descripción, cantidad y unidad; los cambios se guardan en Supabase y se respaldan localmente mientras se sincronizan. Los trabajadores acceden a sus propias listas; administradores y supervisores acceden a todas. Cada proyecto comienza en 001: seleccionar un proyecto y guardar borradores no consume números; el número se asigna al enviar la devolución a revisión.

Una devolución enviada a revisión queda bloqueada. Solo un administrador puede permitir su edición de nuevo; conserva el mismo número al volver a enviarla. Los borradores que nunca se han enviado a revisión pueden eliminarse con confirmación. Una devolución que ya recibió consecutivo no puede borrarse, incluso si un administrador la reabre para edición. Los materiales de un borrador también pueden quitarse individualmente con confirmación. Los tres roles pueden generar el PDF de una devolución enviada, que incluye el número, quien lo generó y una casilla de recepción por línea. Un administrador configura el nombre de la empresa y sube el logo desde **Company Branding**. La imagen PNG se conserva en la ruta fija `company-logo.png` de un bucket privado y se reutiliza tanto en el PDF de Material Return como en el PDF de Material Request. Solo administradores y supervisores pueden eliminar Material Requests; los supervisores se limitan a sus proyectos.


### Consecutivos de documentos

En **Settings → Document Sequences**, únicamente el administrador puede consultar el último número emitido y definir el próximo número. Material Returns mantiene un consecutivo por proyecto. Material Requests mantiene el consecutivo del documento por proyecto y solicitante, ya que el nombre incluye las iniciales del solicitante. Un número ya emitido no puede reutilizarse; sí es posible bajar un contador que había avanzado por pruebas siempre que ese número no exista todavía.

## Excel

Al abrir un pedido aparece el botón **Excel**. El archivo se genera localmente a partir de la plantilla incluida. No se guarda en Supabase Storage y no consume almacenamiento adicional del proyecto.

La plantilla admite 21 materiales originalmente. El código agrega filas adicionales y copia el formato cuando el pedido supera esa cantidad.

## Compatibilidad

Esta versión conserva los `onclick` del HTML y usa scripts tradicionales, no módulos ES. Esto permite dividir el proyecto sin reescribir simultáneamente toda la capa de eventos.
