"""
tickets/services/analyse_ia_service.py
=======================================
Service d'analyse IA locale pour les équipements.

Deux fonctionnalités sans appel LLM :
  - détecter_pannes_recurrentes : compte les occurrences de familles de pannes
    prédéfinies dans le corpus textuel des tickets d'un équipement.
  - trouver_cas_similaires      : calcule la similarité TF-IDF / cosine entre
    le corpus des tickets d'un équipement cible et ceux de tous les autres
    équipements, puis retourne les 5 tickets les plus proches.

Dépendances :
  - scikit-learn >= 1.4  (TfidfVectorizer, cosine_similarity)
  Aucune dépendance Django directe → testable unitairement sans ORM.
"""

import logging
import re
from dataclasses import dataclass, field

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

# ── Types de retour ───────────────────────────────────────────────────────────

@dataclass(frozen=True)
class FamillePane:
    """Résultat d'une détection de famille de panne."""
    famille: str
    occurrences: int


@dataclass(frozen=True)
class CasSimilaire:
    """Résultat d'un ticket similaire trouvé par TF-IDF."""
    ticket_id: int
    titre: str
    equipement_nom: str
    statut: str
    similarite: float


# ── Familles de pannes prédéfinies ────────────────────────────────────────────
# Chaque famille est associée à une liste de mots-clés (regex insensibles à
# la casse). Un ticket contribue +1 à une famille dès qu'un mot-clé correspond.

_FAMILLES_PANNES: dict[str, list[str]] = {
    "fuite": [
        r"\bfuite\b", r"\bfuites?\b", r"\bfuit\b", r"\bécoule(ment)?\b",
        r"\bdébordement\b", r"\bgouttière\b", r"\bperte\s+de\s+fluide\b",
    ],
    "électrique": [
        r"\bélectrique\b", r"\bcourt.circuit\b", r"\bdisjoncteur\b",
        r"\bfusible\b", r"\bsurtension\b", r"\bpanne\s+électrique\b",
        r"\bcâble\b", r"\bconnecteur\b", r"\balimentat(ion|eur)\b",
        r"\bvariateur\b", r"\bcontacteur\b", r"\brelais\b",
    ],
    "moteur": [
        r"\bmoteur\b", r"\brotation\b", r"\bcouple\b", r"\bvitesse\b",
        r"\bsurvitesse\b", r"\bsous.vitesse\b", r"\bvibrat(ion|ions)\b",
        r"\bpalier\b", r"\broulement\b", r"\barbre\b",
    ],
    "usure": [
        r"\busure\b", r"\busé(e)?\b", r"\bvieillissement\b", r"\bérosion\b",
        r"\bcorrosion\b", r"\brouille\b", r"\bdégradation\b",
        r"\bdetérioration\b", r"\bdétérioration\b", r"\bjoint\b",
        r"\bjoint.torique\b", r"\bgarniture\b",
    ],
    "capteur": [
        r"\bcapteur\b", r"\bsonde\b", r"\bdétecteur\b", r"\bcapteurs?\b",
        r"\binstrument(ation)?\b", r"\bmesure\b", r"\bcalibra(ge|tion)\b",
        r"\bdérive\b", r"\bsignal\b", r"\banalogique\b", r"\bnumérique\b",
    ],
    "encrassement": [
        r"\bencrassement\b", r"\bencrassé(e)?\b", r"\bcolmaté(e)?\b",
        r"\bcolmatage\b", r"\bfiltre\b", r"\bsalissure\b", r"\bdépôt\b",
        r"\bboue\b", r"\bcalcaire\b", r"\btartre\b", r"\bsédiment\b",
        r"\bnettoyage\b", r"\bchasse\b",
    ],
}

# Nombre maximum de cas similaires retournés
_NB_CAS_SIMILAIRES = 5

# Score de similarité minimum pour être retenu (évite le bruit)
_SEUIL_SIMILARITE = 0.05


# ── Helpers internes ──────────────────────────────────────────────────────────

def _construire_corpus_ticket(ticket) -> str:
    """
    Concatène les champs textuels d'un ticket en un seul document.

    Les champs utilisés sont : titre, description, notes_technicien.
    Les pièces détachées des suggestions acceptées sont également
    incluses pour enrichir le corpus sémantique.

    Args:
        ticket: Instance du modèle Ticket (ORM Django).

    Returns:
        Chaîne de caractères nettoyée représentant le ticket.
    """
    parties = [
        ticket.titre or "",
        ticket.description or "",
        ticket.notes_technicien or "",
    ]

    # Ajoute les pièces détachées des suggestions IA acceptées
    for suggestion in ticket.suggestions.filter(acceptee=True):
        parties.append(suggestion.pieces_detachees or "")

    return " ".join(p.strip() for p in parties if p.strip())


def _texte_contient_famille(texte: str, patterns: list[str]) -> bool:
    """
    Retourne True si le texte correspond à au moins un des patterns regex.

    Args:
        texte: Texte à analyser (en minuscules).
        patterns: Liste d'expressions régulières.

    Returns:
        True si au moins un pattern est trouvé.
    """
    return any(re.search(p, texte, flags=re.IGNORECASE) for p in patterns)


# ── Fonction publique 1 : pannes récurrentes ──────────────────────────────────

def detecter_pannes_recurrentes(tickets) -> list[dict]:
    """
    Détecte et compte les familles de pannes dans le corpus de tickets.

    Chaque ticket est analysé une fois par famille : il contribue au
    maximum +1 à chaque famille, même si plusieurs mots-clés correspondent.
    Le résultat est trié par nombre d'occurrences décroissant.
    Seules les familles avec au moins une occurrence sont retournées.

    Args:
        tickets: QuerySet ou liste d'instances Ticket (avec prefetch suggestions).

    Returns:
        Liste de dicts triée : [{"famille": str, "occurrences": int}, ...]
    """
    compteurs: dict[str, int] = {famille: 0 for famille in _FAMILLES_PANNES}

    for ticket in tickets:
        corpus = _construire_corpus_ticket(ticket)
        if not corpus:
            continue
        for famille, patterns in _FAMILLES_PANNES.items():
            if _texte_contient_famille(corpus, patterns):
                compteurs[famille] += 1

    resultats = [
        {"famille": famille, "occurrences": count}
        for famille, count in compteurs.items()
        if count > 0
    ]
    resultats.sort(key=lambda x: x["occurrences"], reverse=True)

    logger.debug(
        "Pannes récurrentes détectées : %d famille(s) sur %d ticket(s)",
        len(resultats),
        len(list(tickets)) if hasattr(tickets, "__len__") else "?",
    )
    return resultats


# ── Fonction publique 2 : cas similaires (TF-IDF) ────────────────────────────

def trouver_cas_similaires(
    tickets_cible,
    tickets_autres,
) -> list[dict]:
    """
    Trouve les tickets d'autres équipements les plus similaires au corpus
    de l'équipement cible, en utilisant TF-IDF et la similarité cosine.

    Algorithme :
      1. Construit le corpus de l'équipement cible (concaténation de tous
         ses tickets en un seul document de référence).
      2. Construit un document par ticket des autres équipements.
      3. Vectorise l'ensemble avec TfidfVectorizer.
      4. Calcule la similarité cosine entre le document de référence et
         chaque ticket des autres équipements.
      5. Retourne les _NB_CAS_SIMILAIRES plus similaires au-dessus du seuil.

    Args:
        tickets_cible: QuerySet des tickets de l'équipement analysé.
        tickets_autres: QuerySet des tickets des autres équipements
                        (doit inclure equipement via select_related).

    Returns:
        Liste de dicts triée par similarité décroissante :
        [{"ticket_id", "titre", "equipement_nom", "statut", "similarite"}, ...]
        Retourne [] si le corpus est vide ou si aucun ticket similaire n'est trouvé.
    """
    # ── Construction du document de référence (équipement cible) ─────────────
    parties_cible = [_construire_corpus_ticket(t) for t in tickets_cible]
    corpus_cible  = " ".join(p for p in parties_cible if p)

    if not corpus_cible.strip():
        logger.info("Corpus cible vide — aucune similarité calculable.")
        return []

    # ── Construction des documents des autres tickets ─────────────────────────
    tickets_autres_liste = list(tickets_autres)
    if not tickets_autres_liste:
        return []

    corpus_autres = [_construire_corpus_ticket(t) for t in tickets_autres_liste]

    # Filtre les tickets dont le corpus est entièrement vide
    indices_valides = [i for i, c in enumerate(corpus_autres) if c.strip()]
    if not indices_valides:
        return []

    tickets_filtres = [tickets_autres_liste[i] for i in indices_valides]
    corpus_filtres  = [corpus_autres[i] for i in indices_valides]

    # ── Vectorisation TF-IDF ──────────────────────────────────────────────────
    # Le document de référence est placé en première position.
    tous_les_documents = [corpus_cible] + corpus_filtres

    try:
        vectoriseur = TfidfVectorizer(
            strip_accents="unicode",
            lowercase=True,
            min_df=1,
            max_features=5000,
        )
        matrice_tfidf = vectoriseur.fit_transform(tous_les_documents)
    except ValueError as exc:
        logger.warning("Échec de la vectorisation TF-IDF : %s", exc)
        return []

    # ── Calcul de la similarité cosine ────────────────────────────────────────
    vecteur_cible   = matrice_tfidf[0]          # première ligne = document cible
    vecteurs_autres = matrice_tfidf[1:]         # reste = tickets des autres équipements

    scores = cosine_similarity(vecteur_cible, vecteurs_autres).flatten()

    # ── Sélection des _NB_CAS_SIMILAIRES meilleurs résultats ─────────────────
    indices_tries = scores.argsort()[::-1]  # tri décroissant

    resultats = []
    for idx in indices_tries:
        score = float(scores[idx])
        if score < _SEUIL_SIMILARITE:
            break
        if len(resultats) >= _NB_CAS_SIMILAIRES:
            break

        ticket = tickets_filtres[idx]
        equipement_nom = (
            ticket.equipement.nom
            if ticket.equipement
            else "Équipement inconnu"
        )
        resultats.append({
            "ticket_id":      ticket.id,
            "titre":          ticket.titre,
            "equipement_nom": equipement_nom,
            "statut":         ticket.statut,
            "similarite":     round(score, 3),
        })

    logger.debug(
        "Cas similaires : %d résultat(s) sur %d tickets analysés",
        len(resultats),
        len(tickets_filtres),
    )
    return resultats
