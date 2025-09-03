# Propel – Backend (Tech Test)

API de encuestas comunitarias (mini–surveys) para la prueba técnica de Propel.  
Stack: **Node 20 + TypeScript (ESM/NodeNext) + Express + Drizzle ORM + PostgreSQL + Docker**.

---

## ⚙️ Tecnologías y decisiones

- **Node 20 + TS (ESM/NodeNext)**: imports con extensión `.js` en rutas **relativas** (p. ej. `./db/client.js`).
- **Express**: API REST sencilla.
- **Drizzle ORM**: modelo tipado, migraciones y SQL claros.
- **PostgreSQL**: persistencia.
- **tsx**: *runner* para desarrollo (`npm run dev`) sin configurar loaders.
- **Docker**: imagen única (single-stage) + `docker-compose` para levantar **DB + API** en un comando.
- **CORS**: permitido por defecto para `http://localhost:5173` (Vite front).

---

## 🗂️ Estructura del repo

```
propel-back/
├─ src/
│  ├─ db/
│  │  ├─ client.ts        # Pool PG + drizzle()
│  │  ├─ schema.ts        # Tablas (participants, categories, questions, needs)
│  │  └─ seed.ts          # Seed de categorías + preguntas
│  └─ index.ts            # Servidor Express + endpoints
├─ drizzle/                # Migraciones SQL generadas por Drizzle (versionadas)
├─ docker-compose.yml      # Orquesta DB + API
├─ Dockerfile              # Imagen de la API (build TS + migrate + start)
├─ drizzle.config.ts
├─ tsconfig.json
└─ package.json
```

---

## 🚀 Arranque rápido (con Docker Compose)

> Requisitos: **Docker** y **docker compose**.

```bash
# 1) Desde la raíz del repo (propel-back/)
docker compose up --build

# 2) Probar health:
curl http://localhost:4000/health
```

- La BD expone `localhost:5433` → contenedor `db:5432`.
- La API expone `localhost:4000` y **aplica migraciones automáticamente** al iniciar (`npx drizzle-kit migrate` en `CMD` del Dockerfile).
- (Opcional) Cargar datos base (categorías + preguntas) **dentro del contenedor de la API**:
  ```bash
  docker compose exec api node dist/db/seed.js
  ```

### Detener y borrar contenedores (la data en pg_data PERSISTE)
docker compose down

### Detener, borrar contenedores y BORRAR volúmenes (DB limpia)
docker compose down -v


---

## 🧑‍💻 Desarrollo local (sin Docker)

> Requisitos: **Node 20** y una base Postgres. Puedes reutilizar la BD del compose o lanzar una con `docker run`.

### 1) Instalar dependencias
```bash
npm i
```

### 2) Base de datos (dos opciones)

**A. Usar la BD del compose:**
```bash
docker compose up -d db
```
- URL local: `postgres://postgres:postgres@localhost:5433/propel`

**B. Lanzar Postgres “rápido” con docker run:**
```bash
docker run --name propel-postgres \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=propel \
  -p 5433:5432 -d postgres:16
```

### 3) Variables de entorno (local)
Crea un archivo `.env` (o exporta la variable) **solo si vas a ejecutar la API en tu host**:
```
PORT=4000
DATABASE_URL=postgres://postgres:postgres@localhost:5433/propel
```

> En **compose**, la API ya recibe `DATABASE_URL` vía `docker-compose.yml`. Por eso `.env` es **opcional**.

### 4) Migraciones y seed (local)
```bash
npm run db:gen      # genera migraciones desde schema.ts (solo si cambiaste el esquema)
npm run db:migrate  # aplica migraciones
npm run db:seed     # carga categorías + preguntas (seed)
```

### 5) Levantar la API (dev)
```bash
npm run dev  # usa tsx watch
```

Health:
```bash
curl http://localhost:4000/health
```

---

## 🧱 Modelo de datos

- `participants` (email único): { name, email, age?, country?, city?, neighborhood?, phone?, created_at }
- `categories`: catálogo (ej. salud, educación, empleo, …)
- `questions`: catálogo de preguntas (2 por defecto)
- `needs`: **respuestas** por participante y pregunta, con **texto** y categoría **opcional**  
  - Regla de negocio: para **Pregunta 1** la categoría es **obligatoria**; en otras preguntas, opcional.

---

## 🔌 Endpoints

Base URL: `http://localhost:4000`

### Health
```
GET /health
```

### Catálogos
```
GET /categories
GET /questions
```

### Registro/actualización de participante (upsert por email)
```
POST /participants/register
Content-Type: application/json

{
  "name": "Diego",
  "email": "diego@test.com",
  "age": 31,
  "country": "Colombia",
  "city": "Bogotá",
  "neighborhood": "Cedritos",
  "phone": "3001234567"
}
```

### Crear respuesta / necesidad
Regla: si `questionId === 1` → `categorySlug` **obligatorio**.  
En otras preguntas `categorySlug` es opcional.

```
POST /needs
Content-Type: application/json

# Pregunta 1 (categoría + texto)
{
  "email": "diego@test.com",
  "questionId": 1,
  "categorySlug": "salud",
  "description": "No hay hospital en el barrio"
}

# Pregunta 2 (solo texto)
{
  "email": "diego@test.com",
  "questionId": 2,
  "description": "Organizar brigadas médicas mensuales"
}
```

### Listar necesidades (simples)
```
GET /needs?limit=50
```

### Respuestas enriquecidas (para UI)
Incluye participante, pregunta y categoría (si existe).
```
GET /responses
GET /responses?questionId=1
```

### Estadísticas por categoría
```
GET /stats/categories
```

---

## 🧪 Ejemplos con `curl`

```bash
# Health
curl http://localhost:4000/health

# Catálogos
curl http://localhost:4000/categories
curl http://localhost:4000/questions

# Registrar participante (upsert)
curl -X POST http://localhost:4000/participants/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Diego\",\"email\":\"diego@test.com\",\"age\":31,\"country\":\"Colombia\",\"city\":\"Bogotá\"}"

# Necesidad P1 (requiere categoría)
curl -X POST http://localhost:4000/needs \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"diego@test.com\",\"questionId\":1,\"categorySlug\":\"salud\",\"description\":\"No hay hospital en el barrio\"}"

# Necesidad P2 (solo texto)
curl -X POST http://localhost:4000/needs \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"diego@test.com\",\"questionId\":2,\"description\":\"Organizar brigadas médicas mensuales\"}"

# Respuestas enriquecidas
curl "http://localhost:4000/responses?questionId=1"
curl "http://localhost:4000/responses?questionId=2"

# Stats
curl http://localhost:4000/stats/categories
```

---

## 🐳 Docker

### Build + run (API sola, apuntando a una BD local en 5433)
```bash
docker build -t propel-api .
docker run --rm -p 4000:4000 \
  -e PORT=4000 \
  -e DATABASE_URL=postgres://postgres:postgres@host.docker.internal:5433/propel \
  propel-api
```

### Orquestado (DB + API)
```bash
docker compose up --build
```

---

## 🔧 Migraciones (Drizzle)

- Generar desde el esquema:
  ```bash
  npm run db:gen
  ```
- Aplicar a la BD conectada:
  ```bash
  npm run db:migrate
  ```
- Las migraciones viven en `./drizzle/` (versionadas).

---

## 🛡️ CORS

Por defecto habilitado para `http://localhost:5173` (Vite).  
Si desplegas el front en otra URL/puerto, ajusta en `src/index.ts`:

```ts
app.use(cors({ origin: ['http://localhost:5173'], credentials: false }));
```

---

## ✅ Notas y buenas prácticas

- **Imports ESM + NodeNext**: usa extensión `.js` en imports **relativos** (`./schema.js`). Paquetes (p. ej. `"express"`, `"pg"`) no llevan extensión.
- **Variables de entorno**:
  - Local (host): `.env` con `DATABASE_URL=postgres://postgres:postgres@localhost:5433/propel`
  - Compose: se define en `docker-compose.yml` (no necesitas `.env`).
- **Type-check** en desarrollo:
  ```bash
  npm run typecheck
  ```

---

## 📜 Licencia

Propósito de prueba técnica.
