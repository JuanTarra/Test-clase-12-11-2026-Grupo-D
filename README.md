# Tablero de tareas CRUDL

Aplicación de ejemplo para probar despliegues independientes de un frontend estático, una API y una base de datos PostgreSQL.

## Componentes

- `frontend/`: interfaz HTML, CSS y JavaScript con Vite.
- `backend/`: API REST con Node.js, Express y PostgreSQL.
- `docker-compose.yml`: base de datos y API para desarrollo local.

La API implementa crear, listar, consultar, actualizar y eliminar tareas. Crea la tabla automáticamente al iniciar.

## Ejecutar localmente

Requisitos: Node.js 20+ y Docker con Docker Compose.

1. Inicia la base de datos y la API desde la raíz:

   ```sh
   docker compose up --build
   ```

2. En otra terminal, inicia el frontend:

   ```sh
   cd frontend
   npm install
   npm run dev
   ```

3. Abre la dirección que muestra Vite (por defecto `http://localhost:5173`). La API queda disponible en `http://localhost:3000`.

Para detener los contenedores, usa `docker compose down`. Los datos sobreviven a ese comando en el volumen de Docker; para borrarlos, ejecuta `docker compose down -v`.

## Probar la API

```sh
curl.exe http://localhost:3000/health
curl.exe http://localhost:3000/api/tasks
curl.exe -X POST http://localhost:3000/api/tasks -H "Content-Type: application/json" -d '{"title":"Primera tarea","description":"Prueba de extremo a extremo"}'
```

Rutas disponibles:

| Método | Ruta | Acción |
| --- | --- | --- |
| `GET` | `/health` | Comprueba API y conexión a la base de datos |
| `GET` | `/api/tasks` | Lista tareas |
| `GET` | `/api/tasks/:id` | Consulta una tarea |
| `POST` | `/api/tasks` | Crea una tarea |
| `PATCH` | `/api/tasks/:id` | Actualiza título y/o descripción |
| `DELETE` | `/api/tasks/:id` | Elimina una tarea |

## Desplegar cada parte por separado

### Base de datos

1. Crea una instancia PostgreSQL en el proveedor elegido (por ejemplo, Neon, Supabase o Railway).
2. Copia la cadena de conexión interna/privada del proveedor para usarla como `DATABASE_URL` en el servicio de API.
3. Si el proveedor requiere TLS, configura `DATABASE_SSL=true`. No incluyas credenciales en el repositorio.
4. La API crea la tabla `tasks` al arrancar.

### Backend

1. Despliega la carpeta `backend/` como servicio Node o contenedor Docker.
2. Configura `DATABASE_URL` y, si aplica, `DATABASE_SSL=true`.
3. Configura `CORS_ORIGIN` con la URL pública exacta del frontend. Admite varios orígenes separados por comas.
4. El proveedor debe asignar `PORT`, o se usará `3000`. Usa `/health` como health check.
5. La URL pública del servicio tendrá rutas como `/health` y `/api/tasks`.

### Frontend

1. Despliega `frontend/` como sitio estático con comando de build `npm run build` y directorio de salida `dist`.
2. Configura `VITE_API_URL` como la URL pública de la API seguida de `/api` (por ejemplo, `https://mi-api.example.com/api`).
3. Agrega la URL pública del frontend a `CORS_ORIGIN` en el backend.

Vite incorpora `VITE_API_URL` durante el build: vuelve a construir el frontend si cambia la URL de API. Para desarrollo local puedes omitirla; el frontend usa `http://localhost:3000/api`.

## Tests

```sh
cd backend
npm install
npm test
```
