# Dostov

Tablero personal de tareas inspirado en `real-portfolio`: fondo negro con cuadrícula, tonos marfil, Archivo e IBM Plex Mono alojadas localmente. Interfaz en español, adaptable a móvil y sin servicios externos.

## Ejecutar localmente

Requiere Node.js 24 o superior. No necesita instalar dependencias. Copia `.env.example` a `.env` y completa `APP_PASSWORD` antes de iniciar. El usuario es `xergno`; las plantillas y el archivo `.env` entregado no contienen contraseña.

```sh
npm start
```

Abre http://localhost:3100 usando la plantilla local. Para reinicio automático durante desarrollo: `npm run dev`. Para pruebas: `npm test`.

## Uso

- Crea tareas con título y descripción. La fecha de inicio corresponde a su creación y la registra el servidor.
- Cada tarea recibe un color de una paleta de 12 tonos, que se conserva al editarla o moverla. La paleta vuelve a empezar después de 12 tareas. El tablero ocupa el área principal y el resumen aparece debajo.
- Pulsa una tarjeta para editarla o cambiar su estado. También puedes arrastrarla entre columnas en escritorio.
- Desde la ficha de una tarea, pulsa **Eliminar tarea** y confirma para borrarla permanentemente. El tablero y los contadores se actualizan automáticamente.
- Estados: Pendientes, En proceso, Finalizado y Cancelado.
- Al finalizar, el servidor registra la fecha de término. Editar una tarea finalizada conserva esa fecha. Reabrirla elimina la fecha de término; finalizarla nuevamente registra una nueva.
- Cancelar exige un motivo. Al salir de Cancelado se borra ese motivo. No se mantiene un historial de transiciones.
- La búsqueda incluye título, descripción y motivo. El progreso excluye tareas canceladas.
- Los datos se guardan en SQLite en `data/dostov.sqlite`, no en el navegador. El tablero es personal, compartido por quienes accedan con sus credenciales. Recarga para ver cambios de otra sesión; ante ediciones simultáneas prevalece la última.

## Docker y Dokploy desde GitHub

Este proyecto está preparado para desplegarse, pero no se ha subido a GitHub ni publicado.

Consulta [la guía paso a paso de GitHub y Dokploy](docs/DEPLOY.md), con comandos y variables listas para completar. `.env.production.example` contiene la configuración del contenedor sin contraseña.

1. Cuando decidas publicarlo, crea tu repositorio de GitHub y sube estos archivos. `.gitignore` excluye datos y secretos.
2. En Dokploy crea una aplicación con ese repositorio como origen y selecciona **Dockerfile** como método de construcción, ruta `Dockerfile` y contexto raíz.
3. Configura `APP_USER` y `APP_PASSWORD` con tus credenciales; son obligatorias. No incluyas secretos en GitHub. La aplicación muestra una pantalla de login y permite cerrar sesión desde el tablero.
4. Configura un volumen persistente montado en **`/app/data`**. Sin él, recrear el contenedor puede perder las tareas.
5. Configura tu dominio con puerto interno **3000** y HTTPS. Ejecuta una sola réplica; SQLite reside en ese volumen.
6. Despliega desde Dokploy cuando lo decidas. `/health` sirve para comprobaciones de disponibilidad y no expone tareas.

Para usar Docker, copia `.env.example` a `.env`, reemplaza las credenciales y ejecuta `docker compose up --build -d`. En producción el acceso requiere HTTPS porque la cookie de sesión usa `Secure`; configura un proxy HTTPS para acceder al contenedor. El volumen `dostov-data` conserva los datos al recrear el contenedor. No ejecutes `docker compose down -v` si quieres conservarlos.

Para respaldar, detén la aplicación y copia todo el directorio de datos o su volumen, incluidos los archivos auxiliares SQLite si existen. Para restaurar, detén la aplicación y reemplaza el contenido del volumen por el respaldo, conservando permisos para el usuario `node` (UID 1000).

## Configuración

| Variable | Predeterminado | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Puerto HTTP |
| `HOST` | `127.0.0.1` | Docker usa `0.0.0.0` |
| `DATA_DIR` | `./data` | Docker usa `/app/data` |
| `APP_USER` | sin definir | Usuario administrador |
| `APP_PASSWORD` | sin definir | Contraseña de acceso |
| `NODE_ENV` | sin definir | `production` exige credenciales |

`npm start` y `npm run dev` cargan `.env` automáticamente. Las variables del entorno tienen prioridad. Compose también utiliza `.env`. La configuración local actual utiliza el puerto 3100.

Las sesiones duran 12 horas y se guardan en memoria del servidor; reiniciarlo exige volver a entrar. La cookie es HttpOnly y SameSite=Strict, con Secure en producción. Diez intentos fallidos bloquean el acceso durante 15 minutos por dirección de conexión. Detrás de un proxy, ese límite puede ser compartido; el servidor no confía en cabeceras de IP enviadas por clientes.

## Implementación

Node.js HTTP + SQLite integrado, JavaScript y CSS nativos. Sin dependencias de ejecución, CDN, telemetría ni paso de compilación. Las fuentes incluyen sus licencias en `public/fonts`. La API valida datos y registra las fechas en UTC; la interfaz las muestra según la zona horaria del navegador.
