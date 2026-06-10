"""
tickets/authentication.py
=========================
Backend d'authentification personnalisé pour le système de tickets.

Stratégie supportée :
  - EmailAuthBackend : login via adresse e-mail + password

Référencé dans settings.py → AUTHENTICATION_BACKENDS.
"""

from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

UserModel = get_user_model()


class EmailAuthBackend(ModelBackend):
    """
    Backend : authentification par email + password uniquement.

    Hérite de ModelBackend pour bénéficier des vérifications
    is_active, has_perm, etc. sans les réécrire.
    """

    def authenticate(self, request, username: str = None, password: str = None, **kwargs):
        """
        Tente d'authentifier un utilisateur par son adresse e-mail.

        Args:
            request: Objet HttpRequest Django.
            username: Email saisi par l'utilisateur.
            password: Mot de passe en clair.

        Returns:
            Instance Utilisateur si les identifiants sont valides et le
            compte actif, None sinon.
        """
        if not username or not password:
            return None

        email_normalized = username.strip().lower()

        try:
            user = UserModel.objects.get(email=email_normalized)
        except UserModel.DoesNotExist:
            # Appel à set_password fictif pour mitiger les timing attacks
            UserModel().set_password(password)
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user

        return None

    def get_user(self, user_id: int):
        """
        Récupère un utilisateur par sa PK (requis par Django pour les sessions).

        Args:
            user_id: Clé primaire de l'utilisateur.

        Returns:
            Instance Utilisateur ou None.
        """
        try:
            return UserModel.objects.get(pk=user_id)
        except UserModel.DoesNotExist:
            return None