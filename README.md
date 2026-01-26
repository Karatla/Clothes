# Clothes

1) Open terminal and go to project root  
cd /path/to/Clothes
2) Install dependencies (root workspace)  
npm install
3) Create env files  
cd apps/api
cp .env.example .env
cd ../web
cp .env.example .env.local
4) Build (production)  
cd ../api
npm run build
cd ../web
npm run build
5) Run API  
cd ../api
npm run start:prod/node dist/src/main.js
6) Run Web  
cd ../web
npm run start

## Startup Checks

### Web (Next.js)
From repo root:
- `cd apps/web`
- `npm run dev`
npm run start(for product)

Open http://localhost:3000 — you should see the default Next.js page.

### API (NestJS)
From repo root:
- `cd apps/api`
- `npm run start:dev`
npm run start:prod(for product)

Default endpoint: http://localhost:3000/
If you change the port later, update this section.

### Node Version
Use Node 20.11.1 for best compatibility:
- `nvm use`
