# Icônes des packs de crédits

| Fichier | Pack (ID Play Console) |
|---|---|
| `coins_500.png` | `coins_500` : une pièce |
| `coins_1200.png` | `coins_1200` : pile de pièces |
| `coins_3500.png` | `coins_3500` : tas de piles |
| `coins_8000.png` | `coins_8000` : coffre au trésor |

PNG 512 × 512 à fond transparent, pour les publicités, les réseaux sociaux ou une future promotion.
Le jeu utilise des copies en 192 × 192 (`frontend/assets/images/packs/`) dans la boutique ; un pack
ajouté plus tard depuis la page d'administration reçoit l'image correspondant à son nombre de crédits.

`source.html` contient le dessin (SVG) : ouvrir dans un navigateur et appeler `draw("coins_500")`.
