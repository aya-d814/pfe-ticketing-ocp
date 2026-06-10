"""
tickets/serializers.py
======================
Serializers DRF du module tickets.

Règles métier :
  - CustomTokenObtainPairSerializer : authentification par email uniquement.
  - TicketSerializer : 'priorite' est read_only (calculée automatiquement).
  - SuggestionIASerializer : feedback partiel autorisé via FeedbackSuggestionSerializer.
  - NotificationSerializer : marquer comme lue via champ partiel.
"""

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework import serializers

from django.contrib.auth import authenticate

from .models import Utilisateur, Equipement, Ticket, SuggestionIA, Notification


# ============================================================
# JWT PERSONNALISÉ — authentification par email
# ============================================================

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Remplace le mécanisme d'authentification de SimpleJWT pour accepter
    un email à la place du username.
    """

    username_field = "email"

    def validate(self, attrs: dict) -> dict:
        email: str = attrs.get("email", "").strip().lower()
        password: str = attrs.get("password", "")

        user = authenticate(
            request=self.context.get("request"),
            username=email,
            password=password,
        )

        if user is None:
            raise serializers.ValidationError(
                "Identifiants incorrects ou compte inactif."
            )

        refresh = RefreshToken.for_user(user)
        self._inject_custom_claims(refresh, user)

        return {
            "refresh": str(refresh),
            "access":  str(refresh.access_token),
        }

    @staticmethod
    def _inject_custom_claims(refresh: RefreshToken, user: Utilisateur) -> None:
        """Ajoute les claims métier dans le payload du token."""
        refresh["role"]     = user.role
        refresh["username"] = user.username
        refresh["email"]    = user.email

    @classmethod
    def get_token(cls, user: Utilisateur) -> RefreshToken:
        token = super().get_token(user)
        cls._inject_custom_claims(token, user)
        return token


# ============================================================
# SERIALIZERS DES MODÈLES
# ============================================================

class UtilisateurSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Utilisateur
        fields = ["id", "username", "email", "role",
                  "first_name", "last_name", "date_joined", "is_active"]
        read_only_fields = ["id", "date_joined"]


class EquipementSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Equipement
        fields = "__all__"


class TicketSerializer(serializers.ModelSerializer):
    """
    Serializer principal des tickets.
    - 'priorite' est read_only : calculée dans perform_create.
    - FK retournées en lecture sous forme d'objets imbriqués.
    - FK acceptées en écriture via les champs *_id.
    """

    createur   = UtilisateurSerializer(read_only=True)
    technicien = UtilisateurSerializer(read_only=True)
    equipement = EquipementSerializer(read_only=True)

    createur_id = serializers.PrimaryKeyRelatedField(
        queryset=Utilisateur.objects.all(),
        source="createur",
        write_only=True,
        required=False,
    )
    technicien_id = serializers.PrimaryKeyRelatedField(
        queryset=Utilisateur.objects.all(),
        source="technicien",
        write_only=True,
        required=False,
        allow_null=True,
    )
    equipement_id = serializers.PrimaryKeyRelatedField(
        queryset=Equipement.objects.all(),
        source="equipement",
        write_only=True,
    )

    class Meta:
        model  = Ticket
        fields = "__all__"
        read_only_fields = [
            "id",
            "date_creation",
            "date_debut_traitement",
            "date_resolution",
            "priorite",
        ]


class SuggestionIASerializer(serializers.ModelSerializer):
    """Lecture complète d'une suggestion IA."""

    class Meta:
        model  = SuggestionIA
        fields = "__all__"
        read_only_fields = ["id", "date_creation", "ticket", "technicien", "modele_ia"]


class FeedbackSuggestionSerializer(serializers.ModelSerializer):
    """
    Mise à jour partielle d'une suggestion IA par le technicien.
    Seuls les champs de feedback sont modifiables.
    """

    class Meta:
        model  = SuggestionIA
        fields = ["acceptee", "modifiee", "commentaire_technicien"]


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Notification
        fields = "__all__"
        read_only_fields = ["id", "date_creation", "utilisateur", "message", "ticket", "lien"]
