"""
tickets/priorite.py
===================
Logique métier : calcul automatique de la priorité d'un ticket.

La priorité est déterminée par deux facteurs combinés :
  1. La criticité de l'équipement concerné
  2. La présence de mots-clés urgents dans le titre / description du ticket

Aucune dépendance Django directe → testable unitairement sans ORM.
"""

from typing import Literal

# Types explicites pour éviter les erreurs de frappe
Criticite = Literal["basse", "moyenne", "haute", "critique"]
Priorite = Literal["basse", "moyenne", "haute", "urgente"]

# ============================================================
# TABLES DE RÉFÉRENCE (modifiables sans toucher à la logique)
# ============================================================

_PRIORITE_PAR_CRITICITE: dict[Criticite, Priorite] = {
    "basse":    "basse",
    "moyenne":  "moyenne",
    "haute":    "haute",
    "critique": "urgente",
}

_MOTS_CLES_URGENTS: frozenset[str] = frozenset({
    "urgence", "urgent", "urgente",
    "critique", "critiques",
    "sécurité", "securite",
    "arrêt", "arret", "arrêt total",
    "fuite", "incendie", "explosion",
    "panne totale", "hors service",
    "danger", "accident",
    "bloqué", "bloquée", "bloquant",
})

_ORDRE_PRIORITE: list[Priorite] = ["basse", "moyenne", "haute", "urgente"]


# ============================================================
# FONCTIONS INTERNES
# ============================================================

def _priorite_depuis_criticite(criticite: Criticite) -> Priorite:
    """Retourne la priorité de base associée à la criticité de l'équipement."""
    return _PRIORITE_PAR_CRITICITE.get(criticite, "moyenne")


def _contient_mot_cle_urgent(texte: str) -> bool:
    """Retourne True si le texte contient au moins un mot-clé d'urgence."""
    mots = set(texte.lower().split())
    return bool(mots & _MOTS_CLES_URGENTS)


def _elever_priorite(priorite: Priorite) -> Priorite:
    """Remonte la priorité d'un cran (max : urgente)."""
    index_actuel = _ORDRE_PRIORITE.index(priorite)
    index_superieur = min(index_actuel + 1, len(_ORDRE_PRIORITE) - 1)
    return _ORDRE_PRIORITE[index_superieur]


# ============================================================
# FONCTION PUBLIQUE
# ============================================================

def calculer_priorite(
    criticite_equipement: Criticite,
    titre: str,
    description: str,
) -> Priorite:
    """
    Calcule la priorité d'un ticket à partir de la criticité de l'équipement
    et du contenu textuel du ticket.

    Règles appliquées dans l'ordre :
      1. La criticité de l'équipement définit la priorité de base.
      2. Si le titre ou la description contient un mot-clé urgent,
         la priorité est élevée d'un cran (max : urgente).

    Args:
        criticite_equipement: Valeur du champ 'criticite' sur le modèle Equipement.
        titre:                 Titre saisi par l'opérateur.
        description:           Description détaillée du problème.

    Returns:
        Priorité calculée : 'basse' | 'moyenne' | 'haute' | 'urgente'.

    Examples:
        >>> calculer_priorite("haute", "Fuite détectée", "Fuite d'huile sur pompe P12")
        'urgente'
        >>> calculer_priorite("basse", "Vérification annuelle", "Contrôle planifié")
        'basse'
    """
    priorite_base = _priorite_depuis_criticite(criticite_equipement)

    texte_complet = f"{titre} {description}"
    if _contient_mot_cle_urgent(texte_complet):
        return _elever_priorite(priorite_base)

    return priorite_base
