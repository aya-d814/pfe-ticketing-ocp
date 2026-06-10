from django.contrib import admin

from django.contrib import admin
from .models import Utilisateur, Equipement, Ticket, SuggestionIA, Notification

# ============================================================
# 1. ADMIN UTILISATEUR
# ============================================================
@admin.register(Utilisateur)
class UtilisateurAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'role', 'date_joined', 'is_active')
    list_filter = ('role', 'is_active')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    ordering = ('-date_joined',)
    fieldsets = (
        ('Informations personnelles', {
            'fields': ('username', 'email', 'first_name', 'last_name', 'role')
        }),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser')
        }),
        ('Dates', {
            'fields': ('date_joined', 'last_login')
        }),
    )


# ============================================================
# 2. ADMIN ÉQUIPEMENT
# ============================================================
@admin.register(Equipement)
class EquipementAdmin(admin.ModelAdmin):
    list_display = ('nom', 'type_equipement', 'localisation', 'criticite', 'date_installation')
    list_filter = ('type_equipement', 'criticite')
    search_fields = ('nom', 'type_equipement', 'localisation', 'fabricant')
    ordering = ('nom',)


# ============================================================
# 3. ADMIN TICKET
# ============================================================
@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ('id', 'titre', 'statut', 'priorite', 'date_creation', 'createur', 'technicien', 'equipement')
    list_filter = ('statut', 'priorite', 'date_creation')
    search_fields = ('titre', 'description', 'notes_technicien')
    readonly_fields = ('date_creation',)
    ordering = ('-date_creation',)
    autocomplete_fields = ('createur', 'technicien', 'equipement')
    
    fieldsets = (
        ('Informations principales', {
            'fields': ('titre', 'description', 'equipement')
        }),
        ('Assignation', {
            'fields': ('createur', 'technicien')
        }),
        ('Statut et priorité', {
            'fields': ('statut', 'priorite')
        }),
        ('Dates', {
            'fields': ('date_creation', 'date_debut_traitement', 'date_resolution')
        }),
        ('Notes', {
            'fields': ('notes_technicien',)
        }),
    )


# ============================================================
# 4. ADMIN SUGGESTION IA
# ============================================================
@admin.register(SuggestionIA)
class SuggestionIAAdmin(admin.ModelAdmin):
    list_display = ('id', 'ticket', 'acceptee', 'confiance', 'date_creation')
    list_filter = ('acceptee', 'modifiee', 'date_creation')
    search_fields = ('cause_racine', 'liste_controle', 'pieces_detachees')
    readonly_fields = ('date_creation',)
    ordering = ('-date_creation',)


# ============================================================
# 5. ADMIN NOTIFICATION
# ============================================================
@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('id', 'utilisateur', 'message_court', 'est_lue', 'date_creation')
    list_filter = ('est_lue', 'date_creation')
    search_fields = ('message',)
    readonly_fields = ('date_creation',)
    ordering = ('-date_creation',)
    
    def message_court(self, obj):
        """Affiche les 50 premiers caractères du message"""
        return obj.message[:50] + "..." if len(obj.message) > 50 else obj.message
    message_court.short_description = "Message"