# Guide de déploiement ChronoConf — A à Z

## Ce qui change par rapport à la version précédente

| Aspect | Avant | Après |
|--------|-------|-------|
| Stockage données | localStorage (un seul navigateur) | Supabase (multi-appareils) |
| Authentification | Aucune | Supabase Auth (email/password) |
| Projets | Un seul | Multi-projets par organisateur |
| Intervenants | Google Sheet via Lovable | Table `speakers` dans Supabase |
| Config vérification | URL encodée + localStorage | Table `verify_config` dans Supabase |
| Dépendance Lovable | Oui (gateway + tagger) | Supprimée |
| Multi-organisateurs | Non | Oui — isolation complète par compte |

---

## Étape 1 — Prérequis

Installez si ce n'est pas déjà fait :
- **Node.js 18+** : https://nodejs.org
- **Supabase CLI** : `npm install -g supabase`
- Un compte **Supabase** : https://supabase.com (gratuit)
- Un compte **Vercel** : https://vercel.com (gratuit) — ou Netlify

---

## Étape 2 — Créer le projet Supabase

1. Allez sur https://supabase.com/dashboard
2. Cliquez **New project**
3. Choisissez un nom (ex : `chronoconf-prod`), une région proche de vos utilisateurs
4. Notez le **mot de passe de la base de données** (conservez-le)
5. Attendez ~2 minutes que le projet soit prêt

---

## Étape 3 — Exécuter la migration SQL

1. Dans votre projet Supabase → **SQL Editor** (menu gauche)
2. Cliquez **New query**
3. Copiez-collez tout le contenu de `supabase/migrations/20260001_chronoconf_schema.sql`
4. Cliquez **Run**

Vous devez voir : `Success. No rows returned`

**Vérifiez** dans **Table Editor** que ces 4 tables existent :
- `conference_data`
- `verify_config`
- `speakers`
- `speaker_edits`

---

## Étape 4 — Récupérer les clés Supabase

Dans votre projet Supabase → **Settings → API** :

| Variable | Où la trouver |
|----------|---------------|
| `VITE_SUPABASE_URL` | Project URL (ex: `https://abc123.supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `anon` `public` key |

Gardez aussi la **Service Role Key** (secret) — elle sera injectée automatiquement dans l'edge function.

---

## Étape 5 — Configurer l'authentification Supabase

1. Dans votre projet → **Authentication → Providers**
2. **Email** est activé par défaut — laissez comme ça
3. Optionnel : sous **Authentication → Email Templates**, personnalisez le mail de confirmation en français

Pour désactiver la confirmation e-mail (pratique en développement) :
- **Authentication → Settings** → désactivez **"Enable email confirmations"**

> En production, gardez la confirmation activée pour la sécurité.

---

## Étape 6 — Déployer l'edge function

Dans le terminal, à la racine du projet :

```bash
# Connectez-vous à Supabase CLI
supabase login

# Associez au projet (remplacez par votre project_id)
supabase link --project-ref VOTRE_PROJECT_ID

# Déployez la fonction
supabase functions deploy sheet-verify --no-verify-jwt
```

**Vérifiez** dans Supabase → **Edge Functions** que `sheet-verify` apparaît avec un statut vert.

> La `SUPABASE_SERVICE_ROLE_KEY` est injectée automatiquement dans l'edge function — vous n'avez rien à configurer manuellement.

---

## Étape 7 — Configurer les variables d'environnement locales

Copiez `.env.example` en `.env` :

```bash
cp .env.example .env
```

Remplissez :

```env
VITE_SUPABASE_URL=https://VOTRE_PROJECT_ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...votre_anon_key...
```

---

## Étape 8 — Tester en local

```bash
# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
```

Ouvrez http://localhost:8080

**Test de bout en bout :**
1. Créez un compte avec votre e-mail
2. Créez un projet (ex : `js-ulbo-2026`)
3. Importez quelques articles CSV
4. Ouvrez **Vérification** → onglet **Intervenants** → importez un CSV d'intervenants
5. Copiez le lien dans **Lien à partager**
6. Ouvrez ce lien dans un onglet privé → entrez un code intervenant
7. Modifiez un champ → cliquez Enregistrer
8. Retournez dans l'interface organisateur → vérifiez que la colonne "statut" passe à ✓

---

## Étape 9 — Déployer sur Vercel

### Option A — Via l'interface Vercel (recommandé)

1. Poussez votre code sur GitHub :
   ```bash
   git init
   git add .
   git commit -m "ChronoConf multi-projet Supabase"
   git remote add origin https://github.com/VOTRE_USER/chronoconf.git
   git push -u origin main
   ```

2. Sur https://vercel.com → **Add New Project** → importez le repo GitHub

3. Dans **Environment Variables**, ajoutez :
   ```
   VITE_SUPABASE_URL          = https://VOTRE_PROJECT_ID.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY = eyJ...
   ```

4. Laissez les autres paramètres par défaut → **Deploy**

### Option B — Via Vercel CLI

```bash
npm install -g vercel
vercel login
vercel --prod
# Suivez les instructions, ajoutez les env vars quand demandé
```

Le fichier `vercel.json` déjà inclus gère le routing SPA (`/verify` fonctionne directement).

---

## Étape 10 — Configurer les URLs de redirection (optionnel mais recommandé)

Si vous activez la confirmation e-mail, Supabase doit connaître votre URL de production pour les liens de confirmation :

1. Supabase → **Authentication → URL Configuration**
2. **Site URL** : `https://votre-app.vercel.app`
3. **Redirect URLs** : `https://votre-app.vercel.app/**`

---

## Format CSV des intervenants

Pour importer des intervenants dans la vérification, le CSV doit avoir ces colonnes (séparateur `,` ou `;`) :

```csv
code,nom,prenom,email,institution,titre,resume
P-001,Traoré,Issa,i.traore@univ.bf,Université de Ouagadougou,Titre de la communication,Résumé ici...
P-002,Diallo,Aminata,a.diallo@cnrst.bf,CNRST,Autre titre,...
```

- La colonne `code` est obligatoire et sert d'identifiant (ce que l'intervenant saisit sur `/verify`)
- Les autres colonnes sont optionnelles mais recommandées
- L'import est en **upsert** : si le code existe déjà, la ligne est mise à jour

---

## Multi-organisateurs — comment ça fonctionne

- Chaque organisateur crée son **compte** (email/password)
- Chaque organisateur voit **uniquement ses projets** (RLS Supabase)
- Deux organisateurs peuvent utiliser l'app **simultanément** sur des appareils différents
- Les données d'un projet sont **sauvegardées automatiquement** toutes les 30 secondes dans le cloud
- Un organisateur peut ouvrir son projet sur **plusieurs onglets** — chaque onglet auto-save indépendamment

---

## Sauvegarde automatique

Les données du projet sont sauvegardées :
- **Automatiquement** toutes les 30 secondes (si des données existent)
- **Manuellement** via le bouton **Sauvegarder** dans l'en-tête

Les données restent aussi dans `localStorage` comme cache local — si le réseau est coupé, vous pouvez continuer à travailler ; à la reconnexion, la prochaine sauvegarde synchronise.

---

## Dépannage

### "Token invalide" sur la page /verify
→ La config de vérification n'existe pas encore. Dans l'interface organisateur, ouvrez **Vérification** → onglet **Configuration** → cliquez **Sauvegarder**.

### La page /verify affiche "Lien invalide"
→ Le token dans l'URL ne correspond à aucune entrée dans `verify_config`. Régénérez le lien depuis l'interface organisateur.

### "Permission denied" lors du chargement des projets
→ La migration SQL n'a pas été exécutée, ou les politiques RLS sont absentes. Ré-exécutez `20260001_chronoconf_schema.sql`.

### L'edge function renvoie 500
→ Vérifiez dans Supabase → **Edge Functions → Logs** l'erreur précise. Assurez-vous que `SUPABASE_SERVICE_ROLE_KEY` est bien injectée (automatique sur Supabase hosted).

### Erreur "unique constraint" lors de l'import CSV
→ Normal si le code existe déjà. L'import fait un upsert — relancez, les données seront mises à jour.

---

## Sécurité — points clés

- La `VITE_SUPABASE_PUBLISHABLE_KEY` (clé `anon`) est publique — c'est normal
- La `Service Role Key` **ne doit jamais** apparaître côté client — elle est uniquement dans l'edge function (côté serveur)
- Les intervenants accèdent aux données via l'edge function qui vérifie le token — ils n'ont **jamais** accès direct à Supabase
- RLS bloque tout accès direct aux tables `speakers` et `speaker_edits` sans service_role

