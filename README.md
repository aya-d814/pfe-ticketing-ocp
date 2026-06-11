\# OCP Ticketing - Système de Gestion des Tickets de Maintenance



\*\*Version :\*\* 1.0.0 | \*\*Django :\*\* 4.2 | \*\*React :\*\* 18 | \*\*PostgreSQL :\*\* 15 



\## 📋 Description



Application web complète pour la gestion des tickets de maintenance industrielle, assistée par intelligence artificielle. Développée dans le cadre du Projet de Fin d'Études (PFE) au sein du département \*\*Digit'All Manufacturing\*\* du \*\*Groupe OCP\*\*.



L'application permet aux opérateurs de signaler des pannes, aux techniciens de gérer les interventions, et aux responsables de superviser l'activité maintenance grâce à des tableaux de bord analytiques enrichis par l'IA Gemini.



\---



\## 🎯 Fonctionnalités principales



| Fonctionnalité | Description |

|----------------|-------------|

| \*\*Authentification\*\* | JWT avec 3 rôles : Opérateur, Technicien, Responsable |

| \*\*Gestion des tickets\*\* | CRUD complet, workflow (Ouvert → En cours → Attente pièces → Résolu) |

| \*\*Registre des équipements\*\* | Suivi des équipements avec historique, criticité, localisation |

| \*\*Assistant IA\*\* | Diagnostic automatique des pannes via Google Gemini |

| \*\*Dashboard responsable\*\* | KPIs, graphiques (Recharts), MTTR, top équipements |

| \*\*Notifications\*\* | Alertes en temps réel lors des changements de statut |

| \*\*Analyse IA par équipement\*\* | Résumé, pannes récurrentes, cas similaires |



\---



\## 🛠️ Stack Technique



\### Backend

\- \*\*Framework\*\* : Django 4.2 + Django REST Framework

\- \*\*Base de données\*\* : PostgreSQL 15

\- \*\*Authentification\*\* : JWT (SimpleJWT)

\- \*\*IA\*\* : Google Gemini API (modèle gemini-2.5-flash)



\### Frontend

\- \*\*Framework\*\* : React 18

\- \*\*UI Library\*\* : Ant Design 5

\- \*\*Graphiques\*\* : Recharts

\- \*\*HTTP Client\*\* : Axios



\---



\## 🚀 Installation



\### Prérequis



\- Python 3.12+

\- Node.js 18+

\- PostgreSQL 15+



\### Backend



```bash

\# 1. Cloner le repository

git clone https://github.com/aya-d814/pfe-ticketing-ocp.git

cd pfe-ticketing-ocp



\# 2. Créer et activer l'environnement virtuel

python -m venv venv

source venv/bin/activate  # Linux/Mac

venv\\Scripts\\activate     # Windows



\# 3. Installer les dépendances

pip install -r requirements.txt



\# 4. Configurer les variables d'environnement (.env)

\# Copier .env.example et renommer en .env

\# Remplir les informations :

\#   DB\_NAME, DB\_USER, DB\_PASSWORD, DB\_HOST, DB\_PORT

\#   GEMINI\_API\_KEY



\# 5. Appliquer les migrations

python manage.py migrate



\# 6. Restaurer la base de données (optionnel)

psql -U postgres -d ticketing\_db < pfe\_ticketing\_backup.sql



\# 7. Lancer le serveur

python manage.py runserver

```



\### Frontend



```bash

\# 1. Aller dans le dossier frontend

cd frontend



\# 2. Installer les dépendances

npm install



\# 3. Lancer l'application

npm start

```



L'application sera accessible à : \*\*http://localhost:3000\*\*



\---



\## 👥 Comptes de démonstration



| Rôle | Email | Mot de passe |

|------|-------|--------------|

| \*\*Responsable\*\* | responsable1@ocp.ma | responsable123 |

| \*\*Technicien 1\*\* | technicien1@ocp.ma | technicien123 |

| \*\*Technicien 2\*\* | technicien2@ocp.ma | technicien123 |

| \*\*Opérateur 1\*\* | operateur1@ocp.ma | operateur123 |

| \*\*Opérateur 2\*\* | operateur2@ocp.ma | operateur123 |

| \*\*Admin\*\* | aya30@gmail.com | admin123 |



\---



\## 📁 Structure du projet



```

pfe-ticketing-ocp/

├── manage.py

├── requirements.txt

├── .env.example

├── pfe\_ticketing\_backup.sql

├── ticketing\_project/

│   ├── settings.py

│   ├── urls.py

│   └── wsgi.py

├── tickets/

│   ├── models.py

│   ├── views.py

│   ├── serializers.py

│   ├── permissions.py

│   ├── filters.py

│   ├── services/

│   │   ├── llm\_service.py

│   │   └── analyse\_ia\_service.py

│   └── migrations/

└── frontend/

&#x20;   ├── package.json

&#x20;   ├── public/

&#x20;   └── src/

&#x20;       ├── components/

&#x20;       ├── context/

&#x20;       ├── services/

&#x20;       └── App.js

```



\---



\## 🔧 Endpoints API principaux



| Méthode | Endpoint | Description |

|---------|----------|-------------|

| POST | `/api/auth/login/` | Authentification |

| POST | `/api/auth/logout/` | Déconnexion |

| POST | `/api/auth/refresh/` | Rafraîchir token |

| GET | `/api/tickets/` | Liste des tickets |

| POST | `/api/tickets/` | Créer un ticket |

| GET | `/api/tickets/{id}/` | Détail d'un ticket |

| PATCH | `/api/tickets/{id}/assigner/` | Assigner un ticket |

| PATCH | `/api/tickets/{id}/changer\_statut/` | Changer statut |

| POST | `/api/tickets/{id}/suggerer\_ia/` | Suggestion IA |

| GET | `/api/equipements/` | Liste des équipements |

| GET | `/api/equipements/{id}/statistiques/` | Stats équipement |

| GET | `/api/equipements/{id}/pannes\_par\_mois/` | Pannes par mois |

| GET | `/api/equipements/{id}/interventions/` | Historique interventions |

| GET | `/api/equipements/{id}/pannes\_recurrentes/` | Pannes récurrentes |

| GET | `/api/equipements/{id}/cas\_similaires/` | Cas similaires |

| GET | `/api/equipements/{id}/resume\_ia/` | Résumé IA |

| GET | `/api/dashboard/stats/` | KPIs dashboard |

| GET | `/api/dashboard/stats\_mensuelles/` | Évolution mensuelle |

| GET | `/api/dashboard/stats\_par\_statut/` | Répartition par statut |

| GET | `/api/dashboard/stats\_par\_mois/` | KPIs par mois |

| GET | `/api/notifications/` | Liste notifications |

| PATCH | `/api/notifications/{id}/lire/` | Marquer notification lue |



\---



\## 🤖 Module IA - Google Gemini



L'application utilise \*\*Google Gemini\*\* pour :



1\. \*\*Analyser la panne\*\* à partir de la description et du type d'équipement

2\. \*\*Générer une cause racine\*\* probable

3\. \*\*Proposer une liste de contrôle\*\* d'inspection

4\. \*\*Suggérer les pièces de rechange\*\* nécessaires



\### Exemple de suggestion IA générée :



```

🔍 Hypothèse de cause racine probable :

Défaillance des roulements ou désalignement de l'arbre



📋 Liste de contrôle d'inspection :

1\. Vérifier la température des roulements

2\. Effectuer une analyse vibratoire détaillée

3\. Contrôler l'alignement de l'accouplement pompe-moteur

4\. Inspecter le niveau et la qualité du lubrifiant

5\. Vérifier les pressions d'aspiration et refoulement



🛠️ Pièces de rechange potentielles :

\- Jeu de roulements

\- Garniture mécanique

\- Joints d'étanchéité

\- Lubrifiant spécifique

```



\---



\## 📊 Captures d'écran



\### Dashboard Responsable

\- KPIs mensuels (tickets ouverts, en cours, résolus, MTTR)

\- Graphique d'évolution mensuelle

\- Répartition par statut (camembert)

\- Top 5 équipements en panne



\### Détail d'un ticket avec suggestion IA

\- Diagnostic généré par Gemini

\- Liste de contrôle interactive

\- Pièces de rechange suggérées



\### Liste des équipements

\- Filtrage par type, localisation, criticité

\- Recherche textuelle

\- Score de santé (Health Score)



\---



\## 🧪 Tests



\### Backend

```bash

python manage.py test

```



\### Frontend

```bash

cd frontend

npm test

```



\---



\## 🔒 Variables d'environnement (.env)



Créez un fichier `.env` à la racine du projet :



```env

\# Base de données

DB\_NAME=ticketing\_db

DB\_USER=postgres

DB\_PASSWORD=votre\_mot\_de\_passe

DB\_HOST=localhost

DB\_PORT=5432



\# Django

SECRET\_KEY=votre\_cle\_secrete\_django

DEBUG=True



\# API Gemini

GEMINI\_API\_KEY=votre\_cle\_api\_gemini

```



\---



\## 📈 Améliorations futures



\- \[ ] Export PDF/Excel des rapports

\- \[ ] Application mobile (React Native)

\- \[ ] Entraînement d'un modèle IA personnalisé



\---



\## 🐛 Résolution des problèmes courants



| Problème | Solution |

|----------|----------|

| Erreur 401 Unauthorized | Vérifier que le token JWT est présent dans localStorage |

| API Gemini ne répond pas | Vérifier la clé API dans .env |

| Base de données vide | Exécuter `psql -U postgres -d ticketing\_db < pfe\_ticketing\_backup.sql` |

| Frontend ne charge pas | Vérifier que le backend tourne sur le port 8000 |



\---



\## 📄 Licence



Ce projet a été développé dans le cadre du \*\*PFE OCP Group - Digit'All Manufacturing\*\*.



\---



\## 👤 Auteur



\*\*Aya Bouaiba\*\*  

Étudiante - Projet de Fin d'Études  

📧 ayabouaiba5@gmail.com



\---



\## 🙏 Remerciements



\- \*\*OCP Group\*\* pour l'opportunité et le cadre du projet

\- \*\*Digit'All Manufacturing\*\* pour l'accompagnement technique

\- \*\*L'équipe encadrante\*\* pour les conseils et le suivi

