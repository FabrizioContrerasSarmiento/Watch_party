# Next.js SaaS Starter with Firebase

Starter profesional para construir aplicaciones SaaS con Next.js, Firebase Authentication, Firebase Admin SDK, Cloud Firestore y Tailwind CSS.

La base prioriza renderizado server-side, rutas protegidas, sesion HTTP-only, aislamiento de datos por usuario y una estructura extensible para reemplazar la entidad `items` por la entidad principal de cada producto.

## SaaS

Una SaaS, o Software as a Service, es una aplicacion accesible desde internet en la que los usuarios utilizan funcionalidades sin instalar software localmente. La aplicacion se ejecuta en infraestructura remota y entrega su interfaz mediante el navegador.

En terminos funcionales, una SaaS suele incluir:

- Registro e inicio de sesion.
- Gestion de informacion propia por usuario.
- Panel privado o dashboard.
- Persistencia de datos.
- Rutas publicas y rutas protegidas.
- Roles y permisos.
- Funcionalidades especificas asociadas a un dominio.

Casos posibles:

- Gestor de proyectos.
- Administrador de gastos.
- Seguimiento de habitos.
- Catalogo de productos.
- Organizador de contenido.
- Registro de suscripciones.
- Administrador de clientes.
- Plataforma de publicaciones.
- Seguimiento de postulaciones.
- Panel de recursos educativos.

## Caracteristicas

- Next.js con App Router.
- JavaScript.
- Tailwind CSS.
- Dark mode.
- Tipografia Geist mediante `next/font`.
- Firebase Authentication.
- Inicio de sesion con email y contrasena.
- Inicio de sesion con Google.
- Sesion server-side mediante cookie HTTP-only.
- Firebase Admin SDK para validacion segura desde servidor.
- Cloud Firestore como base de datos.
- Rutas protegidas mediante middleware.
- Dashboard privado en `/dashboard`.
- Perfiles de usuario en la coleccion `users`.
- Roles simples mediante `user_type`.
- ABM base en `/dashboard/items`.
- Publicacion de registros en la home.
- Ruta publica por item en `/items/[id]`.
- Imagen local por defecto.
- Upload opcional con Cloud Storage for Firebase mediante `FIREBASE_STORAGE=true`.

## Arquitectura

El proyecto utiliza App Router y separa responsabilidades entre servidor y cliente.

- Las paginas son Server Components por defecto.
- Las operaciones de escritura utilizan Server Actions.
- La sesion se valida en servidor con Firebase Admin SDK.
- Los datos privados se filtran por `userId`.
- Los Client Components se utilizan para interactividad de UI, autenticacion client-side y formularios con estado local.

Estructura principal:

```txt
app/
  api/
    session/
      login/
      logout/
  dashboard/
    items/
    users/
  items/
    [id]/
  login/

components/
  items/
  users/

lib/
  firebase/
  items/
  users/
```

## Requisitos

- Node.js compatible con Next.js 16.
- Proyecto Firebase.
- Authentication habilitado.
- Cloud Firestore habilitado.
- Cuenta de servicio de Firebase Admin SDK.

Cloud Storage for Firebase es opcional. El modo predeterminado utiliza imagenes locales dentro de `public`.

## Configuracion

1. Instalar dependencias:

```bash
npm install
```

2. Copiar las variables de entorno:

```bash
cp .env.example .env
```

3. Completar `.env` con los datos de Firebase Web App y Firebase Admin SDK.

4. En Firebase Console habilitar Authentication con:

- Email/Password.
- Google.

5. Habilitar Cloud Firestore.

6. Mantener `FIREBASE_STORAGE=false` para utilizar imagenes locales.

7. Ejecutar el servidor de desarrollo:

```bash
npm run dev
```

8. Abrir la aplicacion:

```txt
http://localhost:3000
```

## Variables De Entorno

Ejemplo completo:

```bash
# Firebase Web App
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Storage
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
FIREBASE_STORAGE=false

# Firebase Admin SDK
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Las variables con prefijo `NEXT_PUBLIC_` son visibles desde el cliente. Las variables `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY` son privadas y se utilizan desde Firebase Admin SDK en el servidor.

La clave privada debe conservar los saltos de linea escapados mediante `\n`.

El archivo `.env` no debe subirse al repositorio.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Autenticacion

El proyecto incluye autenticacion con Firebase Authentication.

Metodos incluidos:

- Email y contrasena.
- Google.

Al iniciar sesion, el cliente obtiene el ID token de Firebase y lo envia a `/api/session/login`. El servidor crea una session cookie HTTP-only que luego se valida desde Server Components, Server Actions y middleware.

Las rutas privadas redirigen a `/login` si no existe una sesion valida.

## Usuarios Y Roles

Cada usuario autenticado tiene un documento asociado en la coleccion `users`.

Ejemplo:

```js
{
  email: "usuario@example.com",
  displayName: "Usuario",
  provider: "google.com",
  user_type: "user",
  createdAt: "...",
  updatedAt: "...",
  lastLoginAt: "..."
}
```

Los usuarios creados desde la web se registran con `user_type: "user"`.

Si un usuario tiene `user_type: "admin"`, puede acceder al panel de administracion de usuarios desde `/dashboard/users`.

Para crear el primer administrador, modificar manualmente en Firestore el documento correspondiente dentro de `users` y cambiar `user_type` a `"admin"`.

## Firestore

El ABM base utiliza la coleccion `items`.

Cada documento guarda la relacion con el usuario autenticado mediante `userId`.

Ejemplo:

```js
{
  userId: "uid-del-usuario",
  title: "Registro de ejemplo",
  description: "Descripcion del registro",
  status: "pending",
  published: false,
  imageUrl: "/items/ejemplo.jpg",
  imagePath: "",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
}
```

El acceso a datos privados debe conservar siempre la validacion de propiedad:

- Un usuario solo lista sus propios documentos.
- Un usuario solo edita sus propios documentos.
- Un usuario solo elimina sus propios documentos.
- Los registros publicados pueden consultarse desde rutas publicas.

## Adaptacion De La Entidad Principal

La entidad `items` funciona como referencia inicial. Para construir un producto real, puede reemplazarse por una entidad propia del dominio.

Ejemplos:

- `projects`
- `products`
- `expenses`
- `clients`
- `posts`
- `courses`

Al adaptar la entidad, revisar:

- Nombre de la coleccion en Firestore.
- Rutas dentro de `/dashboard`.
- Server Actions de creacion, edicion y eliminacion.
- Campos del formulario.
- Validaciones.
- Listados privados.
- Vistas publicas, si corresponde.
- Carpeta de imagenes locales.
- Reglas de Storage, si se usa Firebase Storage.

## Imagenes

El proyecto soporta dos estrategias para imagenes:

- Imagen local en `public`, activa por defecto.
- Cloud Storage for Firebase, opcional mediante `FIREBASE_STORAGE=true`.

### Imagen Local

Esta es la opcion predeterminada.

Las imagenes deben ubicarse dentro de la carpeta `public`. Por ejemplo:

```txt
public/
  items/
    ejemplo.jpg
```

En el formulario debe ingresarse solamente el nombre del archivo:

```txt
ejemplo.jpg
```

La aplicacion transforma ese valor en la ruta publica:

```txt
/items/ejemplo.jpg
```

Documento resultante:

```js
{
  imageUrl: "/items/ejemplo.jpg",
  imagePath: ""
}
```

Para otra entidad, usar una carpeta equivalente. Por ejemplo:

```txt
public/
  products/
    producto.jpg
```

## Firebase Storage Opcional

Cloud Storage for Firebase puede activarse para permitir upload de archivos desde el formulario.

Configuracion requerida:

1. Habilitar Cloud Storage for Firebase en Firebase Console.
2. Verificar que el proyecto este en plan Blaze si Firebase lo requiere.
3. Completar `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`.
4. Configurar `FIREBASE_STORAGE=true`.
5. Reiniciar el servidor de desarrollo.

Reglas sugeridas para Storage con la entidad `items`:

```js
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /items/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

En modo Storage, las imagenes se guardan con este formato:

```txt
items/{uid-del-usuario}/{id-del-item-o-uploads}/{timestamp}.jpg
```

Documento resultante:

```js
{
  imageUrl: "https://firebasestorage.googleapis.com/...",
  imagePath: "items/uid/itemId/archivo.jpg"
}
```

Para otra entidad, actualizar la ruta y las reglas. Por ejemplo, con `products`:

- Carpeta local: `public/products`.
- Ruta local guardada: `/products/imagen.jpg`.
- Ruta en Storage: `products/{uid}/{id}/{archivo}`.
- Regla de Storage: `match /products/{userId}/{allPaths=**}`.

## Pricing De Firebase

Valores consultados en la pagina oficial de Firebase Pricing el 27 de agosto de 2026.

Fuente: https://firebase.google.com/pricing

### Plan Spark

Spark es el plan sin costo inicial y no requiere metodo de pago.

Limites relevantes:

- Authentication: email/password y proveedores sociales incluidos.
- Authentication con Identity Platform: hasta 50.000 usuarios activos mensuales.
- Cloud Firestore Standard: 1 GiB de datos almacenados.
- Cloud Firestore Standard: 50.000 lecturas de documentos por dia.
- Cloud Firestore Standard: 20.000 escrituras de documentos por dia.
- Cloud Firestore Standard: 20.000 eliminaciones de documentos por dia.
- Cloud Firestore Standard: 10 GiB de egreso de red por mes.
- Firebase Hosting: 10 GB de almacenamiento.
- Firebase Hosting: 360 MB por dia de transferencia.

Consideracion sobre Storage:

- En proyectos nuevos, Firebase puede requerir actualizar a Blaze para utilizar Cloud Storage for Firebase.
- Por ese motivo, este starter usa imagenes locales por defecto y deja Storage como opcion configurable.

### Plan Blaze

Blaze es el plan de pago por uso. Requiere vincular una cuenta de facturacion, incluye cuotas sin costo y cobra el uso excedente segun el producto.

Cuotas sin costo relevantes en Blaze:

- Authentication con Identity Platform: hasta 50.000 usuarios activos mensuales; luego aplica pricing de Google Cloud.
- Cloud Firestore Standard: hasta 1 GiB de datos almacenados; luego aplica pricing de Google Cloud.
- Cloud Firestore Standard: hasta 50.000 lecturas por dia; luego aplica pricing de Google Cloud.
- Cloud Firestore Standard: hasta 20.000 escrituras por dia; luego aplica pricing de Google Cloud.
- Cloud Firestore Standard: hasta 20.000 eliminaciones por dia; luego aplica pricing de Google Cloud.
- Cloud Firestore Standard: hasta 10 GiB de egreso por mes; luego aplica pricing de Google Cloud.

Cloud Storage en Blaze para buckets `*.firebasestorage.app` y buckets adicionales:

- Hasta 5 GB-mes almacenados sin costo; luego aplica pricing de Google Cloud Storage.
- Hasta 100 GB descargados por mes sin costo; luego aplica pricing de Google Cloud Storage.
- Hasta 5.000 operaciones de upload por mes sin costo; luego aplica pricing de Google Cloud Storage.
- Hasta 50.000 operaciones de download por mes sin costo; luego aplica pricing de Google Cloud Storage.

Cloud Storage en Blaze para buckets legacy `*.appspot.com`:

- Hasta 5 GB almacenados sin costo; luego USD 0,026 por GB.
- Hasta 1 GB descargado por dia sin costo; luego USD 0,12 por GB.
- Hasta 20.000 operaciones de upload por dia sin costo; luego USD 0,05 cada 10.000 operaciones.
- Hasta 50.000 operaciones de download por dia sin costo; luego USD 0,004 cada 10.000 operaciones.

Los importes pueden variar por region, producto y cambios de pricing. Para estimaciones productivas debe utilizarse la calculadora oficial de Firebase.

## Desarrollo

Comandos habituales:

```bash
npm run dev
npm run lint
npm run build
```

En desarrollo, Next.js compila rutas bajo demanda. La navegacion puede sentirse mas lenta que en una build productiva ejecutada con:

```bash
npm run build
npm run start
```

## Declaración de uso de inteligencia artificial — Watch Party

Para desarrollar este proyecto utilicé herramientas de inteligencia artificial generativa en distintas etapas del proceso: la búsqueda y organización de ideas, la definición de la experiencia, el diseño visual, la programación y la resolución de problemas técnicos. Las herramientas utilizadas fueron ChatGPT, la generación de imágenes integrada en ChatGPT y Codex para trabajar directamente sobre el código del proyecto.

Al comienzo, usé la IA para explorar cómo transformar la base de una aplicación SaaS en una plataforma de Watch Party. A partir de distintas conversaciones fui definiendo una experiencia en la que una persona puede crear una sala privada, compartir un código o enlace de invitación y mirar videos de YouTube de manera sincronizada con otros participantes. Las propuestas se revisaron y modificaron según mis decisiones, las pruebas realizadas y las necesidades que aparecieron durante el desarrollo.

En la parte visual, la IA colaboró con la elaboración de la identidad de la plataforma y con la organización de sus interfaces. Esto incluyó la landing page, el dashboard, la creación y el listado de salas, el perfil de usuario, los modales de acceso mediante código y la sala de reproducción. También la utilicé para generar y ajustar recursos gráficos, trabajar la estética oscura con acentos verdes, mejorar jerarquías, estados, mensajes de respuesta y adaptar la experiencia a computadoras y dispositivos móviles. Los resultados se iteraron para mantener coherencia visual y mejorar la legibilidad y la navegación.

En programación, la participación de la IA incluyó explicaciones, sugerencias y generación o modificación de partes del código. Utilicé Codex para trabajar con Next.js, React, Tailwind CSS y Firebase; implementar autenticación mediante correo, contraseña y Google; mantener sesiones seguras con cookies HTTP-only; proteger rutas; gestionar perfiles y roles; y persistir usuarios y salas. También colaboró en la creación, validación, listado y eliminación de Watch Parties, la generación de códigos de sala simples, el ingreso mediante código o enlace y las verificaciones de propiedad y acceso.

La IA también intervino en las funciones en tiempo real de la sala: integración del reproductor de YouTube, sincronización de reproducción, pausa y posición, selección y cola de videos, chat, reacciones, participantes, encuestas y controles exclusivos para el anfitrión. Además, colaboró en la implementación de comunicación mediante WebRTC para voz, micrófono, cámara y pantalla compartida, junto con indicadores de actividad, modos de visualización y limpieza de conexiones al abandonar una sala.

Durante el desarrollo se consultaron y probaron distintas alternativas técnicas para comunicar a los participantes. La solución pasó por Socket.IO y un servidor personalizado antes de trasladar el estado y los eventos de las salas a Firebase Realtime Database. La IA ayudó a analizar errores de autenticación, sincronización, rutas, cuerpos de solicitudes, variables de entorno, comportamiento responsive, ejecución local, Git, GitHub y despliegue. Estas respuestas no se incorporaron de forma automática: fueron revisadas, probadas y corregidas según el funcionamiento real del proyecto.

Los videos reproducidos pertenecen a YouTube y conservan sus autorías, condiciones y licencias correspondientes; Watch Party no los aloja ni los presenta como contenido propio. Del mismo modo, las tipografías, iconos, sonidos, imágenes y demás recursos externos o preexistentes incorporados al proyecto mantienen sus respectivas autorías y licencias. Los recursos generados con IA se utilizaron únicamente como parte de la presentación de esta experiencia.

Mi participación consistió en definir la dirección del proyecto, formular los pedidos, seleccionar y organizar los recursos, evaluar las propuestas, tomar decisiones de diseño y arquitectura, integrar las distintas partes y probar cada interacción. El proceso incluyó resultados que necesitaron ajustes, funciones que se descartaron o reformularon y soluciones técnicas que cambiaron durante el desarrollo. Esta declaración reconoce una participación amplia de la IA, tanto creativa como técnica, y distingue ese aporte de los recursos externos y de las decisiones tomadas por mí para construir la versión final de Watch Party.
