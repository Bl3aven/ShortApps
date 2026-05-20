# ShortApps V0.9.1

Version de preproduction. La future V1 correspondra a la premiere version de
production stable.

## Contenu

- Renommage de la ligne courante en `0.9.1`.
- Interface Windows nettoyee : l'application occupe maintenant la fenetre
  native sans effet de fenetre imbriquee.
- Suppression des faux controles de fenetre dessines dans l'interface React.
- Ajout d'une installation de service local Windows via tache planifiee :
  `ShortApps.exe --service` garde le serveur local et le tunnel hub actifs sans
  interface graphique.
- L'interface Windows sait se reconnecter a un serveur local deja lance par le
  service.
- Ajout d'un bouton de deconnexion mobile accessible en touchant le nom du PC
  en haut a gauche.
- Ajout du geste mobile paysage vers le bas pour afficher l'heure.
- Boutons du dashboard mobile retravailles pour donner une sensation plus
  physique : relief, bord lumineux, enfoncement et retour haptique navigateur.
- Lancement d'application Windows via PowerShell avec tentative de mise au
  premier plan de la fenetre cible.
- Durcissement du hub public : seuls les ecrans mobile, le login, le tunnel PC
  et les API mobile strictement necessaires sont exposes.
- Blocage des API d'administration PC depuis Internet, controle d'hote, headers
  de securite, HSTS, CSP, tunnel WebSocket authentifie et filtrage cote PC.
- Durcissement VM : Node ecoute seulement en local, Nginx seul expose le web,
  LLMNR/mDNS desactives, SSH force en cle publique avec mot de passe et root
  interdits.

## Package

Archive Windows x64 :

- `ShortApps-V0.9.1-win32-x64.zip`
- SHA256 : `811aaeb63f8c278b0af65d400c0810b615eb841b9d840a6743fa04d494a179e0`

## Notes

Le service local Windows est implemente avec une tache planifiee utilisateur
afin d'eviter une dependance externe de type wrapper SCM. Il fournit le
comportement attendu pour ShortApps : maintien du serveur local apres fermeture
de l'interface.
