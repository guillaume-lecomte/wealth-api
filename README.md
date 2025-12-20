# Wealth Tracker API

Ce projet est un prototype de service backend permettant de suivre le patrimoine financier d’un utilisateur à partir d’évènements financiers hétérogènes (banques, crypto, assurance, etc.).  
L’objectif est de tester la logique de traitement, de normalisation et de réconciliation d’évènements potentiellement incomplets, contradictoires, en retard ou dupliqués.

---

## Architecture technique

### Vue d’ensemble

- **Framework backend** : NestJS (TypeScript)  
- **Base de données** : MongoDB (driver natif)  
- **Validation** : `class-validator` / `class-transformer`  
- **Configuration** : variables d’environnement (`.env`)

### Découpage

- `src/main.ts`  
  Bootstrap NestJS, configuration CORS, activation de la validation globale des DTO.

- `src/app.module.ts`  
  Module racine, charge la configuration et le module métier `WealthModule`.

- `src/common/mongo.provider.ts`  
  Provider encapsulant la connexion MongoDB, exposant un `Db` injecté dans les services, avec gestion du cycle de vie (init/close).

- `src/wealth/`  
  - `wealth.module.ts` : module métier (controller + service).  
  - `wealth.controller.ts` : routes HTTP (`/api/...`).  
  - `wealth.service.ts` : logique de normalisation, idempotence, réconciliation et agrégation.  
  - `enums/` : enums métiers (`Provider`, `TransactionType`, `EventStatus`, `EventOrigin`).  
  - `dto/` :
    - DTO d’entrée (webhooks) : `BankEventDto`, `CryptoEventDto`, `InsuranceEventDto`.  
    - Modèle interne : `NormalizedEvent`.  
    - DTO de sortie : `GlobalBalanceDto`, `AccountBalanceDto`, `TimelineEventDto`.

### Modèle de données

La collection principale est `normalized_events`, qui stocke :

- tous les évènements normalisés (banque, crypto, assurance),  
- les évènements d’ajustement internes générés en cas de contradiction.

Champs principaux d’un `NormalizedEvent` :

- `userId` : identifiant utilisateur  
- `provider` : `bank | crypto | insurance`  
- `providerId` : identifiant du provider (ex. `BNP`, `Coinbase`, `AXA`)  
- `transactionId` : identifiant métier du provider, stable dans le temps  
- `timestamp` : date effective de l’opération (peut être antérieure à `createdAt`)  
- `transactionType` : `credit`, `debit`, `deposit`, `withdrawal`, `premium`  
- `amount` : montant signé (positif : entrée, négatif : sortie)  
- `currency` : devise (par défaut `EUR`)  
- `accountId` : identifiant de compte externe (IBAN, wallet, n° de police)  
- `description` : description métier  
- `rawData` : payload d’origine (évènement brut)  
- `createdAt` : instant d’ingestion par le backend  
- `status` : `pending`, `settled`, `rejected` (le prototype utilise surtout `settled`)  
- `origin` : `external` (évènement reçu) ou `adjustment` (correction interne)  
- `groupKey` : clé de regroupement logique (`provider:providerId:accountId:currency`)

### Idempotence & réconciliation

- **Idempotence**  
  Un évènement est identifié par `(userId, provider, transactionId)`.  
  - Si un évènement identique est reçu plusieurs fois (même montant, même type), il est ignoré comme doublon.  

- **Contradictions**  
  Si un nouvel évènement arrive avec la même clé mais un contenu différent (montant ou type modifié), le service crée un **évènement d’ajustement** (`origin = adjustment`) qui compense la différence, au lieu de modifier l’ancien document.  
  Cela permet de conserver un audit trail complet des corrections.  

- **Évènements en retard**  
  Le champ `timestamp` porte la date métier de l’opération, ce champ est utilisé pour la timeline et les agrégations, ce qui permet d’intégrer des opérations reçues tardivement dans la bonne position temporelle.

---

## Installation & démarrage

### Prérequis

- Node.js (>= 18)  
- MongoDB en local ou accessible via URL  
- npm ou yarn  

### Installation

`git clone git@github.com:guillaume-lecomte/wealth-api.git`
`cd wealth-api`

`npm install`

ou
`yarn install`

Créer un fichier `.env` à la racine en copiant le contenu du .env.example

### Base de données
`docker-compose up -d`

### Lancement en développement

`npm run start:dev`

ou
`yarn start:dev`

L’API sera accessible sur `http://localhost:3000`.

---

## API – Webhooks d’ingestion

### 1. Banque – `POST /api/webhooks/bank`

**Body JSON :**

{
  "userId": "user-001",
  "bankId": "BNP",
  "txnId": "TXN-123",
  "date": "2025-01-01T10:15:00Z",
  "type": "credit",
  "amount": 1500.5,
  "currency": "EUR",
  "account": "FR761234567890",
  "description": "Salaire janvier"
}


**Exemple curl :**

curl -X POST http://localhost:3000/api/webhooks/bank
-H "Content-Type: application/json"
-d '{
  "userId": "user-001",
  "bankId": "BNP",
  "txnId": "TXN-123",
  "date": "2025-01-01T10:15:00Z",
  "type": "credit",
  "amount": 1500.5,
  "currency": "EUR",
  "account": "FR761234567890",
  "description": "Salaire janvier"
}'

---

### 2. Crypto – `POST /api/webhooks/crypto`

**Body JSON :**

{
  "userId": "user-001",
  "platform": "Coinbase",
  "id": "ORDER-789",
  "time": 1735900000000,
  "type": "deposit",
  "asset": "BTC",
  "amount": 0.01,
  "fiatValue": 400,
  "currency": "EUR",
  "walletId": "wallet-abc"
}

**Exemple curl :**

curl -X POST http://localhost:3000/api/webhooks/crypto
-H "Content-Type: application/json"
-d '{
  "userId": "user-001",
  "platform": "Coinbase",
  "id": "ORDER-789",
  "time": 1735900000000,
  "type": "deposit",
  "asset": "BTC",
  "amount": 0.01,
  "fiatValue": 400,
  "currency": "EUR",
  "walletId": "wallet-abc"
}'

---

### 3. Assurance – `POST /api/webhooks/insurance`

**Body JSON :**

{
  "userId": "user-001",
  "insurer": "AXA",
  "transactionId": "AXA-456",
  "timestamp": 1735905000000,
  "movementType": "premium",
  "amount": 100,
  "currency": "EUR",
  "policyNumber": "POLICY-001"
}

**Exemple curl :**

curl -X POST http://localhost:3000/api/webhooks/insurance
-H "Content-Type: application/json"
-d '{
  "userId": "user-001",
  "insurer": "AXA",
  "transactionId": "AXA-456",
  "timestamp": 1735905000000,
  "movementType": "premium",
  "amount": 100,
  "currency": "EUR",
  "policyNumber": "POLICY-001"
}'

---

### Réponses typiques

- **Évènement nouveau :**

{
  "status": "success",
  "message": "Event processed",
  "transactionId": "BNP-TXN-123"
}

- **Évènement strictement dupliqué :**

{
  "status": "duplicate",
  "message": "Event already processed with same effect",
  "transactionId": "BNP-TXN-123"
}

- **Évènement contradictoire corrigé par ajustement :**

{
  "status": "adjusted",
  "message": "Contradictory event reconciled via adjustment",
  "transactionId": "BNP-TXN-123"
}

---

## API – Lecture du patrimoine

### 1. Solde global – `GET /api/wealth/balance`

**Query params :**

- `userId` (optionnel, défaut `user-001`)

**Exemple curl :**

curl "http://localhost:3000/api/wealth/balance?userId=user-001"

**Exemple de réponse :**

{
  "totalBalanceEUR": 1800.5,
  "accountCount": 3,
  "totalTransactions": 10,
  "accounts": [
      {
        "accountId": "FR761234567890",
        "provider": "bank",
        "providerId": "BNP",
        "balance": 1500.5,
        "currency": "EUR",
        "transactionCount": 5
      },
      {
        "accountId": "wallet-abc",
        "provider": "crypto",
        "providerId": "Coinbase",
        "balance": 400,
        "currency": "EUR",
        "transactionCount": 3
      }
  ]
}

---

### 2. Détail par compte – `GET /api/wealth/accounts`

**Exemple curl :**

curl "http://localhost:3000/api/wealth/accounts?userId=user-001"

**Réponse :**  
Liste d’objets `AccountBalanceDto`, même format que le tableau `accounts` du solde global.

---

### 3. Timeline consolidée – `GET /api/wealth/timeline`

**Query params :**

- `userId` (optionnel, défaut `user-001`)  
- `limit` (optionnel, défaut `100`)

**Exemple curl :**

curl "http://localhost:3000/api/wealth/timeline?userId=user-001&limit=50"

**Exemple de réponse :**

[
  {
    "transactionId": "BNP-TXN-123",
    "timestamp": "2025-01-01T10:15:00.000Z",
    "provider": "bank",
    "providerId": "BNP",
    "accountId": "FR761234567890",
    "transactionType": "credit",
    "amount": 1500.5,
    "currency": "EUR",
    "description": "Salaire janvier"
  },
  {
    "transactionId": "Coinbase-ORDER-789",
    "timestamp": "2025-01-03T12:00:00.000Z",
    "provider": "crypto",
    "providerId": "Coinbase",
    "accountId": "wallet-abc",
    "transactionType": "deposit",
    "amount": 400,
    "currency": "EUR",
    "description": "deposit - 0.01 BTC"
  }
]

---

## Collection Postman

Pour tester rapidement :

1. Créer une collection `Wealth Tracker API`.  
2. Ajouter les requêtes :
   - `POST {{baseUrl}}/api/webhooks/bank`
   - `POST {{baseUrl}}/api/webhooks/crypto`
   - `POST {{baseUrl}}/api/webhooks/insurance`
   - `GET {{baseUrl}}/api/wealth/balance`
   - `GET {{baseUrl}}/api/wealth/accounts`
   - `GET {{baseUrl}}/api/wealth/timeline`  
3. Définir une variable d’environnement `baseUrl = http://localhost:3000`.  
4. Utiliser `{{baseUrl}}` dans les URLs pour faciliter le changement d’environnement.

---

## Compromis et pistes d’évolution

- Pas de vrai event store séparé : les évènements et les ajustements sont tous stockés dans la même collection `normalized_events`.  
- Pas de gestion de concurrence optimiste/pessimiste fine au niveau compte, le modèle add-only + ajustements est suffisant pour un prototype.  
- Pas de frontend sur ce repo développé
- Évolutions possibles :
  - ajouter une collection de projections `accounts_snapshot` recalculée en tâche de fond,  
  - introduire un use case `pending/settled` plus proche des paiements cartes (autorisation vs capture),  
  - brancher un bus d’évènements (Kafka, RabbitMQ, etc.) pour des besoins de scalabilité et de découplage.
