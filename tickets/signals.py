"""
tickets/signals.py
==================
Signaux Django pour l'enrichissement automatique de l'historique des équipements.

Principe de fonctionnement :
  Django envoie un signal `post_save` après chaque appel à `.save()` sur un modèle.
  On connecte un "receiver" (fonction écouteur) à ce signal sur le modèle Ticket.
  À chaque sauvegarde d'un ticket, le receiver compare l'état actuel avec l'état
  précédent (stocké en mémoire via `pre_save`) pour détecter ce qui a changé,
  puis ajoute une ligne dans le champ `historique` de l'équipement associé.

Événements tracés automatiquement via signaux :
  - Changement de statut (ex : ouvert → en_cours)
  - Ajout ou modification des notes technicien
  - Résolution du ticket (date_resolution renseignée)

Événements tracés via appels directs dans views.py (plus précis) :
  - Création d'un ticket
  - Assignation à un technicien

Format de chaque entrée :
  [JJ/MM/AAAA HH:MM] - Ticket #ID - Action : description
"""

from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from django.utils import timezone

from .models import Ticket


# ── Helpers ───────────────────────────────────────────────────────────────────

def _horodatage() -> str:
    """Retourne l'horodatage courant formaté pour l'historique."""
    return timezone.now().strftime("%d/%m/%Y %H:%M")


def _construire_entree(ticket_id: int, action: str, detail: str = "") -> str:
    """
    Construit une ligne d'historique normalisée.

    Args:
        ticket_id: Identifiant du ticket concerné.
        action: Libellé court de l'action (ex : 'Statut modifié').
        detail: Complément d'information optionnel.

    Returns:
        Chaîne formatée : '[JJ/MM/AAAA HH:MM] - Ticket #ID - Action : detail'
    """
    base = f"[{_horodatage()}] - Ticket #{ticket_id} - {action}"
    return f"{base} : {detail}" if detail else base


def ajouter_entree_historique(equipement, ticket_id: int, action: str, detail: str = "") -> None:
    """
    Ajoute une ligne dans le champ `historique` de l'équipement.

    Utilise `update_fields` pour ne mettre à jour que le champ `historique`,
    évitant tout effet de bord sur les autres champs de l'équipement.

    Args:
        equipement: Instance du modèle Equipement à mettre à jour.
        ticket_id: Identifiant du ticket concerné.
        action: Libellé de l'action.
        detail: Détail complémentaire (statut, nom technicien, extrait de notes…).
    """
    entree     = _construire_entree(ticket_id, action, detail)
    separateur = "\n" if equipement.historique else ""
    equipement.historique = f"{equipement.historique}{separateur}{entree}"
    equipement.save(update_fields=["historique"])


# ── Libellés des statuts ──────────────────────────────────────────────────────

_LABELS_STATUT = {
    "ouvert":          "Ouvert",
    "en_cours":        "En cours",
    "attente_pieces":  "En attente de pièces",
    "resolu":          "Résolu",
}

def _label_statut(statut: str) -> str:
    return _LABELS_STATUT.get(statut, statut)


# ── Signal pre_save : mémorisation de l'état AVANT sauvegarde ─────────────────
#
# Pourquoi pre_save ?
#   post_save reçoit l'objet APRÈS modification — on ne peut plus lire l'ancien
#   statut. On utilise donc pre_save pour lire les valeurs actuelles en base
#   et les stocker dans un attribut temporaire `_etat_avant` sur l'instance.
#   post_save peut ensuite comparer `_etat_avant` avec le nouvel état.

@receiver(pre_save, sender=Ticket)
def memoriser_etat_avant_sauvegarde(sender, instance, **kwargs):
    """
    Lit l'état actuel du ticket en base et le stocke dans `instance._etat_avant`.
    Ne fait rien si le ticket est en cours de création (pas encore d'ID).
    """
    if not instance.pk:
        # Ticket en cours de création : pas d'état précédent à mémoriser
        instance._etat_avant = None
        return

    try:
        etat_avant = Ticket.objects.get(pk=instance.pk)
        instance._etat_avant = {
            "statut":            etat_avant.statut,
            "notes_technicien":  etat_avant.notes_technicien,
            "date_resolution":   etat_avant.date_resolution,
            "technicien_id":     etat_avant.technicien_id,
        }
    except Ticket.DoesNotExist:
        instance._etat_avant = None


# ── Signal post_save : écriture dans l'historique ─────────────────────────────

@receiver(post_save, sender=Ticket)
def enrichir_historique_equipement(sender, instance, created, **kwargs):
    """
    Après chaque sauvegarde d'un ticket, détecte les changements et ajoute
    les entrées correspondantes dans l'historique de l'équipement.

    Le paramètre `created` (fourni par Django) est True uniquement lors
    de la toute première sauvegarde (INSERT SQL), False pour les updates.

    Les événements de création et d'assignation sont tracés depuis views.py
    (via ajouter_entree_historique) car ce signal ne connaît pas le contexte
    métier précis (qui a créé, avec quelle priorité, etc.).
    """
    equipement = instance.equipement
    if not equipement:
        return

    # Ticket nouvellement créé : la création est déjà tracée dans views.py
    # via perform_create → on ne double pas l'entrée ici.
    if created:
        return

    etat_avant = getattr(instance, "_etat_avant", None)
    if not etat_avant:
        return

    _tracer_changement_statut(instance, equipement, etat_avant)
    _tracer_ajout_notes(instance, equipement, etat_avant)
    _tracer_resolution(instance, equipement, etat_avant)


# ── Détecteurs de changement ──────────────────────────────────────────────────

def _tracer_changement_statut(ticket, equipement, etat_avant: dict) -> None:
    """
    Trace le changement de statut si le statut a évolué.

    Exemple d'entrée générée :
      [15/01/2025 14:30] - Ticket #42 - Statut modifié : En cours → En attente de pièces
    """
    statut_avant   = etat_avant["statut"]
    statut_actuel  = ticket.statut

    if statut_avant == statut_actuel:
        return

    detail = f"{_label_statut(statut_avant)} → {_label_statut(statut_actuel)}"
    ajouter_entree_historique(equipement, ticket.id, "Statut modifié", detail)


def _tracer_ajout_notes(ticket, equipement, etat_avant: dict) -> None:
    """
    Trace l'ajout ou la modification des notes technicien.
    N'ajoute une entrée que si les notes ont réellement changé et sont non vides.

    Exemple d'entrée générée :
      [15/01/2025 14:35] - Ticket #42 - Notes technicien : Remplacement du joint...
    """
    notes_avant   = etat_avant["notes_technicien"] or ""
    notes_actuelles = ticket.notes_technicien or ""

    if notes_avant == notes_actuelles or not notes_actuelles:
        return

    # Tronquer les notes longues pour garder l'historique lisible
    extrait = notes_actuelles[:120] + "…" if len(notes_actuelles) > 120 else notes_actuelles
    ajouter_entree_historique(equipement, ticket.id, "Notes technicien", extrait)


def _tracer_resolution(ticket, equipement, etat_avant: dict) -> None:
    """
    Trace la résolution du ticket (première fois que date_resolution est renseignée).

    Exemple d'entrée générée :
      [15/01/2025 16:00] - Ticket #42 - Ticket résolu
    """
    resolution_avant   = etat_avant["date_resolution"]
    resolution_actuelle = ticket.date_resolution

    if resolution_avant is not None or resolution_actuelle is None:
        return

    ajouter_entree_historique(equipement, ticket.id, "Ticket résolu")
