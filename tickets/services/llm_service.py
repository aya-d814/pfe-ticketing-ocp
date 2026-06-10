"""
tickets/services/llm_service.py
================================
Service LLM — appelle l'API Gemini (gemini-2.5-flash).

Stratégie de rotation de clés :
  1. Tente GEMINI_API_KEY (clé principale).
  2. Sur quota dépassé (429 / RESOURCE_EXHAUSTED) ou clé invalide,
     bascule automatiquement sur GEMINI_API_KEY_2.
  3. Si les deux clés échouent, active le fallback.

Points d'entrée publics :
  - appeler_llm()       → dict  (diagnostic JSON structuré, usage ticket)
  - appeler_llm_texte() → str   (texte brut, usage résumé équipement)
"""

import json
import logging
import os
from typing import Optional

import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted, PermissionDenied

logger = logging.getLogger(__name__)

# ── Constantes ────────────────────────────────────────────────────────────────
_MODELE_GEMINI    = "gemini-2.5-flash"
_TIMEOUT_SECONDES = 30

# Exceptions déclenchant la rotation vers la clé suivante
_ERREURS_QUOTA = (ResourceExhausted, PermissionDenied)


# ── Lecture des clés ──────────────────────────────────────────────────────────

def _lire_cles_api() -> list[tuple[str, str]]:
    """
    Retourne les clés Gemini disponibles, dans l'ordre de priorité.

    Returns:
        Liste de tuples (nom_variable, valeur_api_key).
        Seules les clés non vides sont incluses.
    """
    candidats = [
        ("GEMINI_API_KEY",   os.getenv("GEMINI_API_KEY",   "").strip()),
        ("GEMINI_API_KEY_2", os.getenv("GEMINI_API_KEY_2", "").strip()),
    ]
    return [(nom, valeur) for nom, valeur in candidats if valeur]


# ── Construction des prompts ──────────────────────────────────────────────────

def _construire_prompt_diagnostic(
    type_equipement: str,
    modele_equipement: str,
    description_symptomes: str,
    historique_tickets: list[dict],
) -> str:
    """
    Construit le prompt de diagnostic JSON envoyé à Gemini (usage ticket).

    Args:
        type_equipement: Type de l'équipement (ex : pompe, compresseur).
        modele_equipement: Modèle de l'équipement.
        description_symptomes: Description libre saisie par l'opérateur.
        historique_tickets: Liste des 3 derniers tickets du même équipement.

    Returns:
        Chaîne formatée prête à être envoyée au LLM.
    """
    if historique_tickets:
        lignes = "\n".join(
            f"  - Ticket #{t['id']} ({t['statut']}) : {t['titre']}"
            for t in historique_tickets
        )
        bloc_historique = f"Historique des derniers tickets :\n{lignes}"
    else:
        bloc_historique = "Aucun ticket précédent pour cet équipement."

    return (
        "Tu es un expert en maintenance industrielle. "
        "Réponds UNIQUEMENT en JSON valide, sans markdown ni texte supplémentaire.\n\n"
        f"Équipement : {type_equipement} – Modèle : {modele_equipement or 'non précisé'}\n"
        f"Symptômes décrits : {description_symptomes}\n"
        f"{bloc_historique}\n\n"
        "Fournis un diagnostic structuré avec exactement ces clés JSON :\n"
        "{\n"
        '  "cause_racine": "string",\n'
        '  "liste_controle": ["étape 1", "étape 2", ...],\n'
        '  "pieces_detachees": ["pièce 1", "pièce 2", ...],\n'
        '  "confiance": 0.XX\n'
        "}"
    )


def _construire_prompt_resume(
    nom_equipement: str,
    type_equipement: str,
    criticite: str,
    stats: dict,
    derniers_tickets: list[dict],
) -> str:
    """
    Construit le prompt de résumé analytique (texte libre, sans JSON).

    Le prompt est volontairement factuel : aucune recommandation n'est
    demandée, Gemini doit synthétiser uniquement les données fournies.

    Args:
        nom_equipement: Nom de l'équipement.
        type_equipement: Type (pompe, compresseur, etc.).
        criticite: Niveau de criticité de l'équipement.
        stats: Dictionnaire de statistiques agrégées (pannes, MTTR, etc.).
        derniers_tickets: Liste des 30 derniers tickets (id, titre, statut, notes).

    Returns:
        Prompt complet prêt à être envoyé au LLM.
    """
    bloc_tickets = "Aucun ticket enregistré."
    if derniers_tickets:
        lignes = "\n".join(
            f"  - #{t['id']} [{t['statut']}] {t['titre']}"
            + (f" | Notes : {t['notes'][:80]}…" if t.get("notes") else "")
            for t in derniers_tickets
        )
        bloc_tickets = f"30 derniers tickets :\n{lignes}"

    return (
        "Tu es un ingénieur de maintenance industrielle senior.\n"
        "Rédige un résumé analytique factuel et concis (5 à 8 phrases maximum) "
        "sur l'historique de maintenance de l'équipement suivant. "
        "Base-toi UNIQUEMENT sur les données fournies. "
        "N'émets aucune recommandation. Utilise un ton professionnel et technique.\n\n"
        f"Équipement : {nom_equipement} ({type_equipement})\n"
        f"Criticité : {criticite}\n"
        f"Total pannes : {stats.get('nombre_pannes', 0)}\n"
        f"Tickets ouverts : {stats.get('tickets_ouverts', 0)}\n"
        f"Tickets résolus : {stats.get('tickets_resolus', 0)}\n"
        f"MTTR moyen : {stats.get('mttr_heures', 'non calculé')} heures\n\n"
        f"{bloc_tickets}"
    )


# ── Parsing de la réponse JSON ────────────────────────────────────────────────

def _parser_reponse_json(texte_brut: str) -> dict:
    """
    Extrait et valide le JSON depuis le texte brut de Gemini.
    Retire les balises markdown éventuelles (``` json ```).

    Args:
        texte_brut: Texte brut retourné par l'API.

    Returns:
        Dictionnaire validé avec les 4 clés requises.

    Raises:
        ValueError: Si le JSON est invalide ou des clés sont manquantes.
    """
    texte = texte_brut.strip()
    if texte.startswith("```"):
        texte = texte.split("```")[1]
        if texte.startswith("json"):
            texte = texte[4:]
    texte = texte.strip()

    try:
        donnees = json.loads(texte)
    except json.JSONDecodeError as exc:
        raise ValueError(f"JSON invalide retourné par Gemini : {exc}") from exc

    champs_requis = {"cause_racine", "liste_controle", "pieces_detachees", "confiance"}
    manquants = champs_requis - donnees.keys()
    if manquants:
        raise ValueError(f"Champs manquants dans la réponse Gemini : {manquants}")

    # Normalisation : s'assurer que les listes sont bien des listes
    for champ in ("liste_controle", "pieces_detachees"):
        if isinstance(donnees[champ], str):
            donnees[champ] = [l.strip() for l in donnees[champ].split("\n") if l.strip()]

    return donnees


# ── Appel unitaire Gemini ─────────────────────────────────────────────────────

def _appeler_avec_cle_json(prompt: str, nom_cle: str, api_key: str) -> dict:
    """
    Envoie un prompt à Gemini et attend une réponse JSON structurée.

    Args:
        prompt: Prompt complet à envoyer.
        nom_cle: Nom de la variable d'env (pour les logs).
        api_key: Valeur de la clé API Gemini.

    Returns:
        Dictionnaire structuré du diagnostic.

    Raises:
        _ERREURS_QUOTA: Si la clé est épuisée → déclenche la rotation.
        ValueError: Si la réponse ne peut pas être parsée.
    """
    logger.info("Appel Gemini JSON avec la clé '%s'", nom_cle)

    genai.configure(api_key=api_key)
    modele = genai.GenerativeModel(
        model_name=_MODELE_GEMINI,
        generation_config=genai.types.GenerationConfig(
            temperature=0.2,
            max_output_tokens=2048,
            response_mime_type="application/json",
        ),
    )
    reponse = modele.generate_content(
        prompt,
        request_options={"timeout": _TIMEOUT_SECONDES},
    )
    resultat = _parser_reponse_json(reponse.text)
    logger.info(
        "Diagnostic JSON généré avec '%s' (confiance=%.2f)",
        nom_cle,
        resultat.get("confiance", 0),
    )
    return resultat


def _appeler_avec_cle_texte(prompt: str, nom_cle: str, api_key: str) -> str:
    """
    Envoie un prompt à Gemini et retourne le texte brut de la réponse.

    Args:
        prompt: Prompt complet à envoyer.
        nom_cle: Nom de la variable d'env (pour les logs).
        api_key: Valeur de la clé API Gemini.

    Returns:
        Texte brut de la réponse Gemini, nettoyé.

    Raises:
        _ERREURS_QUOTA: Si la clé est épuisée → déclenche la rotation.
        ValueError: Si la réponse est vide.
    """
    logger.info("Appel Gemini texte avec la clé '%s'", nom_cle)

    genai.configure(api_key=api_key)
    modele = genai.GenerativeModel(
        model_name=_MODELE_GEMINI,
        generation_config=genai.types.GenerationConfig(
            temperature=0.3,
            max_output_tokens=1024,
        ),
    )
    reponse = modele.generate_content(
        prompt,
        request_options={"timeout": _TIMEOUT_SECONDES},
    )
    texte = reponse.text.strip()
    if not texte:
        raise ValueError("Réponse vide retournée par Gemini.")

    logger.info("Résumé texte généré avec '%s' (%d caractères)", nom_cle, len(texte))
    return texte


# ── Appel Gemini avec rotation automatique ────────────────────────────────────

def _appeler_gemini_json(prompt: str) -> dict:
    """
    Tente les clés disponibles pour un appel JSON, avec rotation automatique.

    Raises:
        RuntimeError: Si aucune clé n'est configurée ou si toutes ont échoué.
    """
    cles = _lire_cles_api()
    if not cles:
        raise RuntimeError(
            "Aucune clé Gemini configurée. "
            "Définissez GEMINI_API_KEY (et optionnellement GEMINI_API_KEY_2) dans .env"
        )

    derniere_exception: Optional[Exception] = None

    for nom_cle, api_key in cles:
        try:
            return _appeler_avec_cle_json(prompt, nom_cle, api_key)
        except _ERREURS_QUOTA as exc:
            logger.warning(
                "Clé '%s' épuisée (%s) — rotation", nom_cle, type(exc).__name__
            )
            derniere_exception = exc
        except ValueError as exc:
            logger.warning("Réponse non parseable avec '%s' : %s — rotation", nom_cle, exc)
            derniere_exception = exc

    raise RuntimeError(
        f"Toutes les clés Gemini (JSON) ont échoué. Dernière erreur : {derniere_exception}"
    )


def _appeler_gemini_texte(prompt: str) -> str:
    """
    Tente les clés disponibles pour un appel texte libre, avec rotation automatique.

    Raises:
        RuntimeError: Si aucune clé n'est configurée ou si toutes ont échoué.
    """
    cles = _lire_cles_api()
    if not cles:
        raise RuntimeError(
            "Aucune clé Gemini configurée. "
            "Définissez GEMINI_API_KEY (et optionnellement GEMINI_API_KEY_2) dans .env"
        )

    derniere_exception: Optional[Exception] = None

    for nom_cle, api_key in cles:
        try:
            return _appeler_avec_cle_texte(prompt, nom_cle, api_key)
        except _ERREURS_QUOTA as exc:
            logger.warning(
                "Clé '%s' épuisée (%s) — rotation", nom_cle, type(exc).__name__
            )
            derniere_exception = exc
        except ValueError as exc:
            logger.warning("Réponse vide avec '%s' : %s — rotation", nom_cle, exc)
            derniere_exception = exc

    raise RuntimeError(
        f"Toutes les clés Gemini (texte) ont échoué. Dernière erreur : {derniere_exception}"
    )


# ── Fallbacks ─────────────────────────────────────────────────────────────────

def _fallback_diagnostic(type_equipement: str, description_symptomes: str) -> dict:
    """
    Diagnostic de secours retourné si toutes les clés Gemini échouent (JSON).
    Garantit la continuité de service sans appel réseau.
    """
    type_lower     = type_equipement.lower()
    mots_symptomes = description_symptomes.lower()

    if "pompe" in type_lower:
        return {
            "cause_racine": (
                "Usure des joints d'étanchéité et cavitation probable "
                "due à une pression d'aspiration insuffisante."
            ),
            "liste_controle": [
                "Vérifier la pression d'aspiration (min. 0.5 bar)",
                "Inspecter visuellement les joints mécaniques",
                "Contrôler le niveau et la qualité du lubrifiant",
                "Mesurer les vibrations avec l'accéléromètre",
                "Vérifier l'alignement pompe-moteur",
                "Contrôler la température des paliers (max. 70°C)",
            ],
            "pieces_detachees": [
                "Joint mécanique double",
                "Roulement à billes SKF 6205",
                "Garniture de presse-étoupe",
                "Joint torique NBR 50x3",
            ],
            "confiance": 0.88,
        }

    if "compresseur" in type_lower:
        return {
            "cause_racine": (
                "Encrassement des filtres à air et défaillance possible "
                "du système de lubrification."
            ),
            "liste_controle": [
                "Remplacer le filtre à air (Δp > 250 mbar)",
                "Vérifier le niveau d'huile compresseur",
                "Contrôler les soupapes d'aspiration et refoulement",
                "Mesurer la température de refoulement (max. 180°C)",
                "Vérifier l'étanchéité du circuit haute pression",
                "Tester le pressostat de sécurité",
            ],
            "pieces_detachees": [
                "Filtre à air ref. FA-220",
                "Soupape de refoulement",
                "Joint de culasse",
                "Huile compresseur VDL 100 (5L)",
            ],
            "confiance": 0.82,
        }

    cause = (
        "Défaillance mécanique – vibrations anormales et surchauffe probable."
        if any(m in mots_symptomes for m in ("vibration", "chaud", "surchauffe"))
        else "Anomalie de fonctionnement – origine électromécanique probable."
    )
    return {
        "cause_racine": cause,
        "liste_controle": [
            "Mettre l'équipement hors tension et consigner",
            "Inspecter visuellement les composants accessibles",
            "Contrôler les connexions électriques et mécaniques",
            "Mesurer les paramètres opérationnels (température, vibrations, courant)",
            "Vérifier les niveaux de fluides",
            "Tester les dispositifs de sécurité",
        ],
        "pieces_detachees": [
            "Kit de joints universel",
            "Fusibles de protection (jeu)",
            "Lubrifiant multifonction",
        ],
        "confiance": 0.70,
    }


def _fallback_resume(nom_equipement: str, type_equipement: str, stats: dict) -> str:
    """
    Résumé de secours retourné si Gemini est indisponible pour l'analyse équipement.
    Construit un texte factuel minimal à partir des statistiques disponibles.

    Args:
        nom_equipement: Nom de l'équipement.
        type_equipement: Type de l'équipement.
        stats: Statistiques agrégées de l'équipement.

    Returns:
        Texte de résumé analytique minimal.
    """
    nombre_pannes  = stats.get("nombre_pannes", 0)
    tickets_ouverts = stats.get("tickets_ouverts", 0)
    mttr           = stats.get("mttr_heures")

    parties = [
        f"L'équipement {nom_equipement} ({type_equipement}) "
        f"totalise {nombre_pannes} ticket(s) de maintenance enregistré(s).",
    ]

    if tickets_ouverts > 0:
        parties.append(
            f"{tickets_ouverts} ticket(s) sont actuellement ouverts ou en cours de traitement."
        )
    else:
        parties.append("Aucun ticket ouvert n'est en cours de traitement.")

    if mttr is not None:
        parties.append(
            f"Le temps moyen de résolution (MTTR) calculé est de {mttr} heure(s)."
        )

    parties.append(
        "Le service Gemini est temporairement indisponible ; "
        "ce résumé est généré automatiquement à partir des données statistiques."
    )

    return " ".join(parties)


# ── Points d'entrée publics ───────────────────────────────────────────────────

def appeler_llm(
    type_equipement: str,
    modele_equipement: str,
    description_symptomes: str,
    historique_tickets: list[dict],
) -> dict:
    """
    Génère un diagnostic JSON structuré pour un ticket de maintenance.

    Ordre d'exécution :
      1. Construit le prompt de diagnostic.
      2. Tente GEMINI_API_KEY, puis GEMINI_API_KEY_2 si quota dépassé.
      3. Si toutes les clés échouent, active le fallback mock.

    Args:
        type_equipement: Type de l'équipement.
        modele_equipement: Modèle de l'équipement.
        description_symptomes: Description des symptômes du ticket.
        historique_tickets: Derniers tickets du même équipement (contexte).

    Returns:
        Dictionnaire avec cause_racine, liste_controle, pieces_detachees, confiance.
    """
    prompt = _construire_prompt_diagnostic(
        type_equipement       = type_equipement,
        modele_equipement     = modele_equipement,
        description_symptomes = description_symptomes,
        historique_tickets    = historique_tickets,
    )

    try:
        return _appeler_gemini_json(prompt)
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Gemini indisponible (%s) — fallback diagnostic pour '%s'",
            exc,
            type_equipement,
        )
        return _fallback_diagnostic(type_equipement, description_symptomes)


def appeler_llm_texte(
    nom_equipement: str,
    type_equipement: str,
    criticite: str,
    stats: dict,
    derniers_tickets: list[dict],
) -> str:
    """
    Génère un résumé analytique textuel pour la page détail d'un équipement.

    Pas de cache : chaque appel sollicite Gemini pour refléter les données
    les plus récentes.

    Ordre d'exécution :
      1. Construit le prompt de résumé factuel.
      2. Tente GEMINI_API_KEY, puis GEMINI_API_KEY_2 si quota dépassé.
      3. Si toutes les clés échouent, retourne un résumé de secours basé
         sur les statistiques uniquement.

    Args:
        nom_equipement: Nom de l'équipement.
        type_equipement: Type de l'équipement (pompe, compresseur…).
        criticite: Niveau de criticité ('basse' | 'moyenne' | 'haute' | 'critique').
        stats: Statistiques agrégées retournées par l'endpoint /statistiques/.
        derniers_tickets: Liste des 30 derniers tickets (id, titre, statut, notes).

    Returns:
        Texte du résumé analytique (5 à 8 phrases).
    """
    prompt = _construire_prompt_resume(
        nom_equipement   = nom_equipement,
        type_equipement  = type_equipement,
        criticite        = criticite,
        stats            = stats,
        derniers_tickets = derniers_tickets,
    )

    try:
        return _appeler_gemini_texte(prompt)
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Gemini indisponible (%s) — fallback résumé pour '%s'",
            exc,
            nom_equipement,
        )
        return _fallback_resume(nom_equipement, type_equipement, stats)
