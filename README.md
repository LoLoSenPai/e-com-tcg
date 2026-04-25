# Returners

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
- `STRIPE_WEBHOOK_SECRET`
- `ADMIN_TOKEN`
- `CUSTOMER_SESSION_SECRET` (session compte client)
- `NEXT_PUBLIC_SITE_URL` (optionnel en dev)
- `RESEND_API_KEY` (email)
- `EMAIL_FROM` (email)
- `BLOB_READ_WRITE_TOKEN` (upload images en production Vercel Blob)
- `BOXTAL_ACCESS_KEY`, `BOXTAL_SECRET_KEY`, `BOXTAL_TOKEN_URL`
- `BOXTAL_API_ACCESS_KEY`, `BOXTAL_API_SECRET_KEY`, `BOXTAL_API_TOKEN_URL`
- `BOXTAL_MAP_ACCESS_KEY`, `BOXTAL_MAP_SECRET_KEY`, `BOXTAL_MAP_TOKEN_URL`
- `BOXTAL_WEBHOOK_SECRET` (cle de validation de la souscription webhook Boxtal)
- `NEXT_PUBLIC_BOXTAL_MAP_NETWORKS` (optionnel, CSV ex: `MONR_NETWORK,CHRP_NETWORK`)
- `NEXT_PUBLIC_BOXTAL_MAP_DEBUG=1` (optionnel, debug console map)
- `BOXTAL_API_BASE_URL` (defaut: `https://api.boxtal.build/shipping`)
- `BOXTAL_SHIPPING_OFFER_CODE_HOME`, `BOXTAL_SHIPPING_OFFER_CODE_RELAY`
- `BOXTAL_SHIPPER_*` (expediteur pour creation d'expedition)

Important Boxtal:
- Utiliser une app `Composant carte` pour `BOXTAL_MAP_*` (checkout point relais)
- Utiliser une app `API v3` pour `BOXTAL_API_*` (admin expedition / offres transport)

## Admin / Orders

- Page login: `/admin/login`
- Produits: `/admin` (CRUD produits, upload image, seed, migration)
- Commandes: `/admin/orders`
- Detail commande: creation expedition Boxtal depuis `/admin/orders/:id`
- Healthcheck prod: `/api/admin/health` (session admin requise, ne renvoie pas les secrets)

## Compte client

- Login: `/account/login`
- Register: `/account/register`
- Espace client: `/account`
- Mot de passe oublie: `/account/forgot-password`

## Webhooks Stripe

- Endpoint: `/api/stripe/webhook`
- Ajoute `STRIPE_WEBHOOK_SECRET` dans `.env.local`
- Event requis: `checkout.session.completed`
- Test local (Stripe CLI):

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Boxtal (API v3)

- Listing offres transport admin: `GET /api/admin/boxtal/shipping-offers`
- Creation expedition: `POST /api/admin/orders/:id/boxtal`
- Synchronisation manuelle: `PATCH /api/admin/orders/:id/boxtal`
- Webhook Boxtal: `POST /api/boxtal/webhook`
- Evenements Boxtal a activer (si abonnement webhook cote Boxtal):
  - `DOCUMENT_CREATED`
  - `TRACKING_CHANGED`
- Le `BOXTAL_WEBHOOK_SECRET` correspond a la cle de validation de la souscription webhook
