"""
ticketing_project/settings.py
==============================
Configuration Django pour le système de tickets OCP.

Toutes les valeurs sensibles sont lues depuis le fichier .env via python-dotenv.
Ne jamais committer de secrets dans ce fichier.

Chargement de l'environnement :
    $ cp .env.example .env   # première installation
    $ python manage.py runserver
"""

import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

# ============================================================
# CHEMINS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


# ============================================================
# HELPERS LECTURE .env
# ============================================================

def _require_env(key: str) -> str:
    """
    Lit une variable d'environnement obligatoire.

    Raises:
        ImproperlyConfigured: si la variable est absente ou vide.
    """
    value = os.getenv(key, "").strip()
    if not value:
        from django.core.exceptions import ImproperlyConfigured
        raise ImproperlyConfigured(
            f"La variable d'environnement '{key}' est obligatoire mais non définie. "
            f"Vérifiez votre fichier .env."
        )
    return value


# ============================================================
# SÉCURITÉ
# ============================================================

SECRET_KEY = _require_env("SECRET_KEY")

DEBUG = os.getenv("DEBUG", "False").strip().lower() == "true"

ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if host.strip()
]

SECURE_BROWSER_XSS_FILTER   = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"


# ============================================================
# APPLICATIONS INSTALLÉES
# ============================================================

INSTALLED_APPS = [
    # --- Django core ---
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # --- Tiers ---
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",          # ← CORS : autorise le frontend React (port 3000)
    "drf_spectacular",
    'django_filters',
    # --- Projet ---
    "tickets",
]


# ============================================================
# MIDDLEWARE
# ============================================================
# CorsMiddleware DOIT être placé avant CommonMiddleware.
# CsrfViewMiddleware est retiré : l'API REST utilise JWT, pas de session/cookie.

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",          # ← en tête de liste
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    # "django.middleware.csrf.CsrfViewMiddleware",   # désactivé — API JWT stateless
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


# ============================================================
# CORS — Cross-Origin Resource Sharing
# ============================================================
# Autorise le frontend React en développement (localhost:3000).
# En production, remplacez par le domaine réel dans CORS_ALLOWED_ORIGINS.

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Autorise les headers Authorization (JWT) et Content-Type dans les requêtes
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
]

CORS_ALLOW_METHODS = [
    "DELETE",
    "GET",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
]


# ============================================================
# URLS & WSGI
# ============================================================

ROOT_URLCONF      = "ticketing_project.urls"
WSGI_APPLICATION  = "ticketing_project.wsgi.application"


# ============================================================
# TEMPLATES
# ============================================================

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


# ============================================================
# BASE DE DONNÉES — PostgreSQL
# ============================================================

DATABASES = {
    "default": {
        "ENGINE":   "django.db.backends.postgresql",
        "NAME":     _require_env("DB_NAME"),
        "USER":     _require_env("DB_USER"),
        "PASSWORD": _require_env("DB_PASSWORD"),
        "HOST":     os.getenv("DB_HOST", "localhost"),
        "PORT":     os.getenv("DB_PORT", "5432"),
        "CONN_MAX_AGE": 60,
        "OPTIONS": {
            "connect_timeout": 10,
        },
    }
}


# ============================================================
# MODÈLE UTILISATEUR PERSONNALISÉ
# ============================================================

AUTH_USER_MODEL = "tickets.Utilisateur"


# ============================================================
# BACKENDS D'AUTHENTIFICATION
# ============================================================
# EmailAuthBackend : authentifie via email + password.
# Le ModelBackend standard n'est pas inclus : connexion par username désactivée.

AUTHENTICATION_BACKENDS = [
    "tickets.authentication.EmailAuthBackend",
]


# ============================================================
# DJANGO REST FRAMEWORK
# ============================================================

# ============================================================
# Extrait à remplacer dans ticketing_project/settings.py
# Remplacer le bloc REST_FRAMEWORK existant par celui-ci
# ============================================================

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ]
    if not DEBUG
    else [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "20/minute",
        "user": "200/minute",
    },
    # ── Filtrage global ──────────────────────────────────────
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
}


# ============================================================
# SIMPLE JWT
# ============================================================

_ACCESS_MINUTES = int(os.getenv("JWT_ACCESS_MINUTES", "60"))
_REFRESH_DAYS   = int(os.getenv("JWT_REFRESH_DAYS", "7"))

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME":  timedelta(minutes=_ACCESS_MINUTES),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=_REFRESH_DAYS),
    "ROTATE_REFRESH_TOKENS":  True,
    "BLACKLIST_AFTER_ROTATION": True,
    "ALGORITHM":    "HS256",
    "SIGNING_KEY":  SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_HEADER_NAME":  "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "TOKEN_OBTAIN_SERIALIZER": "tickets.serializers.CustomTokenObtainPairSerializer",
}


# ============================================================
# DOCUMENTATION API — drf-spectacular / Swagger
# ============================================================

SPECTACULAR_SETTINGS = {
    "TITLE": "API Tickets OCP — Documentation",
    "DESCRIPTION": (
        "API REST de gestion des tickets de maintenance industrielle.\n\n"
        "**Authentification** : JWT Bearer — obtenez un token via `/api/auth/login/`.\n\n"
        "**Rôles** : `operateur` · `technicien` · `responsable`"
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SECURITY": [{"BearerAuth": []}],
    "COMPONENTS": {
        "securitySchemes": {
            "BearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
            }
        }
    },
    "SORT_OPERATIONS": False,
    "TAGS": [
        {"name": "auth",         "description": "Authentification JWT (login, refresh, logout)"},
        {"name": "tickets",      "description": "Gestion des tickets de maintenance"},
        {"name": "equipements",  "description": "Référentiel des équipements"},
        {"name": "utilisateurs", "description": "Gestion des utilisateurs (responsable uniquement)"},
        {"name": "dashboard",    "description": "KPI et statistiques (responsable uniquement)"},
    ],
}


# ============================================================
# VALIDATION DES MOTS DE PASSE
# ============================================================

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# ============================================================
# INTERNATIONALISATION
# ============================================================

LANGUAGE_CODE = "fr-fr"
TIME_ZONE     = "Africa/Casablanca"
USE_I18N = True
USE_TZ   = True


# ============================================================
# FICHIERS STATIQUES & MÉDIAS
# ============================================================

STATIC_URL  = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL   = "media/"
MEDIA_ROOT  = BASE_DIR / "media"


# ============================================================
# REDIRECTIONS AUTH (interface admin Django)
# ============================================================

LOGIN_URL          = "/accounts/login/"
LOGIN_REDIRECT_URL = "/"
LOGOUT_REDIRECT_URL = "/accounts/login/"


# ============================================================
# CLÉ PRIMAIRE PAR DÉFAUT
# ============================================================

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"