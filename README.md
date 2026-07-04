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
- `ENABLE_ADMIN_MAINTENANCE_ROUTES=false` en production sauf intervention ponctuelle
- `ENABLE_ADMIN_DEBUG_ROUTES=false` en production sauf diagnostic ponctuel
- `NEXT_PUBLIC_SITE_URL` (optionnel en dev, obligatoire en production: URL publique `https://...`, pas localhost)
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
- `BOXTAL_CONTENT_CATEGORY_CODE`, `BOXTAL_CONTENT_DESCRIPTION` (optionnels, contenu colis)
- Expediteur Boxtal: `BOXTAL_SHIPPER_NAME`, `BOXTAL_SHIPPER_EMAIL`, `BOXTAL_SHIPPER_PHONE`, `BOXTAL_SHIPPER_STREET1`, `BOXTAL_SHIPPER_STREET2` (optionnel), `BOXTAL_SHIPPER_ZIP_CODE`, `BOXTAL_SHIPPER_CITY`, `BOXTAL_SHIPPER_COUNTRY`

Important Boxtal:
- Utiliser une app `Composant carte` pour `BOXTAL_MAP_*` (checkout point relais)
- Utiliser une app `API v3` pour `BOXTAL_API_*` (admin expedition / offres transport)

## Admin / Orders

- Page login: `/admin/login`
- Produits: `/admin` (CRUD produits, upload image, test email, retry emails en echec)
- Commandes: `/admin/orders`
- Detail commande: creation expedition Boxtal depuis `/admin/orders/:id`
- Healthcheck prod: `/api/admin/health` (session admin requise, ne renvoie pas les secrets)
- Routes internes `POST /api/seed`, `POST /api/admin/migrate-franchise` et `GET /api/admin/boxtal/debug-auth`: actives en dev, bloquees en production sauf flags explicites.

## Vercel Blob

Les uploads admin utilisent Vercel Blob en production.

1. Dans Vercel, aller dans `Storage`, creer ou connecter un Blob Store au projet.
2. Verifier que `BLOB_READ_WRITE_TOKEN` existe dans les variables d'environnement du projet pour `Production` (et `Preview` si besoin).
3. Relancer un deploiement apres l'ajout de la variable: un deploiement deja en ligne ne recupere pas automatiquement les nouvelles variables.
4. Pour le dev local, lier le dossier puis pull les variables:

```bash
vercel link
vercel env pull .env.local --yes
```

Attention: `vercel env pull` remplace `.env.local`. Sauvegarder les valeurs locales non presentes dans Vercel avant de lancer la commande.

## Compte client

- Login: `/account/login`
- Register: `/account/register`
- Espace client: `/account`
- Mot de passe oublie: `/account/forgot-password`

## Webhooks Stripe

- Endpoint: `/api/stripe/webhook`
- Ajoute `STRIPE_WEBHOOK_SECRET` dans `.env.local`
- Events requis:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.expired` (libere les reservations de stock des paniers abandonnes)
- Les sessions Checkout expirent apres environ 31 minutes pour eviter de bloquer le stock trop longtemps.
- Test local (Stripe CLI):

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Validation avant lancement

Commandes locales:

```bash
npm test
npm run lint
npm run build
npm audit --omit=dev
```

Smoke test Vercel Preview ou production test:

1. Verifier `/api/admin/health` connecte en admin: tous les checks doivent etre `ok`.
2. Envoyer un email test depuis l'admin et verifier la reception Resend.
3. Creer ou verifier un produit avec stock positif et image uploadee via Blob.
4. Passer une commande Stripe en mode test avec une adresse email client reelle.
5. Verifier dans Stripe que `checkout.session.completed` a appele `/api/stripe/webhook`.
6. Verifier dans Mongo/admin que la commande existe, que le stock a ete reserve puis rattache a la commande, et que `email_events` contient `order_confirmation`.
7. Verifier que l'email Resend est recu par le client, ou que l'erreur email est visible dans l'admin via `email_events` et `order.emailStatus.orderConfirmation`. Le bouton admin "Relancer echecs" retente les confirmations/suivis en `failed` ou `pending` depuis plus de 5 minutes.
8. Lancer puis abandonner un checkout test depuis Stripe: le retour panier doit appeler `/api/checkout/cancel` et liberer le stock reserve. Verifier aussi que `checkout.session.expired` libere le stock si le client ferme l'onglet.
9. Depuis la fiche commande, creer l'expedition Boxtal une seule fois, synchroniser, puis renvoyer l'email de suivi.

## Boxtal (API v3)

- Listing offres transport admin: `GET /api/admin/boxtal/shipping-offers`
- Creation expedition: `POST /api/admin/orders/:id/boxtal`
- Synchronisation manuelle: `PATCH /api/admin/orders/:id/boxtal`
- Webhook Boxtal: `POST /api/boxtal/webhook`
- Evenements Boxtal a activer (si abonnement webhook cote Boxtal):
  - `DOCUMENT_CREATED`
  - `TRACKING_CHANGED`
- Le `BOXTAL_WEBHOOK_SECRET` correspond a la cle de validation de la souscription webhook
