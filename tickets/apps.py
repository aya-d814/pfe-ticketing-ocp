"""
tickets/apps.py
===============
Configuration de l'application Django 'tickets'.

La méthode `ready()` est appelée une seule fois par Django au démarrage,
après que tous les modèles sont chargés. C'est le seul endroit sûr pour
importer les signaux : importer signals.py plus tôt provoquerait des erreurs
car les modèles ne seraient pas encore disponibles.
"""

from django.apps import AppConfig


class TicketsConfig(AppConfig):
    name = "tickets"

    def ready(self):
        # L'import déclenche la connexion des receivers @receiver(pre_save/post_save)
        # définis dans signals.py aux signaux Django correspondants.
        import tickets.signals  # noqa: F401