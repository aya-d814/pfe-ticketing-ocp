from decimal import Decimal

from django.db import models
from django.contrib.auth.models import AbstractUser

# ============================================================
# 1. MODÈLE UTILISATEUR (avec rôles)
# ============================================================
class Utilisateur(AbstractUser):
    ROLE_CHOICES = [
        ('operateur', 'Opérateur'),
        ('technicien', 'Technicien'),
        ('responsable', 'Responsable'),
    ]
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='operateur')
    
    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"
    
    class Meta:
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"


# ============================================================
# 2. MODÈLE ÉQUIPEMENT
# ============================================================
class Equipement(models.Model):
    CRITICITE_CHOICES = [
        ('basse', 'Basse'),
        ('moyenne', 'Moyenne'),
        ('haute', 'Haute'),
        ('critique', 'Critique'),
    ]
    
    nom = models.CharField(max_length=100)
    type_equipement = models.CharField(max_length=100)
    modele = models.CharField(max_length=100, blank=True)
    localisation = models.CharField(max_length=200)
    criticite = models.CharField(max_length=20, choices=CRITICITE_CHOICES, default='moyenne')
    historique = models.TextField(blank=True)
    date_installation = models.DateField(null=True, blank=True)
    fabricant = models.CharField(max_length=100, blank=True)
    
    def __str__(self):
        return f"{self.nom} ({self.type_equipement})"
    
    class Meta:
        verbose_name = "Équipement"
        verbose_name_plural = "Équipements"


# ============================================================
# 3. MODÈLE TICKET
# ============================================================
class Ticket(models.Model):
    STATUT_CHOICES = [
        ('ouvert', 'Ouvert'),
        ('en_cours', 'En cours'),
        ('attente_pieces', 'En attente de pièces'),
        ('resolu', 'Résolu'),
    ]
    
    PRIORITE_CHOICES = [
        ('basse', 'Basse'),
        ('moyenne', 'Moyenne'),
        ('haute', 'Haute'),
        ('urgente', 'Urgente'),
    ]
    
    titre = models.CharField(max_length=200)
    description = models.TextField()
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='ouvert')
    priorite = models.CharField(max_length=20, choices=PRIORITE_CHOICES, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_debut_traitement = models.DateTimeField(null=True, blank=True)
    date_resolution = models.DateTimeField(null=True, blank=True)
    notes_technicien = models.TextField(blank=True)
    
    createur = models.ForeignKey(Utilisateur, on_delete=models.CASCADE, related_name='tickets_crees')
    technicien = models.ForeignKey(Utilisateur, on_delete=models.SET_NULL, null=True, blank=True, related_name='tickets_assignes')
    equipement = models.ForeignKey(Equipement, on_delete=models.CASCADE, related_name='tickets')
    
    def __str__(self):
        return f"Ticket #{self.id} - {self.titre}"
    
    class Meta:
        verbose_name = "Ticket"
        verbose_name_plural = "Tickets"
        ordering = ['-date_creation']


# ============================================================
# 4. MODÈLE SUGGESTION IA
# ============================================================
class SuggestionIA(models.Model):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='suggestions')
    technicien = models.ForeignKey(Utilisateur, on_delete=models.SET_NULL, null=True, related_name='suggestions')
    
    cause_racine = models.TextField()
    liste_controle = models.TextField()
    pieces_detachees = models.TextField(blank=True)
    confiance = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal('0.00'))
    
    acceptee = models.BooleanField(default=False)
    modifiee = models.BooleanField(default=False)
    commentaire_technicien = models.TextField(blank=True)
    
    date_creation = models.DateTimeField(auto_now_add=True)
    modele_ia = models.CharField(max_length=50, blank=True, default='gemini-2.5-flash')
    
    def __str__(self):
        return f"Suggestion pour ticket #{self.ticket.id}"
    
    class Meta:
        verbose_name = "Suggestion IA"
        verbose_name_plural = "Suggestions IA"
        ordering = ['-date_creation']


# ============================================================
# 5. MODÈLE NOTIFICATION
# ============================================================
class Notification(models.Model):
    utilisateur = models.ForeignKey(Utilisateur, on_delete=models.CASCADE, related_name='notifications')
    message = models.TextField()
    est_lue = models.BooleanField(default=False)
    date_creation = models.DateTimeField(auto_now_add=True)
    lien = models.CharField(max_length=200, blank=True)
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, null=True, blank=True)
    
    def __str__(self):
        return f"Notification pour {self.utilisateur.username}"
    
    class Meta:
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"
        ordering = ['-date_creation']