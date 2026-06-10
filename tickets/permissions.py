"""
tickets/permissions.py
======================
Permissions DRF métier pour le système de gestion des tickets OCP.

Hiérarchie des rôles :
  operateur   → crée les tickets, lit les siens
  technicien  → traite les tickets, met à jour les statuts
  responsable → lecture globale, KPI, tableaux de bord

Chaque classe hérite de BasePermission et surcharge :
  - has_permission      : contrôle au niveau de la vue (liste, création)
  - has_object_permission : contrôle au niveau de l'objet (détail, update)
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS


# ============================================================
# HELPERS INTERNES (non exportées)
# ============================================================

def _is_authenticated(request) -> bool:
    """Retourne True si le token JWT est valide et l'utilisateur actif."""
    return bool(request.user and request.user.is_authenticated)


def _has_role(request, role: str) -> bool:
    """Vérifie qu'un utilisateur authentifié possède exactement le rôle attendu."""
    return _is_authenticated(request) and request.user.role == role


# ============================================================
# PERMISSIONS PAR RÔLE
# ============================================================

class IsOperateur(BasePermission):
    """
    Accorde l'accès uniquement aux utilisateurs avec role='operateur'.

    Usage typique :
        permission_classes = [IsAuthenticated, IsOperateur]
    """

    message = "Accès réservé aux opérateurs."

    def has_permission(self, request, view) -> bool:
        return _has_role(request, "operateur")


class IsTechnicien(BasePermission):
    """
    Accorde l'accès uniquement aux utilisateurs avec role='technicien'.

    Usage typique :
        permission_classes = [IsAuthenticated, IsTechnicien]
    """

    message = "Accès réservé aux techniciens."

    def has_permission(self, request, view) -> bool:
        return _has_role(request, "technicien")


class IsResponsable(BasePermission):
    """
    Accorde l'accès uniquement aux utilisateurs avec role='responsable'.

    Usage typique :
        permission_classes = [IsAuthenticated, IsResponsable]
    """

    message = "Accès réservé aux responsables."

    def has_permission(self, request, view) -> bool:
        return _has_role(request, "responsable")


# ============================================================
# PERMISSION COMPOSÉE : PROPRIÉTAIRE OU LECTURE SEULE
# ============================================================

class IsOwnerOrReadOnly(BasePermission):
    """
    Autorise :
      - SAFE_METHODS (GET, HEAD, OPTIONS) à tout utilisateur authentifié.
      - Méthodes d'écriture (POST, PUT, PATCH, DELETE) uniquement au
        propriétaire de l'objet.

    L'objet doit exposer un attribut 'createur' pointant vers l'utilisateur
    propriétaire (FK dans le modèle Ticket).

    Usage :
        permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]
    """

    message = "Vous n'êtes pas le propriétaire de cette ressource."

    def has_permission(self, request, view) -> bool:
        return _is_authenticated(request)

    def has_object_permission(self, request, view, obj) -> bool:
        # Lecture autorisée pour tout utilisateur authentifié
        if request.method in SAFE_METHODS:
            return True

        # Écriture réservée au créateur du ticket
        owner = getattr(obj, "createur", None)
        return owner == request.user


# ============================================================
# PERMISSION COMPOSÉE : TECHNICIEN OU RESPONSABLE
# ============================================================

class IsTechnicienOrResponsable(BasePermission):
    """
    Accorde l'accès aux techniciens ET aux responsables.

    Utilisée pour les endpoints consultés par les deux rôles
    (ex. : détail d'un ticket, liste globale).
    """

    message = "Accès réservé aux techniciens et responsables."

    def has_permission(self, request, view) -> bool:
        return _has_role(request, "technicien") or _has_role(request, "responsable")


# ============================================================
# PERMISSION : TECHNICIEN ASSIGNÉ OU RESPONSABLE
# ============================================================

class IsAssignedTechnicienOrResponsable(BasePermission):
    """
    Autorise la modification d'un ticket uniquement si l'utilisateur est :
      - Le technicien assigné à ce ticket, OU
      - Un responsable (accès complet en écriture).

    has_permission → pré-filtre : technicien ou responsable
    has_object_permission → affine : technicien assigné ou responsable
    """

    message = "Seul le technicien assigné ou un responsable peut modifier ce ticket."

    def has_permission(self, request, view) -> bool:
        return _has_role(request, "technicien") or _has_role(request, "responsable")

    def has_object_permission(self, request, view, obj) -> bool:
        if _has_role(request, "responsable"):
            return True

        assigned = getattr(obj, "technicien", None)
        return assigned == request.user
