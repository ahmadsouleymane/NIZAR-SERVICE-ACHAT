# Template des plannings de départs

Document de référence pour le scanner OCR : décrit la structure exacte des feuilles
de planning imprimées par le service de transport.

## Disposition générale

- **Fond blanc**, colonnes séparées par des **traits verticaux noirs**, lignes séparées
  par des **traits gris clair**.
- Une page = **plusieurs blocs** empilés, un bloc par ville de départ.
- Chaque bloc commence par un titre **`DEPART [VILLE]`** (ex. `DEPART AGADEZ`,
  `DEPART NIAMEY`).
- La **date** est en haut à gauche, au format `JJ/MM/AAAA` (ex. `06/08/2026`).

## Les 7 colonnes (de gauche à droite)

| # | Colonne | Largeur | Contenu | Exemple | Règles de lecture |
|---|---------|---------|---------|---------|-------------------|
| 1 | **AXES** | ~35 % | Trajet Origine - Destination | `AGADEZ - NIAMEY SPECIAL` | Texte long, aligné à gauche. Peut finir par `REPOS` ou `NUIT` |
| 2 | **N° BUS** | ~10 % | Immatriculation du bus | `CG 6377` | 2 lettres (`CG`, `BZ`, `BM`, `BH`, `BR`) + espace + 4 chiffres, centré |
| 3 | **HEURE** | ~10 % | Heure de départ | `05 H 00` | Format `HH H MM` (avec « H »). Exception : la valeur texte `NUIT` |
| 4 | **CHAUFFEUR TITULAIRE** | ~15 % | Chauffeur principal | `YOUSSOUF` | Nom (parfois prénom + nom) |
| 5 | **CHAUFFEUR SUPPLÉANT** | ~15 % | Remplaçant | `NEANT` | Souvent `NEANT` (= aucun remplaçant) |
| 6 | **TÉLÉPHONE TITULAIRE** | ~10 % | Téléphone principal | `96474717` | 8 chiffres, commence souvent par 9 |
| 7 | **TÉLÉPHONE SUPPLÉANT** | ~10 % | Téléphone du remplaçant | `NEANT` | 8 chiffres ou `NEANT` |

## Règles métier de lecture

- **`NEANT`** dans les colonnes 5 et 7 = **champ vide** dans la base (pas de remplaçant).
- La mention **`NUIT`** se trouve dans la colonne **HEURE** (ex. une ligne `NUIT - GAYA`
  part de nuit) — ce n'est **jamais** un numéro de bus.
- Les colonnes 6 et 7 sont **toujours des nombres de 8 chiffres** : les lire comme des
  entiers, indépendamment du libellé d'en-tête (qui peut être mal imprimé sur certaines feuilles).
- Sur certaines feuilles, l'en-tête du tableau est imprimé sur **deux lignes**
  (ex. `CHAUFFEUR` au-dessus de `TITULAIRE`, `TELEPHONE` au-dessus de `SUPPLEANT`),
  ou le mot `DEPART` apparaît sous `HEURE` : ces lignes ne sont pas des données.

## Structure des lignes

- **Ligne 0** : en-tête du tableau (les 7 intitulés ci-dessus) — ignorée par l'extraction.
- **Lignes de données** : une ligne = un bus pour un créneau horaire.
- Les blocs de ville se succèdent sans ligne de séparation visible (seul le titre
  `DEPART [VILLE]` annonce le nouveau bloc).

## Comment le parseur utilise ce template

1. **Détection de la date** : chercher `JJ/MM/AAAA` en haut de page.
2. **Découpage en blocs** : repérer les titres `DEPART [VILLE]`.
3. **Nettoyage** : retirer les traits verticaux lus « `|` » par l'OCR, interpréter
   `NEANT` comme vide, normaliser `05H00` → `05 H 00`.
4. **Classement des mots par colonne** : axe (gauche), bus, heure, chauffeur titulaire,
   chauffeur suppléant, téléphone titulaire, téléphone suppléant — en s'appuyant sur
   les positions horizontales (les téléphones de 8 chiffres servent d'ancres).
5. **Cas à 2 chauffeurs** : quand il y a deux chauffeurs et deux téléphones, la
   séparation se fait au plus grand écart horizontal entre les deux noms.
