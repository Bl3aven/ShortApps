# ShortApps V6 - base propre et HTTPS iOS

## Objectif

La V6 sert de base propre pour la suite. Elle conserve les fonctionnalites qui
sont explicitement branchees et testables, et retire les zones d'interface qui
donnaient l'impression d'etre terminees sans avoir de logique serveur complete.

## Fonctionnalites conservees

- Application Windows Electron avec interface locale.
- Webapp mobile plein ecran servie par le PC.
- Dashboard mobile en paysage et portrait secondaire.
- Pages de dashboard avec 8 raccourcis maximum.
- Scan dynamique des applications Windows quand l'app tourne sur Windows.
- Recuperation automatique des icones Windows quand elles sont disponibles.
- Validation des chemins executables.
- Lancement d'applications depuis le telephone via `/api/apps/launch`.
- Pave numerique mobile via `/api/keyboard`.
- Retour haptique mobile quand `navigator.vibrate` est disponible.
- Selection des interfaces reseau exposees.
- Nom du PC recupere dynamiquement.
- QR Code d'acces mobile avec jeton `pair` et `code`.

## Fonctionnalites retirees ou allegées

La section "Appareil" a ete retiree de l'interface V6.

Raison : la V5 affichait une liste d'appareils, des statuts autorise/revoque,
des dates et des IP, mais ces donnees etaient encore des donnees de demonstration
et non un vrai registre persistant d'appareils approuves cote serveur.

La securite V6 repose donc uniquement sur :

- le filtrage reseau local par sous-reseau ;
- le jeton QR Code actif ;
- la verification `pair` + `code` avant de servir `/mobile`, `/api/config`,
  `/api/apps/launch` et `/api/keyboard` a un client non-localhost.

Une future V7 pourra reinstaurer une section "Appareils" uniquement si elle est
adossee a un vrai registre serveur : empreinte appareil, date de premiere
connexion, derniere connexion, revocation effective et expiration des sessions.

## HTTPS iOS

Le serveur ShortApps continue de generer un HTTPS local auto-signe pour le LAN.
C'est utile pour tester, mais ce n'est pas le meilleur choix pour iOS en usage
quotidien, car l'iPhone doit faire confiance au certificat.

Choix recommande pour V6 et pour une latence tres faible :

1. Acheter ou utiliser un domaine reel, par exemple `shortapps.example.com`.
2. Obtenir un certificat TLS public pour ce domaine, idealement par challenge
   DNS-01 si le domaine pointe vers une IP privee.
3. Faire resoudre ce domaine vers l'IP LAN du PC, par exemple `192.168.0.55`,
   via le DNS du routeur, un DNS local ou une entree DNS privee.
4. Renseigner `https://shortapps.example.com` dans le champ "URL HTTPS publique
   ou domaine LAN" de ShortApps.
5. Generer le QR Code : le telephone scanne une URL HTTPS valide et reste sur
   le reseau local, donc la latence reste minimale.

ShortApps V6 peut utiliser un certificat public fourni au demarrage avec :

- `SHORTAPPS_TLS_CERT` + `SHORTAPPS_TLS_KEY` pour un certificat PEM ;
- `SHORTAPPS_TLS_PFX` pour un certificat PFX ;
- `SHORTAPPS_TLS_PASSPHRASE` si le certificat est protege.

Sans certificat public fourni, ShortApps conserve son certificat local auto-signe.

Alternative proxy/VPS :

- Un petit serveur public peut exposer `https://shortapps.example.com`.
- Le PC se connecte au proxy par tunnel sortant ou VPN.
- Le proxy relaye vers le serveur ShortApps local.

Ce mode est utile pour l'acces depuis n'importe quel reseau, mais il augmente la
latence et doit etre accompagne d'une authentification par appareil plus robuste.

## Interface V6

L'ecran Parametres devient le centre de l'acces mobile :

- adresse locale active ;
- port ;
- exposition reseau ;
- champ d'URL HTTPS publique ou domaine LAN ;
- QR Code mobile ;
- copie du lien mobile ;
- regeneration du jeton QR.

Les elements non fonctionnels ou purement illustratifs ne doivent pas revenir
dans l'interface principale sans logique metier reelle.
