"""
tickets/tests_api.py
====================
Suite de tests API pour le système de gestion des tickets OCP.

Organisation :
  - AuthTests            : inscription, login, accès protégé
  - PermissionsTests     : vérification des droits par rôle
  - TicketWorkflowTests  : assignation, transitions de statut
  - PrioriteTests        : calcul automatique de la priorité

Conventions (Clean Code) :
  - Nommage : test_[action]_[résultat_attendu]
  - Un seul concept par test
  - Données créées localement dans chaque test ou setUp
  - Pas d'URLs en dur → reverse()
"""

from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from .models import Equipement, Ticket

# DEBUG - Vérification des URLs
from django.urls import reverse
print("=== DEBUG URLs ===")
print("ticket-changer-statut:", reverse('ticket-changer-statut', kwargs={'pk': 1}))
print("ticket-assigner:", reverse('ticket-assigner', kwargs={'pk': 1}))
print("=================")

Utilisateur = get_user_model()


# ============================================================
# HELPERS PARTAGÉS
# ============================================================

def creer_utilisateur(username: str, password: str, role: str) -> Utilisateur:
    """Crée et retourne un utilisateur actif avec le rôle donné."""
    return Utilisateur.objects.create_user(
        username=username,
        password=password,
        role=role,
        email=f"{username}@ocp.ma",
    )


def creer_equipement(criticite: str = "moyenne") -> Equipement:
    """Crée et retourne un équipement de test."""
    return Equipement.objects.create(
        nom="Pompe Test",
        type_equipement="Pompe hydraulique",
        localisation="Atelier A",
        criticite=criticite,
    )


def creer_ticket(createur: Utilisateur, equipement: Equipement, **kwargs) -> Ticket:
    """Crée et retourne un ticket de test avec les valeurs par défaut."""
    defaults = {
        "titre": "Ticket de test",
        "description": "Description de test",
        "statut": "ouvert",
        "priorite": "moyenne",
    }
    defaults.update(kwargs)
    return Ticket.objects.create(createur=createur, equipement=equipement, **defaults)


# ============================================================
# 1. TESTS D'AUTHENTIFICATION
# ============================================================

class AuthTests(APITestCase):
    """Tests des endpoints d'authentification JWT."""

    def test_register_user_success(self):
        url = reverse("register")
        data = {
            "username": "nouvel_operateur",
            "email": "op@ocp.ma",
            "password": "MotDePasse123!",
            "password_confirm": "MotDePasse123!",
            "role": "operateur",
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["username"], "nouvel_operateur")
        self.assertEqual(response.data["role"], "operateur")

    def test_register_user_password_mismatch(self):
        url = reverse("register")
        data = {
            "username": "user2",
            "email": "user2@ocp.ma",
            "password": "MotDePasse123!",
            "password_confirm": "MotDePasseDifferent!",
            "role": "operateur",
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password_confirm", response.data)

    def test_login_success(self):
        creer_utilisateur("tech1", "MotDePasse123!", "technicien")
        url = reverse("token_obtain_pair")
        response = self.client.post(url, {"username": "tech1", "password": "MotDePasse123!"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_login_invalid_credentials(self):
        url = reverse("token_obtain_pair")
        response = self.client.post(url, {"username": "fantome", "password": "mauvais"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_access_protected_endpoint_without_token(self):
        url = reverse("ticket-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


# ============================================================
# 2. TESTS DE PERMISSIONS PAR RÔLE
# ============================================================

class PermissionsTests(APITestCase):
    """Vérifie que chaque rôle accède uniquement à ce qui lui est autorisé."""

    def setUp(self):
        self.operateur = creer_utilisateur("op1", "Pass123!", "operateur")
        self.technicien = creer_utilisateur("tech1", "Pass123!", "technicien")
        self.responsable = creer_utilisateur("resp1", "Pass123!", "responsable")
        self.equipement = creer_equipement()

    # --- Création de ticket ---

    def test_operateur_peut_creer_ticket(self):
        self.client.force_authenticate(user=self.operateur)
        url = reverse("ticket-list")
        data = {
            "titre": "Panne pompe",
            "description": "La pompe ne démarre plus.",
            "equipement_id": self.equipement.id,
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_technicien_peut_creer_ticket(self):
        """Un technicien doit pouvoir créer un ticket (accès général authentifié)."""
        self.client.force_authenticate(user=self.technicien)
        url = reverse("ticket-list")
        data = {
            "titre": "Anomalie détectée",
            "description": "Bruit anormal sur moteur.",
            "equipement_id": self.equipement.id,
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    # --- Accès dashboard ---

    def test_responsable_peut_voir_dashboard(self):
        self.client.force_authenticate(user=self.responsable)
        url = reverse("dashboard-stats")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_operateur_ne_peut_pas_voir_dashboard(self):
        self.client.force_authenticate(user=self.operateur)
        url = reverse("dashboard-stats")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_technicien_ne_peut_pas_voir_dashboard(self):
        self.client.force_authenticate(user=self.technicien)
        url = reverse("dashboard-stats")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # --- Visibilité des tickets ---

    def test_responsable_voit_tous_les_tickets(self):
        op2 = creer_utilisateur("op2", "Pass123!", "operateur")
        creer_ticket(self.operateur, self.equipement, titre="Ticket OP1")
        creer_ticket(op2, self.equipement, titre="Ticket OP2")

        self.client.force_authenticate(user=self.responsable)
        url = reverse("ticket-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data["count"], 2)

    def test_operateur_voit_uniquement_ses_tickets(self):
        op2 = creer_utilisateur("op2b", "Pass123!", "operateur")
        creer_ticket(self.operateur, self.equipement, titre="Mon ticket")
        creer_ticket(op2, self.equipement, titre="Ticket d'un autre")

        self.client.force_authenticate(user=self.operateur)
        url = reverse("ticket-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titres = [t["titre"] for t in response.data["results"]]
        self.assertIn("Mon ticket", titres)
        self.assertNotIn("Ticket d'un autre", titres)

    # --- Changement de statut ---

    def test_technicien_peut_changer_statut_si_assigne(self):
        ticket = creer_ticket(self.operateur, self.equipement, statut="en_cours")
        ticket.technicien = self.technicien
        ticket.save()

        self.client.force_authenticate(user=self.technicien)
        url = reverse("ticket-changer-statut", kwargs={"pk": ticket.pk})
        response = self.client.patch(url, {"statut": "attente_pieces"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_technicien_ne_peut_pas_changer_statut_si_non_assigne(self):
        # Créer un ticket ouvert SANS technicien assigné
        ticket = creer_ticket(self.operateur, self.equipement, statut="ouvert")
        ticket.save()

        print(f"DEBUG: Ticket ID = {ticket.pk}")

        self.client.force_authenticate(user=self.technicien)
        url = reverse("ticket-changer-statut", kwargs={"pk": ticket.pk})

        print(f"DEBUG: URL = {url}")

        response = self.client.patch(url, {"statut": "attente_pieces"}, format="json")

        print(f"DEBUG: Status = {response.status_code}")
        
        # Le technicien n'est PAS assigné → doit retourner 403
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ============================================================
# 3. TESTS WORKFLOW TICKETS
# ============================================================

class TicketWorkflowTests(APITestCase):
    """Tests du cycle de vie complet des tickets."""

    def setUp(self):
        self.operateur = creer_utilisateur("op_wf", "Pass123!", "operateur")
        self.technicien = creer_utilisateur("tech_wf", "Pass123!", "technicien")
        self.equipement = creer_equipement()

    # --- Assignation ---

    def test_assigner_ticket_succes(self):
        ticket = creer_ticket(self.operateur, self.equipement, statut="ouvert")

        self.client.force_authenticate(user=self.technicien)
        url = reverse("ticket-assigner", kwargs={"pk": ticket.pk})
        response = self.client.patch(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["statut"], "en_cours")
        self.assertIsNotNone(response.data["technicien"])

    def test_assigner_ticket_deja_assigne_echoue(self):
        # Un ticket deja assigné ne peut pas être réassigné
        ticket = creer_ticket(self.operateur, self.equipement, statut="en_cours")
        ticket.technicien = self.technicien  # Assigné au même technicien
        ticket.save()
        
        self.client.force_authenticate(user=self.technicien)
        url = reverse("ticket-assigner", kwargs={"pk": ticket.pk})
        response = self.client.patch(url)
        
        # Déjà assigné au même technicien → 400
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # --- Transitions valides ---

    def test_transition_valide_ouvert_vers_en_cours(self):
        ticket = creer_ticket(self.operateur, self.equipement, statut="ouvert")
        ticket.technicien = self.technicien
        ticket.save()

        self.client.force_authenticate(user=self.technicien)
        url = reverse("ticket-changer-statut", kwargs={"pk": ticket.pk})
        response = self.client.patch(url, {"statut": "en_cours"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["statut"], "en_cours")

    def test_transition_valide_en_cours_vers_attente_pieces(self):
        ticket = creer_ticket(
            self.operateur, self.equipement, statut="en_cours", technicien=self.technicien
        )

        self.client.force_authenticate(user=self.technicien)
        url = reverse("ticket-changer-statut", kwargs={"pk": ticket.pk})
        response = self.client.patch(url, {"statut": "attente_pieces"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["statut"], "attente_pieces")

    def test_transition_valide_attente_pieces_vers_resolu(self):
        ticket = creer_ticket(
            self.operateur, self.equipement, statut="attente_pieces", technicien=self.technicien
        )

        self.client.force_authenticate(user=self.technicien)
        url = reverse("ticket-changer-statut", kwargs={"pk": ticket.pk})
        response = self.client.patch(url, {"statut": "resolu"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["statut"], "resolu")
        self.assertIsNotNone(response.data["date_resolution"])

    # --- Transition invalide ---

    def test_transition_invalide_ouvert_vers_resolu(self):
        ticket = creer_ticket(self.operateur, self.equipement, statut="ouvert")
        ticket.technicien = self.technicien
        ticket.save()

        self.client.force_authenticate(user=self.technicien)
        url = reverse("ticket-changer-statut", kwargs={"pk": ticket.pk})
        response = self.client.patch(url, {"statut": "resolu"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Transition interdite", response.data["detail"])

    def test_aucune_transition_depuis_statut_resolu(self):
        ticket = creer_ticket(
            self.operateur, self.equipement, statut="resolu", technicien=self.technicien
        )

        self.client.force_authenticate(user=self.technicien)
        url = reverse("ticket-changer-statut", kwargs={"pk": ticket.pk})
        response = self.client.patch(url, {"statut": "en_cours"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ============================================================
# 4. TESTS CALCUL AUTOMATIQUE DE PRIORITÉ
# ============================================================

class PrioriteTests(APITestCase):
    """Vérifie que la priorité est calculée automatiquement et non modifiable."""

    def setUp(self):
        self.operateur = creer_utilisateur("op_prio", "Pass123!", "operateur")
        self.client.force_authenticate(user=self.operateur)
        self.url = reverse("ticket-list")

    def _creer_ticket_via_api(self, criticite: str, titre: str, description: str) -> dict:
        """Helper : crée un équipement avec la criticité donnée et soumet un ticket."""
        equipement = creer_equipement(criticite=criticite)
        data = {
            "titre": titre,
            "description": description,
            "equipement_id": equipement.id,
        }
        return self.client.post(self.url, data)

    def test_priorite_calculee_depuis_criticite_haute(self):
        response = self._creer_ticket_via_api(
            criticite="haute",
            titre="Vérification moteur",
            description="Contrôle de routine.",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["priorite"], "haute")

    def test_priorite_calculee_depuis_criticite_basse(self):
        response = self._creer_ticket_via_api(
            criticite="basse",
            titre="Nettoyage filtre",
            description="Entretien préventif planifié.",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["priorite"], "basse")

    def test_priorite_elevee_avec_mot_cle_urgence(self):
        """Criticité 'haute' + mot-clé 'fuite' → priorité élevée à 'urgente'."""
        response = self._creer_ticket_via_api(
            criticite="haute",
            titre="Fuite détectée sur pompe P12",
            description="Fuite d'huile importante.",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["priorite"], "urgente")

    def test_priorite_elevee_avec_mot_cle_dans_description(self):
        """Mot-clé urgent dans la description doit aussi déclencher l'élévation."""
        response = self._creer_ticket_via_api(
            criticite="moyenne",
            titre="Problème moteur",
            description="Arrêt complet de la ligne de production.",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["priorite"], "haute")

    def test_priorite_non_modifiable_manuellement(self):
        """La valeur 'priorite' envoyée par le client doit être ignorée."""
        equipement = creer_equipement(criticite="basse")
        data = {
            "titre": "Test priorité forcée",
            "description": "Description normale.",
            "equipement_id": equipement.id,
            "priorite": "urgente",   # valeur forcée par le client
        }
        response = self.client.post(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Doit être "basse" (calculée) et non "urgente" (envoyée)
        self.assertEqual(response.data["priorite"], "basse")

    def test_criticite_critique_donne_priorite_urgente(self):
        response = self._creer_ticket_via_api(
            criticite="critique",
            titre="Panne système",
            description="Le système ne répond plus.",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["priorite"], "urgente")
