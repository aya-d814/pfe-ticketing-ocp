# Guide d'exécution — Livrables PFE Tickets OCP
## Ce que tu vas intégrer et comment le faire étape par étape

---

## 1. Vue d'ensemble des fichiers à créer / modifier

| Fichier | Action | Raison |
|---|---|---|
| `tickets/priorite.py` | **CRÉER** (nouveau) | Logique métier du calcul de priorité |
| `tickets/serializers.py` | **REMPLACER** le contenu | Ajout `priorite` read-only + `UserRegisterSerializer` |
| `tickets/views.py` | **REMPLACER** le contenu | Priorité auto à la création, validation des transitions |
| `tickets/urls.py` | **REMPLACER** le contenu | Ajout de la route `/api/auth/register/` |

---

## 2. Intégration fichier par fichier

### 2.1 Créer `tickets/priorite.py`

C'est un **nouveau fichier**. Place-le à côté de `models.py` :

```
ticketing_project/
└── tickets/
    ├── models.py
    ├── priorite.py   ← NOUVEAU
    ├── serializers.py
    ├── views.py
    └── urls.py
```

Copie-colle le contenu du fichier `priorite.py` livré.  
**Aucune migration** n'est nécessaire : ce fichier ne touche pas la base de données.

---

### 2.2 Remplacer `tickets/serializers.py`

Remplace intégralement le contenu du fichier existant par le fichier `serializers.py` livré.

**Ce qui change par rapport à l'original :**
- `TicketSerializer` : `priorite` est désormais dans `read_only_fields` → l'utilisateur ne peut pas la forcer via l'API.
- Ajout de `UserRegisterSerializer` pour l'inscription.

---

### 2.3 Remplacer `tickets/views.py`

Remplace intégralement le contenu du fichier existant par le fichier `views.py` livré.

**Ce qui change par rapport à l'original :**
- `perform_create` appelle `calculer_priorite()` avant de sauvegarder.
- `changer_statut` valide maintenant les transitions via `TRANSITIONS_STATUT`.
- Ajout de `UserRegisterView` (vue publique, sans authentification).
- `_calculer_mttr()` extraite en fonction privée (Clean Code).

---

### 2.4 Remplacer `tickets/urls.py`

Remplace le contenu du fichier `tickets/urls.py` par le fichier livré.

**Ce qui change :**  
Ajout d'une route :
```python
path('api/auth/register/', views.UserRegisterView.as_view(), name='register'),
```

---

## 3. Vérification des imports

Dans `tickets/views.py`, la ligne suivante doit être présente :
```python
from .priorite import calculer_priorite
```

Dans `tickets/serializers.py` :
```python
from django.contrib.auth.password_validation import validate_password
```

Ce module fait partie de Django standard, aucune installation pip n'est nécessaire.

---

## 4. Aucune migration requise

Les modifications ne touchent aucun modèle. Tu n'as **pas besoin** de lancer :
```bash
python manage.py makemigrations
python manage.py migrate
```

---

## 5. Redémarrer le serveur

Après avoir copié les fichiers :
```bash
python manage.py runserver
```

Si tu utilises `gunicorn` :
```bash
gunicorn ticketing_project.wsgi:application --reload
```

---

## 6. Tester les nouveaux comportements

### Test 1 — Priorité calculée automatiquement

**Crée un ticket sur un équipement de criticité `haute`** :

```http
POST /api/tickets/
Authorization: Bearer <token_operateur>
Content-Type: application/json

{
  "titre": "Arrêt pompe principale",
  "description": "La pompe est hors service.",
  "equipement_id": 1
}
```

**Résultat attendu** :  
La réponse contiendra `"priorite": "urgente"` (criticité `haute` + mot-clé "arrêt").

---

### Test 2 — Priorité non modifiable manuellement

```http
POST /api/tickets/
Authorization: Bearer <token_operateur>

{
  "titre": "Test priorité",
  "description": "Demande normale.",
  "equipement_id": 1,
  "priorite": "urgente"   ← champ ignoré
}
```

**Résultat attendu** :  
Le champ `priorite` dans la réponse sera calculé automatiquement, pas `urgente`.

---

### Test 3 — Transition de statut valide

```http
PATCH /api/tickets/1/changer_statut/
Authorization: Bearer <token_technicien>

{
  "statut": "en_cours"
}
```

**Résultat attendu** : succès si le ticket est actuellement `ouvert`.

---

### Test 4 — Transition de statut invalide

```http
PATCH /api/tickets/1/changer_statut/
Authorization: Bearer <token_technicien>

{
  "statut": "attente_pieces"
}
```

**Résultat attendu** si le ticket est `ouvert` :
```json
{
  "detail": "Transition 'ouvert' → 'attente_pieces' non autorisée.",
  "transitions_possibles": ["en_cours"]
}
```

---

### Test 5 — Inscription

```http
POST /api/auth/register/
Content-Type: application/json

{
  "username": "jean.dupont",
  "email": "jean@ocp.ma",
  "password": "MotDePasse123!",
  "password_confirm": "MotDePasse123!",
  "role": "operateur"
}
```

**Résultat attendu** : `HTTP 201` avec les données de l'utilisateur créé.

---

## 7. Routes API complètes

| Méthode | URL | Rôle requis | Description |
|---|---|---|---|
| POST | `/api/auth/register/` | public | Inscription |
| POST | `/api/auth/login/` | public | Obtenir tokens JWT |
| POST | `/api/auth/refresh/` | public | Rafraîchir le token |
| POST | `/api/auth/logout/` | authentifié | Révoquer le token |
| GET | `/api/tickets/` | tous | Liste des tickets (filtrée par rôle) |
| POST | `/api/tickets/` | opérateur | Créer un ticket |
| GET | `/api/tickets/{id}/` | tous | Détail d'un ticket |
| PATCH | `/api/tickets/{id}/assigner/` | technicien | S'assigner un ticket |
| PATCH | `/api/tickets/{id}/changer_statut/` | technicien / responsable | Changer le statut |
| GET | `/api/dashboard/stats/` | responsable | KPI globaux |
| GET | `/api/dashboard/tickets_par_statut/` | responsable | Répartition par statut |
| GET | `/api/equipements/` | tous | Liste des équipements |
| POST | `/api/equipements/` | responsable | Créer un équipement |
| GET | `/api/utilisateurs/` | responsable | Liste des utilisateurs |

---

## 8. Règles métier — Référence rapide

### Calcul de la priorité

| Criticité équipement | Priorité de base | Si mot-clé urgence détecté |
|---|---|---|
| basse | basse | moyenne |
| moyenne | moyenne | haute |
| haute | haute | urgente |
| critique | urgente | urgente (déjà au max) |

**Mots-clés déclencheurs** (dans le titre ou la description) :  
`urgence`, `urgent`, `critique`, `sécurité`, `arrêt`, `fuite`, `incendie`, `explosion`, `danger`, `panne totale`, `hors service`

---

### Cycle de vie des statuts

```
ouvert ──────────────→ en_cours
                           │
               ┌───────────┤
               ▼           ▼
        attente_pieces    resolu ← (terminal)
               │
               ▼
           en_cours (retour possible)
               │
               ▼
             resolu
```

Résumé des transitions autorisées :

| Statut actuel | Transitions possibles |
|---|---|
| ouvert | en_cours |
| en_cours | attente_pieces, resolu |
| attente_pieces | en_cours, resolu |
| resolu | aucune |

---

### Permissions par rôle

| Action | opérateur | technicien | responsable |
|---|---|---|---|
| Créer un ticket | ✅ | ❌ | ❌ |
| Voir ses propres tickets | ✅ | — | — |
| Voir tickets ouverts / assignés | — | ✅ | — |
| Voir tous les tickets | ❌ | ❌ | ✅ |
| S'assigner un ticket | ❌ | ✅ | ❌ |
| Changer le statut | ❌ | ✅ (si assigné) | ✅ |
| Voir le dashboard KPI | ❌ | ❌ | ✅ |
| Gérer les équipements | ❌ | ❌ | ✅ |
| Gérer les utilisateurs | ❌ | ❌ | ✅ |

---

## 9. En cas d'erreur fréquente

### `ImportError: cannot import name 'calculer_priorite'`
→ Vérifier que le fichier `tickets/priorite.py` est bien créé et que l'import dans `views.py` est :
```python
from .priorite import calculer_priorite
```

### `AttributeError: 'str' object has no attribute 'criticite'`
→ L'équipement n'est pas encore résolu depuis le serializer. Vérifier que `equipement_id` est envoyé dans le body de la requête POST.

### `HTTP 403` sur `/api/tickets/{id}/changer_statut/`
→ Le token JWT appartient à un opérateur. Seuls les techniciens assignés et les responsables peuvent changer le statut.

### `HTTP 400` — Transition non autorisée
→ Normal, c'est la validation du cycle de vie. Lire le champ `transitions_possibles` dans la réponse pour connaître les transitions valides depuis l'état actuel.
