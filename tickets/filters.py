"""
tickets/filters.py
==================
Filtres django-filter pour les viewsets TicketViewSet et EquipementViewSet.

Les filtres s'appliquent APRÈS le filtrage par rôle effectué dans get_queryset(),
garantissant que les opérateurs et techniciens ne peuvent filtrer que dans
leur propre sous-ensemble de tickets.
"""

import django_filters
from .models import Ticket, Equipement, Utilisateur


class TicketFilter(django_filters.FilterSet):
    """
    Filtres disponibles sur /api/tickets/ :

    - statut        : filtre exact (ouvert, en_cours, attente_pieces, resolu)
    - priorite      : filtre exact (basse, moyenne, haute, urgente)
    - search        : recherche partielle insensible à la casse dans titre + description
    - technicien_id : filtre par technicien assigné (responsable uniquement côté frontend)
    - createur_id   : filtre par créateur (responsable uniquement côté frontend)
    - date_debut    : tickets créés à partir de cette date (inclusif)
    - date_fin      : tickets créés jusqu'à cette date (inclusif)
    """

    statut    = django_filters.ChoiceFilter(choices=Ticket.STATUT_CHOICES)
    priorite  = django_filters.ChoiceFilter(choices=Ticket.PRIORITE_CHOICES)

    search = django_filters.CharFilter(
        method="filtrer_par_texte",
        label="Recherche texte (titre ou description)",
    )

    technicien_id = django_filters.ModelChoiceFilter(
        queryset=Utilisateur.objects.filter(role="technicien"),
        field_name="technicien",
        label="Technicien assigné",
    )

    createur_id = django_filters.ModelChoiceFilter(
        queryset=Utilisateur.objects.filter(role__in=["operateur", "responsable"]),
        field_name="createur",
        label="Créateur du ticket",
    )

    date_debut = django_filters.DateFilter(
        field_name="date_creation",
        lookup_expr="date__gte",
        label="Créé à partir du",
    )

    date_fin = django_filters.DateFilter(
        field_name="date_creation",
        lookup_expr="date__lte",
        label="Créé jusqu'au",
    )

    equipement_id = django_filters.ModelChoiceFilter(
        queryset=Equipement.objects.all(),
        field_name="equipement",
        label="Équipement",
    )

    class Meta:
        model  = Ticket
        fields = [
            "statut", "priorite", "technicien_id", "createur_id",
            "date_debut", "date_fin", "equipement_id",
        ]

    def filtrer_par_texte(self, queryset, name, value):
        """Recherche dans le titre ET la description (OR, insensible à la casse)."""
        from django.db.models import Q
        return queryset.filter(
            Q(titre__icontains=value) | Q(description__icontains=value)
        )


class EquipementFilter(django_filters.FilterSet):
    """
    Filtres disponibles sur /api/equipements/ :

    - type_equipement : filtre exact
    - localisation    : recherche partielle insensible à la casse
    - criticite       : filtre exact (basse, moyenne, haute, critique)
    - search          : recherche dans nom + historique
    """

    type_equipement = django_filters.CharFilter(
        lookup_expr="iexact",
        label="Type d'équipement (exact)",
    )

    localisation = django_filters.CharFilter(
        lookup_expr="icontains",
        label="Localisation (contient)",
    )

    criticite = django_filters.ChoiceFilter(
        choices=Equipement.CRITICITE_CHOICES,
        label="Criticité",
    )

    search = django_filters.CharFilter(
        method="filtrer_par_texte",
        label="Recherche texte (nom ou historique)",
    )

    class Meta:
        model  = Equipement
        fields = ["type_equipement", "localisation", "criticite"]

    def filtrer_par_texte(self, queryset, name, value):
        """Recherche dans le nom ET l'historique (OR, insensible à la casse)."""
        from django.db.models import Q
        return queryset.filter(
            Q(nom__icontains=value) | Q(historique__icontains=value)
        )


# ── InterventionFilter pour l'historique structuré des interventions (étape 4) ──

class InterventionFilter(django_filters.FilterSet):
    """
    Filtres spécifiques pour l'endpoint /interventions/.
    Supporte la recherche textuelle (titre + notes technicien),
    les dates de création et le statut.
    """

    search = django_filters.CharFilter(
        method="filtrer_par_texte",
        label="Recherche (titre ou notes)",
    )
    date_debut = django_filters.DateFilter(
        field_name="date_creation",
        lookup_expr="date__gte",
        label="Créé à partir du",
    )
    date_fin = django_filters.DateFilter(
        field_name="date_creation",
        lookup_expr="date__lte",
        label="Créé jusqu'au",
    )
    statut = django_filters.ChoiceFilter(
        choices=Ticket.STATUT_CHOICES,
        label="Statut",
    )

    class Meta:
        model = Ticket
        fields = ["statut", "date_debut", "date_fin"]

    def filtrer_par_texte(self, queryset, name, value):
        """Recherche dans le titre OU les notes technicien (OR, insensible à la casse)."""
        from django.db.models import Q
        return queryset.filter(
            Q(titre__icontains=value) | Q(notes_technicien__icontains=value)
        )