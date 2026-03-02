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

## Admin / Orders

- Page login: `/admin/login`
- Produits: `/admin` (CRUD produits, upload image, seed, migration)
- Commandes: `/admin/orders`

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
