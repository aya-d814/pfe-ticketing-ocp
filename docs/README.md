# PFE Ticketing - Application de Gestion des Tickets de Maintenance

## 📋 Description du projet

Ce projet est développé dans le cadre d'un PFE (Projet de Fin d'Études). L'objectif est de construire un système numérique léger de gestion des tickets de maintenance pour les usines de production d'engrais (OCP Group).

**Problème actuel :** Les demandes d'intervention sont transmises verbalement, par téléphone ou sur formulaires papier → traçabilité insuffisante, délais de réponse élevés, erreurs de diagnostic répétées.

**Solution :** Une application web où les opérateurs signalent les pannes, les techniciens les gèrent et les résolvent, et un assistant IA suggère automatiquement des diagnostics probables.

## 🎯 Fonctionnalités principales

### Pour l'Opérateur
- Authentification avec email et mot de passe
- Créer un ticket de panne (choix équipement + description)
- Voir la liste de ses tickets avec leur statut
- Recevoir une notification quand son ticket est résolu

### Pour le Technicien
- Voir tous les tickets ouverts ou assignés
- Être assigné à un ticket
- **Assistant IA** : suggestion automatique de :
  - Cause racine probable
  - Liste de contrôle étape par étape
  - Pièces de rechange nécessaires
- Changer le statut du ticket (Ouvert → En cours → Attente pièces → Résolu)
- Ajouter des notes d'intervention
- Accepter, modifier ou ignorer la suggestion IA

### Pour le Responsable
- Tableau de bord avec KPI :
  - Nombre de tickets ouverts
  - Temps moyen de réparation (MTTR)
  - Top 3 des équipements les plus en panne
- Filtrer les tickets par période (semaine, mois, année)

## 🛠️ Stack technique

| Composant | Technologie |
|-----------|-------------|
| Backend | Django 6.0.4 + Django REST Framework |
| Base de données | PostgreSQL |
| Frontend | React.js (à venir) |
| Authentification | JWT + gestion des rôles |
| IA / LLM | API OpenAI (ou équivalent) |
| Versionnage | Git |

## 📁 Structure du projet
pfe_ticketing/
│
├── docs/ # Documentation
│ ├── user_stories.md
│ ├── database_schema.dbml
│ └── parcours_utilisateurs.md
│
├── ticketing_project/ # Configuration Django
│ ├── init.py
│ ├── settings.py
│ ├── urls.py
│ └── wsgi.py
│
├── tickets/ # Application principale
│ ├── init.py
│ ├── admin.py
│ ├── apps.py
│ ├── models.py # Utilisateur, Equipement, Ticket, SuggestionIA, Notification
│ ├── views.py
│ ├── serializers.py
│ ├── urls.py
│ └── permissions.py
│
├── manage.py
├── requirements.txt
├── .env
└── README.md


## 📊 Modèle de données

Le modèle comprend 5 tables principales :

| Table | Description |
|-------|-------------|
| `users` | Utilisateurs avec rôles (opérateur, technicien, responsable) |
| `equipment` | Équipements de l'usine (nom, type, localisation, criticité) |
| `tickets` | Tickets de maintenance (description, statut, priorité, dates) |
| `ia_suggestions` | Suggestions générées par l'IA (cause, checklist, pièces) |
| `notifications` | Notifications utilisateurs (message, lue, lien) |

## 🚀 Installation et exécution

### 1. Prérequis

- Python 3.12 ou supérieur
- PostgreSQL 15 ou supérieur
- Git (optionnel)

# Windows
python -m venv venv
venv\Scripts\activate
mkdir pfe_ticketing
cd pfe_ticketing
python -m venv venv
venv\Scripts\activate
pip install django djangorestframework psycopg2-binary django-cors-headers
django-admin startproject ticketing_project .
python manage.py startapp tickets

# Configurer PostgreSQL
CREATE DATABASE ticketing_db;
# Configuration Django
pip install python-dotenv