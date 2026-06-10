"""
tickets/urls.py
===============
Routes API pour l'application tickets.

Pas d'endpoint d'inscription publique : la création des comptes est
réservée à l'administrateur Django (interface /admin/).
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'api/utilisateurs', views.UtilisateurViewSet)
router.register(r'api/equipements',  views.EquipementViewSet)
router.register(r'api/tickets',      views.TicketViewSet)
router.register(r'api/dashboard',    views.DashboardViewSet, basename='dashboard')
router.register(r'api/suggestions', views.SuggestionViewSet, basename='suggestion')
router.register(r'api/notifications', views.NotificationViewSet, basename='notification')

urlpatterns = [
    path('', include(router.urls)),
]
