# Nebula TCG

Boutique e-commerce TCG (Pokemon + One Piece) en Next.js avec Stripe et MongoDB.

## Demarrage

```bash
npm install
npm run dev
```

Ouvre http://localhost:3000

## Variables d'environnement

Copie `.env.example` en `.env.local` puis renseigne:

- `MONGODB_URI`
- `MONGODB_DB` (optionnel, defaut: `nebula_tcg`)
- `STRIPE_SECRET_KEY`
- `ADMIN_TOKEN`
- `NEXT_PUBLIC_SITE_URL` (optionnel en dev)

## Admin / Seed

- Page login: `/admin/login`
- Dashboard: `/admin` (CRUD produits, upload image, seed)
