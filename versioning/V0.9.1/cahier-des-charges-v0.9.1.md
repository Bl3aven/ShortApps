# ShortApps V0.9.1 - Preproduction

## Objectif

La V0.9.1 remplace le nommage V1.x provisoire. La future V1 sera reservee a la
premiere version de production. Cette version doit fournir une base exploitable,
plus propre visuellement et plus robuste lorsque l'interface Windows est fermee.

## Interface Windows

L'application Windows doit utiliser la fenetre native comme conteneur principal.
Elle ne doit plus donner l'impression d'afficher une fenetre dans une autre
fenetre.

Exigences :

- l'interface React occupe toute la surface disponible ;
- les faux boutons de controle de fenetre ne sont plus affiches ;
- les panneaux internes restent des zones fonctionnelles, pas des fenetres
  decoratives ;
- le bouton d'installation du service local est disponible en bas a gauche.

## Service local Windows

ShortApps doit pouvoir installer un fonctionnement arriere-plan afin que la
webapp mobile et le hub restent disponibles lorsque l'interface Windows est
fermee.

Comportement attendu :

- bouton `Installer le service` dans la colonne laterale ;
- creation d'une tache planifiee Windows `ShortAppsBackground` ;
- lancement de `ShortApps.exe --service` sans interface graphique ;
- demarrage automatique a l'ouverture de session Windows ;
- maintien du serveur local, HTTPS local et tunnel hub ;
- possibilite de retirer le service depuis l'interface ;
- si le service est deja lance, l'interface Windows se connecte au serveur local
  existant au lieu d'essayer d'en demarrer un second.

Cette implementation utilise une tache planifiee utilisateur plutot qu'un vrai
service SCM natif, afin d'eviter une dependance externe et de rester simple a
deployer.

## Mobile

L'interface mobile doit rester une webapp plein ecran.

Ajouts V0.9.1 :

- le nom du PC en haut a gauche devient interactif ;
- un appui sur ce nom affiche un bouton `Deconnexion` ;
- la deconnexion supprime le jeton local et, en mode hub, redirige vers
  `/hub/logout` ;
- en mode paysage uniquement, un glissement vers le bas depuis le haut de
  l'ecran affiche l'heure ;
- les boutons du dashboard doivent donner une impression d'appui physique :
  relief, enfoncement, ombre dynamique et retour haptique si le navigateur le
  permet.

## Lancement d'applications

Lorsqu'une application est lancee depuis le telephone :

- ShortApps valide le raccourci ;
- lance l'executable cible ;
- tente de restaurer et mettre au premier plan la fenetre de l'application via
  les API Windows appelees depuis PowerShell.

## Authentification

Le mot de passe mobile reste configure cote PC. Les sessions mobiles peuvent
etre fermees par :

- suppression du jeton local en mode local ;
- suppression du cookie de session hub via `/hub/logout` en mode hub.

## Securite du hub

Le hub public doit exposer uniquement ShortApps et uniquement les routes utiles
au fonctionnement mobile.

Exigences :

- le reverse proxy accepte uniquement le domaine configure ;
- les hôtes inconnus sont rejetes avant d'atteindre l'application Node ;
- les routes non mobiles, dont les API d'administration PC, ne sont pas
  publiees sur Internet ;
- les appels mobiles autorises sont limites au chargement de l'interface, a la
  configuration, a l'etat d'authentification, au lancement d'applications, au
  pave numerique et a la deconnexion ;
- le tunnel PC reste authentifie par secret et ne doit pas accepter de
  WebSocket provenant d'un navigateur ;
- le client PC applique aussi une liste blanche de routes afin de bloquer une
  exposition accidentelle si le hub est mal configure ;
- les cookies de session sont HttpOnly, SameSite et Secure en HTTPS ;
- les reponses publiques ajoutent les headers HSTS, CSP, COOP/CORP, nosniff,
  frame deny, referrer policy et permissions policy ;
- l'etat public `/hub/status` ne doit pas exposer d'information sensible par
  defaut.
- le processus Node du hub ecoute uniquement sur `127.0.0.1` derriere Nginx ;
- les services de decouverte reseau inutiles LLMNR/mDNS sont desactives sur la
  VM ;
- SSH reste disponible pour l'administration, mais en cle publique uniquement,
  sans login root ni mot de passe.

## Package

La version Windows V0.9.1 est archivee localement dans :

```text
versioning/V0.9.1/ShortApps-V0.9.1-win32-x64.zip
```

SHA256 :

```text
811aaeb63f8c278b0af65d400c0810b615eb841b9d840a6743fa04d494a179e0
```
