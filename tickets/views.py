"""
tickets/views.py
================
API viewsets pour le système de gestion des tickets OCP.

Modifications :
  - Import llm_service (Gemini + fallback mock) au lieu de llm_mock
  - filterset_class + search_fields sur TicketViewSet et EquipementViewSet
  - Sécurité par rôle dans get_queryset() conservée intacte
  - Ajout historique automatique des équipements (appels à ajouter_entree_historique)
  - Ajout de trois actions IA dans EquipementViewSet :
      pannes_recurrentes, cas_similaires, resume_ia
  - Action pannes_par_mois avec paramètre optionnel 'annee'
"""

import logging

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Q
from django.db.models.functions import TruncMonth
from django.utils import timezone
from datetime import date


from .models import Utilisateur, Equipement, Ticket, SuggestionIA, Notification
from .serializers import (
    UtilisateurSerializer,
    EquipementSerializer,
    TicketSerializer,
    SuggestionIASerializer,
    FeedbackSuggestionSerializer,
    NotificationSerializer,
)
from .permissions import IsOperateur, IsTechnicien, IsResponsable, IsTechnicienOrResponsable
from .priorite import calculer_priorite
from .filters import TicketFilter, EquipementFilter, InterventionFilter
from .services.llm_service import appeler_llm, appeler_llm_texte
from .services.analyse_ia_service import (
    detecter_pannes_recurrentes,
    trouver_cas_similaires,
)
from .signals import ajouter_entree_historique

logger = logging.getLogger(__name__)


# ── Constantes métier ─────────────────────────────────────────────────────────

TRANSITIONS_AUTORISEES: dict[str, list[str]] = {
    "ouvert":         ["en_cours"],
    "en_cours":       ["attente_pieces", "resolu"],
    "attente_pieces": ["en_cours", "resolu"],
    "resolu":         [],
}

NOMBRE_TICKETS_HISTORIQUE  = 3
NOMBRE_TICKETS_RESUME_IA   = 30
CONFIANCE_DEFAUT           = 0.95
MODELE_IA_NOM              = "gemini-1.5-flash"

# ── Helpers pour les dates (utilisés par EquipementViewSet et DashboardViewSet) ──

_MONTHS_FR = [
    "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
    "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
]

def _label_mois(d: date) -> str:
    """Retourne 'Jan 2025' pour un objet date."""
    return f"{_MONTHS_FR[d.month - 1]} {d.year}"

def _build_rolling_12_months() -> list[date]:
    """Retourne les 12 premiers jours de mois (mois_courant - 11) jusqu'au mois courant inclus."""
    today = date.today()
    months = []
    for i in range(11, -1, -1):
        total_months = today.month - 1 - i
        year = today.year + total_months // 12
        month = total_months % 12 + 1
        months.append(date(year, month, 1))
    return months

def _date_to_label(d: date) -> str:
    """Convertit un objet date en label lisible : 'Jan 2025'."""
    return f"{_MONTHS_FR[d.month - 1]} {d.year}"


# ── 1. VIEWSET UTILISATEUR ────────────────────────────────────────────────────

class UtilisateurViewSet(viewsets.ModelViewSet):
    """CRUD Utilisateurs — réservé aux responsables."""

    queryset           = Utilisateur.objects.all()
    serializer_class   = UtilisateurSerializer
    permission_classes = [IsAuthenticated, IsResponsable]

    def get_queryset(self):
        if self.request.user.role == "responsable":
            return Utilisateur.objects.all()
        return Utilisateur.objects.filter(id=self.request.user.id)


# ── 2. VIEWSET ÉQUIPEMENT ─────────────────────────────────────────────────────

class EquipementViewSet(viewsets.ModelViewSet):
    """
    Lecture : technicien et responsable uniquement.
    Écriture : responsable uniquement.
    Filtrage : type, localisation, criticité, recherche texte.

    Actions supplémentaires :
      GET /api/equipements/{id}/statistiques/       — métriques agrégées.
      GET /api/equipements/{id}/pannes_par_mois/    — série temporelle 12 mois (annee optionnel).
      GET /api/equipements/{id}/interventions/      — historique paginé.
      GET /api/equipements/{id}/pieces_detail/      — pièces remplacées paginées.
      GET /api/equipements/{id}/pannes_recurrentes/ — familles de pannes (IA locale).
      GET /api/equipements/{id}/cas_similaires/     — tickets similaires TF-IDF.
      GET /api/equipements/{id}/resume_ia/          — résumé Gemini texte libre.
    """

    queryset           = Equipement.objects.all()
    serializer_class   = EquipementSerializer
    permission_classes = [IsAuthenticated]

    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_class = EquipementFilter
    search_fields   = ["nom", "historique"]

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            # Lecture : tous les utilisateurs authentifiés (opérateurs inclus)
            return [IsAuthenticated()]
        if self.action in ["create", "update", "partial_update", "destroy"]:
            # Écriture : responsables uniquement
            return [IsAuthenticated(), IsResponsable()]
        # Actions personnalisées (statistiques, pannes_par_mois, etc.)
        return [IsAuthenticated(), IsTechnicienOrResponsable()]

    # ── Action : statistiques d'un équipement ────────────────────────────────

    @action(detail=True, methods=["get"], url_path="statistiques")
    def statistiques(self, request, pk=None):
        equipement = self.get_object()
        tickets    = Ticket.objects.filter(equipement=equipement)

        nombre_pannes  = tickets.count()
        derniere_panne = (
            tickets.order_by("-date_creation")
                   .values_list("date_creation", flat=True)
                   .first()
        )

        tickets_ouverts = tickets.filter(statut__in=["ouvert", "en_cours"]).count()
        tickets_resolus = tickets.filter(statut="resolu").count()

        mttr_heures       = self._calculer_mttr_equipement(tickets)
        pieces_remplacees = self._extraire_pieces_remplacees(tickets)
        health_score      = self._calculer_health_score(
            equipement.criticite, nombre_pannes, tickets_ouverts
        )

        return Response({
            "nombre_pannes":     nombre_pannes,
            "derniere_panne":    derniere_panne,
            "tickets_ouverts":   tickets_ouverts,
            "tickets_resolus":   tickets_resolus,
            "mttr_heures":       mttr_heures,
            "pieces_remplacees": pieces_remplacees,
            "health_score":      health_score,
        })

    # Action statistiques mensuelles
    @action(detail=True, methods=["get"], url_path="statistiques_mensuelles")
    def statistiques_mensuelles(self, request, pk=None):
        """
        GET /api/equipements/{id}/statistiques_mensuelles/

        Retourne les statistiques de l'équipement filtrées sur le mois courant
        (selon date_creation des tickets).

        Réponse :
        nombre_pannes     — tickets créés ce mois
        tickets_ouverts   — tickets créés ce mois non résolus
        tickets_resolus   — tickets créés ce mois et résolus
        mttr_heures       — MTTR des tickets résolus ce mois (float|null)
        derniere_panne    — date_creation du ticket le plus récent du mois (datetime|null)
        taux_resolution   — tickets_resolus / nombre_pannes (float|null)
        mois              — mois courant au format "YYYY-MM"
        """
        from datetime import date as date_type

        equipement = self.get_object()
        aujourd_hui = date_type.today()
        annee = aujourd_hui.year
        mois = aujourd_hui.month

        tickets_mois = Ticket.objects.filter(
            equipement=equipement,
            date_creation__year=annee,
            date_creation__month=mois,
        )

        nombre_pannes = tickets_mois.count()
        tickets_ouverts = tickets_mois.exclude(statut="resolu").count()
        tickets_resolus = tickets_mois.filter(statut="resolu").count()

        # MTTR : uniquement les tickets résolus CE mois, avec date_resolution renseignée
        resolus_avec_dates = tickets_mois.filter(
            statut="resolu",
            date_resolution__isnull=False,
        )
        mttr_heures = None
        if resolus_avec_dates.exists():
            total_secondes = sum(
                (t.date_resolution - t.date_creation).total_seconds()
                for t in resolus_avec_dates
            )
            mttr_heures = round(total_secondes / resolus_avec_dates.count() / 3600, 1)

        derniere_panne = (
            tickets_mois.order_by("-date_creation")
            .values_list("date_creation", flat=True)
            .first()
        )

        taux_resolution = None
        if nombre_pannes > 0:
            taux_resolution = round(tickets_resolus / nombre_pannes * 100, 1)

        return Response({
            "mois": f"{annee}-{str(mois).zfill(2)}",
            "nombre_pannes": nombre_pannes,
            "tickets_ouverts": tickets_ouverts,
            "tickets_resolus": tickets_resolus,
            "mttr_heures": mttr_heures,
            "derniere_panne": derniere_panne,
            "taux_resolution": taux_resolution,
        })
    # ── Action : pannes récurrentes (sans LLM) ───────────────────────────────

    @action(detail=True, methods=["get"], url_path="pannes_recurrentes")
    def pannes_recurrentes(self, request, pk=None):
        equipement = self.get_object()
        tickets = Ticket.objects.filter(equipement=equipement).prefetch_related("suggestions")
        try:
            resultats = detecter_pannes_recurrentes(tickets)
        except Exception as exc:
            logger.error("Erreur pannes récurrentes %s : %s", pk, exc)
            return Response({"detail": "Erreur lors de l'analyse des pannes récurrentes."},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(resultats)

    # ── Action : cas similaires (TF-IDF, sans LLM) ───────────────────────────

    @action(detail=True, methods=["get"], url_path="cas_similaires")
    def cas_similaires(self, request, pk=None):
        equipement = self.get_object()
        ticket_id = request.query_params.get("ticket_id")
        if not ticket_id:
            return Response({"detail": "Le paramètre 'ticket_id' est obligatoire."},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            ticket_cible = Ticket.objects.get(pk=ticket_id, equipement=equipement)
        except Ticket.DoesNotExist:
            return Response({"detail": "Ticket introuvable ou n'appartient pas à cet équipement."},
                            status=status.HTTP_404_NOT_FOUND)

        tickets_cible = Ticket.objects.filter(equipement=equipement).prefetch_related("suggestions")
        tickets_autres = Ticket.objects.exclude(equipement=equipement).select_related("equipement").prefetch_related("suggestions")

        try:
            resultats = trouver_cas_similaires(tickets_cible, tickets_autres)
        except Exception as exc:
            logger.error("Erreur cas similaires ticket %s : %s", ticket_id, exc)
            return Response({"detail": "Erreur lors de la recherche de cas similaires."},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(resultats)

    # ── Action : résumé IA (Gemini) ─────────────────────────────────────────

    @action(detail=True, methods=["get"], url_path="resume_ia")
    def resume_ia(self, request, pk=None):
        equipement = self.get_object()
        tickets_qs = Ticket.objects.filter(equipement=equipement)
        stats = self._construire_stats_resume(tickets_qs)
        derniers_tickets = self._serialiser_tickets_pour_llm(
            tickets_qs.order_by("-date_creation")[:NOMBRE_TICKETS_RESUME_IA]
        )

        try:
            resume = appeler_llm_texte(
                nom_equipement=equipement.nom,
                type_equipement=equipement.type_equipement or "équipement industriel",
                criticite=equipement.criticite or "moyenne",
                stats=stats,
                derniers_tickets=derniers_tickets,
            )
        except Exception as exc:
            logger.error("Erreur résumé IA équipement %s : %s", pk, exc)
            resume = self._resume_fallback(equipement, stats)

        return Response({"resume": resume})

    # ── Action : pannes par mois (avec paramètre optionnel annee) ────────────

    @action(detail=True, methods=["get"], url_path="pannes_par_mois")
    def pannes_par_mois(self, request, pk=None):
        """
        GET /api/equipements/{id}/pannes_par_mois/?annee=2024
        Sans paramètre → 12 mois glissants (rétrocompatible).
        Avec `annee` → 12 mois de l'année calendaire demandée.
        """
        equipement = self.get_object()
        today = date.today()
        annee_param = request.query_params.get("annee")

        if annee_param is not None:
            try:
                annee = int(annee_param)
            except ValueError:
                return Response({"detail": "L'année doit être un entier."}, status=400)

            start_date = date(annee, 1, 1)
            end_date = date(annee, 12, 31)

            qs = (
                Ticket.objects.filter(
                    equipement=equipement,
                    date_creation__date__gte=start_date,
                    date_creation__date__lte=end_date,
                )
                .annotate(month=TruncMonth("date_creation"))
                .values("month")
                .annotate(total=Count("id"))
                .order_by("month")
            )
            totals = {row["month"].strftime("%Y-%m"): row["total"] for row in qs}

            result = [
                {
                    "mois": f"{annee}-{str(m).zfill(2)}",
                    "label": _label_mois(date(annee, m, 1)),
                    "total": totals.get(f"{annee}-{str(m).zfill(2)}", 0),
                }
                for m in range(1, 13)
            ]
        else:
            start_month = today.month - 11
            start_year = today.year
            if start_month <= 0:
                start_month += 12
                start_year -= 1
            start_date = date(start_year, start_month, 1)

            qs = (
                Ticket.objects.filter(equipement=equipement, date_creation__date__gte=start_date)
                .annotate(month=TruncMonth("date_creation"))
                .values("month")
                .annotate(total=Count("id"))
                .order_by("month")
            )
            totals = {row["month"].strftime("%Y-%m"): row["total"] for row in qs}
            result = []
            current = start_date
            for _ in range(12):
                key = current.strftime("%Y-%m")
                result.append({"mois": key, "label": _label_mois(current), "total": totals.get(key, 0)})
                if current.month == 12:
                    current = current.replace(year=current.year + 1, month=1)
                else:
                    current = current.replace(month=current.month + 1)

        return Response(result)

    @action(detail=True, methods=["get"], url_path="interventions")
    def interventions(self, request, pk=None):
        from rest_framework.pagination import PageNumberPagination
        equipement = self.get_object()
        queryset = Ticket.objects.filter(equipement=equipement).select_related("technicien").order_by("-date_creation")
        filterset = InterventionFilter(request.query_params, queryset=queryset)
        if filterset.is_valid():
            queryset = filterset.qs
        paginator = PageNumberPagination()
        paginator.page_size = 10
        page = paginator.paginate_queryset(queryset, request)
        if page is not None:
            return paginator.get_paginated_response([self._serialiser_intervention(t) for t in page])
        return Response([self._serialiser_intervention(t) for t in queryset])

    @action(detail=True, methods=["get"], url_path="pieces_detail")
    def pieces_detail(self, request, pk=None):
        from rest_framework.pagination import PageNumberPagination
        from collections import Counter
        equipement = self.get_object()
        suggestions = SuggestionIA.objects.filter(
            ticket__equipement=equipement, acceptee=True, pieces_detachees__gt=""
        ).select_related("ticket", "technicien").order_by("-ticket__date_creation")

        pieces_list = []
        pieces_counter = Counter()
        for sugg in suggestions:
            for line in sugg.pieces_detachees.strip().split("\n"):
                piece = line.strip().lstrip("-•").strip()
                if not piece:
                    continue
                pieces_counter[piece] += 1
                pieces_list.append({
                    "date": sugg.ticket.date_creation,
                    "piece": piece,
                    "ticket_id": sugg.ticket.id,
                    "ticket_titre": sugg.ticket.titre,
                    "technicien_nom": (sugg.technicien.get_full_name().strip() or sugg.technicien.username) if sugg.technicien else None,
                })
        for item in pieces_list:
            item["nb_remplacements"] = pieces_counter[item["piece"]]

        paginator = PageNumberPagination()
        paginator.page_size = 10
        page = paginator.paginate_queryset(pieces_list, request)
        return paginator.get_paginated_response(page)

    # ── Helpers privés EquipementViewSet ─────────────────────────────────────

    @staticmethod
    def _calculer_mttr_equipement(tickets) -> float | None:
        resolus = tickets.filter(statut="resolu", date_resolution__isnull=False, date_creation__isnull=False)
        if not resolus.exists():
            return None
        total_secondes = sum((t.date_resolution - t.date_creation).total_seconds() for t in resolus)
        return round(total_secondes / resolus.count() / 3600, 1)

    @staticmethod
    def _extraire_pieces_remplacees(tickets) -> list[str]:
        suggestions = SuggestionIA.objects.filter(ticket__in=tickets, acceptee=True, pieces_detachees__gt="").values_list("pieces_detachees", flat=True)
        pieces = set()
        for bloc in suggestions:
            for ligne in bloc.splitlines():
                piece = ligne.strip().lstrip("-•").strip()
                if piece:
                    pieces.add(piece)
        return sorted(pieces)

    @staticmethod
    def _calculer_health_score(criticite: str, nombre_pannes: int, tickets_ouverts: int) -> int:
        penalite_criticite = {"critique": 40, "haute": 25, "moyenne": 15, "basse": 5}
        penalite_base = penalite_criticite.get(criticite, 15)
        penalite_pannes = min(nombre_pannes * 3, 40)
        penalite_ouverts = min(tickets_ouverts * 10, 20)
        return max(0, 100 - penalite_base - penalite_pannes - penalite_ouverts)

    def _serialiser_intervention(self, ticket) -> dict:
        duree_h = None
        if ticket.statut == "resolu" and ticket.date_resolution and ticket.date_creation:
            duree_h = round((ticket.date_resolution - ticket.date_creation).total_seconds() / 3600, 1)
        technicien_nom = None
        if ticket.technicien:
            technicien_nom = ticket.technicien.get_full_name().strip() or ticket.technicien.username
        return {
            "id": ticket.id,
            "titre": ticket.titre,
            "statut": ticket.statut,
            "priorite": ticket.priorite,
            "date_creation": ticket.date_creation,
            "date_resolution": ticket.date_resolution,
            "duree_resolution_h": duree_h,
            "notes_technicien": ticket.notes_technicien or "",
            "technicien_nom": technicien_nom,
        }

    @staticmethod
    def _construire_stats_resume(tickets_qs) -> dict:
        nombre_pannes = tickets_qs.count()
        tickets_ouverts = tickets_qs.filter(statut__in=["ouvert", "en_cours"]).count()
        tickets_resolus = tickets_qs.filter(statut="resolu").count()
        resolus_avec_dates = tickets_qs.filter(statut="resolu", date_resolution__isnull=False, date_creation__isnull=False)
        mttr_heures = None
        if resolus_avec_dates.exists():
            total_s = sum((t.date_resolution - t.date_creation).total_seconds() for t in resolus_avec_dates)
            mttr_heures = round(total_s / resolus_avec_dates.count() / 3600, 1)
        return {
            "nombre_pannes": nombre_pannes,
            "tickets_ouverts": tickets_ouverts,
            "tickets_resolus": tickets_resolus,
            "mttr_heures": mttr_heures,
        }

    @staticmethod
    def _serialiser_tickets_pour_llm(tickets_qs) -> list[dict]:
        return [
            {"id": t.id, "titre": t.titre, "statut": t.statut, "notes": (t.notes_technicien or "")[:80]}
            for t in tickets_qs
        ]

    @staticmethod
    def _resume_fallback(equipement, stats: dict) -> str:
        parties = [
            f"L'équipement {equipement.nom} ({equipement.type_equipement or 'industriel'}) "
            f"totalise {stats['nombre_pannes']} ticket(s) de maintenance enregistré(s)."
        ]
        if stats["tickets_ouverts"] > 0:
            parties.append(f"{stats['tickets_ouverts']} ticket(s) sont actuellement en cours de traitement.")
        else:
            parties.append("Aucun ticket ouvert n'est en cours de traitement.")
        if stats["mttr_heures"] is not None:
            parties.append(f"Le temps moyen de résolution est de {stats['mttr_heures']} heure(s).")
        parties.append("Le service d'analyse IA est temporairement indisponible ; ce résumé est généré à partir des données statistiques locales.")
        return " ".join(parties)


# ── 3. VIEWSET TICKET ─────────────────────────────────────────────────────────

class TicketViewSet(viewsets.ModelViewSet):
    """
    CRUD Tickets + actions : assigner, changer_statut, suggerer_ia, get_suggestions.
    """

    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_class = TicketFilter
    search_fields = ["titre", "description"]

    def get_queryset(self):
        user = self.request.user
        if user.role == "operateur":
            return Ticket.objects.filter(createur=user)
        if user.role == "technicien":
            return Ticket.objects.filter(Q(technicien=user) | Q(statut="ouvert", technicien__isnull=True))
        return Ticket.objects.all()

    def perform_create(self, serializer):
        equipement = serializer.validated_data["equipement"]
        priorite = calculer_priorite(
            criticite_equipement=equipement.criticite,
            titre=serializer.validated_data["titre"],
            description=serializer.validated_data["description"],
        )
        ticket = serializer.save(createur=self.request.user, priorite=priorite)
        ajouter_entree_historique(
            equipement=ticket.equipement,
            ticket_id=ticket.id,
            action="Ticket créé",
            detail=f"{ticket.titre} - Priorité {ticket.priorite}",
        )
        self._notifier_techniciens_nouveau_ticket(ticket)

    @action(detail=True, methods=["patch"], permission_classes=[IsTechnicien])
    def assigner(self, request, pk=None):
        ticket = self.get_object()
        if ticket.technicien:
            return Response({"detail": "Ce ticket est déjà assigné."}, status=status.HTTP_400_BAD_REQUEST)
        if ticket.statut != "ouvert":
            return Response({"detail": "Seuls les tickets ouverts peuvent être assignés."}, status=status.HTTP_400_BAD_REQUEST)
        ticket.technicien = request.user
        ticket.statut = "en_cours"
        ticket.date_debut_traitement = timezone.now()
        ticket.save()
        ajouter_entree_historique(
            equipement=ticket.equipement,
            ticket_id=ticket.id,
            action="Ticket assigné",
            detail=f"À {request.user.username}",
        )
        self._notifier_utilisateur(
            utilisateur=request.user,
            message=f"Vous avez été assigné au ticket #{ticket.id} : {ticket.titre}",
            ticket=ticket,
            lien=f"/tickets/{ticket.id}",
        )
        return Response(TicketSerializer(ticket).data)

    @action(detail=True, methods=["patch"], permission_classes=[IsTechnicien])
    def changer_statut(self, request, pk=None):
        ticket = self.get_object()
        if not self._utilisateur_peut_modifier(request.user, ticket):
            return Response({"detail": "Vous n'êtes pas assigné à ce ticket."}, status=status.HTTP_403_FORBIDDEN)
        nouveau_statut = request.data.get("statut")
        erreur = self._valider_transition(ticket.statut, nouveau_statut)
        if erreur:
            return Response({"detail": erreur}, status=status.HTTP_400_BAD_REQUEST)
        notes = request.data.get("notes_technicien", "")
        self._appliquer_changement_statut(ticket, nouveau_statut, notes)
        self._notifier_changement_statut(ticket, nouveau_statut)
        return Response(TicketSerializer(ticket).data)

    @action(detail=True, methods=["post"], url_path="suggerer_ia", permission_classes=[IsTechnicien])
    def suggerer_ia(self, request, pk=None):
        ticket = self.get_object()
        historique = self._recuperer_historique_tickets(ticket)
        reponse_llm = appeler_llm(
            type_equipement=ticket.equipement.type_equipement,
            modele_equipement=ticket.equipement.modele,
            description_symptomes=ticket.description,
            historique_tickets=historique,
        )
        suggestion = self._sauvegarder_suggestion(ticket, request.user, reponse_llm)
        return Response(SuggestionIASerializer(suggestion).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="suggestions", permission_classes=[IsAuthenticated])
    def get_suggestions(self, request, pk=None):
        ticket = self.get_object()
        suggestion = SuggestionIA.objects.filter(ticket=ticket).order_by("-date_creation").first()
        if not suggestion:
            return Response({"detail": "Aucune suggestion disponible."}, status=status.HTTP_404_NOT_FOUND)
        return Response(SuggestionIASerializer(suggestion).data)

    # ── Helpers privés TicketViewSet ─────────────────────────────────────────

    def _utilisateur_peut_modifier(self, user, ticket) -> bool:
        if user.role == "responsable":
            return True
        return ticket.technicien == user

    def _valider_transition(self, statut_actuel: str, nouveau_statut: str) -> str | None:
        if not nouveau_statut:
            return "Le champ 'statut' est obligatoire."
        transitions = TRANSITIONS_AUTORISEES.get(statut_actuel, [])
        if not transitions:
            return f"Le ticket est '{statut_actuel}' : aucune transition possible."
        if nouveau_statut not in transitions:
            return f"Transition interdite : '{statut_actuel}' → '{nouveau_statut}'. Transitions autorisées : {transitions}."
        return None

    def _appliquer_changement_statut(self, ticket, nouveau_statut: str, notes: str) -> None:
        ticket.statut = nouveau_statut
        ticket.notes_technicien = notes
        if nouveau_statut == "resolu":
            ticket.date_resolution = timezone.now()
        ticket.save()

    def _recuperer_historique_tickets(self, ticket_courant) -> list[dict]:
        tickets = Ticket.objects.filter(equipement=ticket_courant.equipement).exclude(id=ticket_courant.id).order_by("-date_creation")[:NOMBRE_TICKETS_HISTORIQUE]
        return [{"id": t.id, "titre": t.titre, "statut": t.statut} for t in tickets]

    def _sauvegarder_suggestion(self, ticket, technicien, reponse_llm: dict) -> SuggestionIA:
        return SuggestionIA.objects.create(
            ticket=ticket,
            technicien=technicien,
            cause_racine=reponse_llm.get("cause_racine", ""),
            liste_controle="\n".join(reponse_llm.get("liste_controle", [])),
            pieces_detachees="\n".join(reponse_llm.get("pieces_detachees", [])),
            confiance=reponse_llm.get("confiance", CONFIANCE_DEFAUT),
            modele_ia=MODELE_IA_NOM,
        )

    def _notifier_techniciens_nouveau_ticket(self, ticket) -> None:
        techniciens = Utilisateur.objects.filter(role="technicien", is_active=True)
        Notification.objects.bulk_create([
            Notification(utilisateur=tech, message=f"Nouveau ticket #{ticket.id} : {ticket.titre} – Priorité : {ticket.priorite}", ticket=ticket, lien=f"/tickets/{ticket.id}")
            for tech in techniciens
        ])

    def _notifier_changement_statut(self, ticket, nouveau_statut: str) -> None:
        if ticket.createur:
            self._notifier_utilisateur(
                utilisateur=ticket.createur,
                message=f"Le ticket #{ticket.id} « {ticket.titre} » est maintenant : {nouveau_statut.replace('_', ' ')}",
                ticket=ticket,
                lien=f"/tickets/{ticket.id}",
            )

    @staticmethod
    def _notifier_utilisateur(utilisateur, message: str, ticket, lien: str) -> None:
        Notification.objects.create(utilisateur=utilisateur, message=message, ticket=ticket, lien=lien)


# ── 4. VIEWSET SUGGESTION ─────────────────────────────────────────────────────

class SuggestionViewSet(viewsets.GenericViewSet):
    queryset = SuggestionIA.objects.all()
    serializer_class = SuggestionIASerializer
    permission_classes = [IsAuthenticated, IsTechnicien]

    @action(detail=True, methods=["patch"], url_path="feedback")
    def feedback(self, request, pk=None):
        suggestion = self.get_object()
        serializer = FeedbackSuggestionSerializer(suggestion, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(SuggestionIASerializer(suggestion).data)


# ── 5. VIEWSET NOTIFICATION ───────────────────────────────────────────────────

class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(utilisateur=self.request.user)

    @action(detail=True, methods=["patch"])
    def lire(self, request, pk=None):
        notification = self.get_object()
        notification.est_lue = True
        notification.save(update_fields=["est_lue"])
        return Response(NotificationSerializer(notification).data)


# ── 6. VIEWSET DASHBOARD ──────────────────────────────────────────────────────

class DashboardViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsResponsable]

    @action(detail=False, methods=["get"])
    def stats(self, request):
        return Response({
            **self._compter_tickets_par_statut(),
            "mttr_heures": self._calculer_mttr(),
            "top_equipements": list(self._top_equipements_en_panne()),
        })

    @action(detail=False, methods=["get"])
    def tickets_par_statut(self, request):
        return Response({
            label: Ticket.objects.filter(statut=statut).count()
            for statut, label in Ticket.STATUT_CHOICES
        })

    @action(detail=False, methods=["get"], url_path="stats_mensuelles")
    def stats_mensuelles(self, request):
        months = _build_rolling_12_months()
        start_date = months[0]

        crees_qs = (
            Ticket.objects.filter(date_creation__date__gte=start_date)
            .annotate(mois=TruncMonth("date_creation"))
            .values("mois")
            .annotate(total=Count("id"))
            .order_by("mois")
        )
        map_crees = {row["mois"].strftime("%Y-%m"): row["total"] for row in crees_qs}

        resolus_qs = (
            Ticket.objects.filter(statut="resolu", date_resolution__date__gte=start_date)
            .annotate(mois=TruncMonth("date_resolution"))
            .values("mois")
            .annotate(total=Count("id"))
            .order_by("mois")
        )
        map_resolus = {row["mois"].strftime("%Y-%m"): row["total"] for row in resolus_qs}

        result = []
        for d in months:
            key = d.strftime("%Y-%m")
            result.append({
                "mois": key,
                "label": _date_to_label(d),
                "tickets_crees": map_crees.get(key, 0),
                "tickets_resolus": map_resolus.get(key, 0),
            })
        return Response(result)

    @action(detail=False, methods=["get"], url_path="stats_par_statut")
    def stats_par_statut(self, request):
        # Récupérer le paramètre année
        annee = request.query_params.get("annee")
        
        # Filtrer les tickets par année si le paramètre est présent
        tickets = Ticket.objects.all()
        if annee and annee.isdigit():
            tickets = tickets.filter(date_creation__year=int(annee))
        
        # Compter par statut
        counts = tickets.values("statut").annotate(total=Count("id"))
        result = {row["statut"]: row["total"] for row in counts}
        
        # Ajouter les statuts avec 0 si absents
        for statut, _ in Ticket.STATUT_CHOICES:
            result.setdefault(statut, 0)
        
        return Response(result)

    @action(detail=False, methods=["get"], url_path="stats_par_mois")
    def stats_par_mois(self, request):
        mois_param = request.query_params.get("mois")
        if not mois_param:
            return Response({"detail": "Le paramètre 'mois' est obligatoire (format YYYY-MM)."}, status=400)
        try:
            annee, mois = map(int, mois_param.split("-"))
        except ValueError:
            return Response({"detail": "Format invalide. Utilisez YYYY-MM."}, status=400)

        debut = date(annee, mois, 1)
        if mois == 12:
            fin = date(annee + 1, 1, 1)
        else:
            fin = date(annee, mois + 1, 1)

        tickets = Ticket.objects.filter(date_creation__date__gte=debut, date_creation__date__lt=fin)
        total = tickets.count()
        ouverts = tickets.filter(statut="ouvert").count()
        en_cours = tickets.filter(statut="en_cours").count()
        attente_pieces = tickets.filter(statut="attente_pieces").count()
        resolus = tickets.filter(statut="resolu").count()

        tickets_resolus_mois = tickets.filter(statut="resolu", date_resolution__isnull=False, date_creation__isnull=False)
        mttr = None
        if tickets_resolus_mois.exists():
            total_seconds = sum((t.date_resolution - t.date_creation).total_seconds() for t in tickets_resolus_mois)
            mttr = round(total_seconds / tickets_resolus_mois.count() / 3600, 2)

        top_equipements = (
            tickets.values("equipement__id", "equipement__nom", "equipement__criticite")
            .annotate(total_tickets=Count("id"))
            .order_by("-total_tickets")[:5]
        )

        return Response({
            "mois": mois_param,
            "total_tickets": total,
            "tickets_ouverts": ouverts,
            "tickets_en_cours": en_cours,
            "tickets_attente_pieces": attente_pieces,
            "tickets_resolus": resolus,
            "mttr_heures": mttr,
            "top_equipements": list(top_equipements),
        })

    def _compter_tickets_par_statut(self) -> dict:
        return {
            "tickets_ouverts": Ticket.objects.filter(statut="ouvert").count(),
            "tickets_en_cours": Ticket.objects.filter(statut="en_cours").count(),
            "tickets_attente_pieces": Ticket.objects.filter(statut="attente_pieces").count(),
            "tickets_resolus": Ticket.objects.filter(statut="resolu").count(),
            "total_tickets": Ticket.objects.count(),
        }

    def _calculer_mttr(self) -> float | None:
        tickets = Ticket.objects.filter(statut="resolu", date_resolution__isnull=False, date_creation__isnull=False)
        if not tickets.exists():
            return None
        total = sum((t.date_resolution - t.date_creation).total_seconds() / 3600 for t in tickets)
        return round(total / tickets.count(), 2)

    def _top_equipements_en_panne(self):
        return (
            Ticket.objects.values("equipement__id", "equipement__nom", "equipement__criticite")
            .annotate(total_tickets=Count("id"))
            .order_by("-total_tickets")[:5]
        )