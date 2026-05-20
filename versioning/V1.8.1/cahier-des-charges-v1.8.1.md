# ShortApps V1.8.1 - Correctif hub auto-heberge

## Objectif

La V1.8.1 stabilise la configuration du hub distant introduit en V1.8. Elle
conserve l'architecture avec VM Debian exposee en HTTPS, PC connecte en tunnel
WebSocket sortant et telephone connecte via `https://shortapps.tournayre.ovh`.

## Correction principale

L'ecran `Parametres > Hub distant` doit permettre d'activer reellement la
connexion au hub depuis l'interface Windows.

L'utilisateur doit pouvoir :

- saisir l'URL HTTPS du hub ;
- saisir l'ID machine ;
- saisir le secret de connexion hub ;
- enregistrer explicitement la configuration ;
- activer la connexion hub ;
- desactiver la connexion hub ;
- voir l'etat du hub se mettre a jour apres enregistrement.

## Regles de validation

Avant activation, ShortApps doit verifier que :

- l'URL hub commence par `https://` ;
- l'ID machine n'est pas vide ;
- le secret hub n'est pas vide.

Si un champ obligatoire manque, la connexion ne doit pas etre activee et
l'interface doit afficher un message clair.

## Comportement backend attendu

Apres un enregistrement de configuration via `/api/config`, le serveur local
doit :

- ecrire la configuration dans le stockage local ;
- conserver le hash du mot de passe mobile existant ;
- demander au client hub de relire immediatement la configuration ;
- faire passer l'etat hub de `disabled` vers `connecting`, `connected` ou
  `reconnecting` selon la disponibilite du hub et la validite du secret.

## Securite VM Debian

Le script `hub/setup-debian.sh` doit rester compatible Debian 12 :

- fail2ban utilise le backend `systemd` pour le jail `sshd` ;
- le service `shortapps-hub` reste limite a `127.0.0.1:8080` ;
- Nginx reste seul expose publiquement en 80/443 ;
- UFW limite les ports entrants a SSH, HTTP et HTTPS ;
- le secret hub reste stocke dans `/etc/shortapps-hub.env` en permission
  `0600`.

## Package

La version Windows V1.8.1 doit etre archivee localement dans :

```text
versioning/V1.8.1/ShortApps-V1.8.1-win32-x64.zip
```

SHA256 :

```text
b1f788967a10cfe716d2e16a895b8419362912cb54cc3a50759db451d45e36fb
```
