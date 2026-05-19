# ShortApps V1.6 - base propre, HTTPS iOS et signature Windows

## Objectif

La V1.6 devient la nouvelle base stable. Les versions
precedentes sont supprimees du dossier `versioning` afin de conserver une base
lisible pour la suite.

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
- Chargement optionnel d'un certificat TLS public fourni par l'utilisateur.

## Fonctionnalites retirees ou allegées

La section "Appareil" reste retiree de l'interface V1.6.

Raison : elle affichait une liste d'appareils, des statuts autorise/revoque, des
dates et des IP, mais ces donnees etaient encore des donnees de demonstration et
non un vrai registre persistant d'appareils approuves cote serveur.

La securite V1.6 repose donc sur :

- le filtrage reseau local par sous-reseau ;
- le jeton QR Code actif ;
- la verification `pair` + `code` avant de servir `/mobile`, `/api/config`,
  `/api/apps/launch` et `/api/keyboard` a un client non-localhost.

Une future version pourra reinstaurer une section "Appareils" uniquement si elle
est adossee a un vrai registre serveur : empreinte appareil, date de premiere
connexion, derniere connexion, revocation effective et expiration des sessions.

## HTTPS iOS sans exposer le PC local

Le serveur ShortApps continue de generer un HTTPS local auto-signe pour le LAN.
C'est utile pour tester, mais ce n'est pas le meilleur choix pour iOS en usage
quotidien, car l'iPhone doit faire confiance au certificat.

### Piste 1 - Domaine public, certificat DNS-01, DNS local

Choix recommande pour une latence minimale.

1. Acheter ou utiliser un domaine reel, par exemple `shortapps.example.com`.
2. Obtenir un certificat TLS public pour ce domaine par challenge DNS-01.
3. Faire resoudre ce domaine vers l'IP LAN du PC, par exemple `192.168.0.55`,
   via le DNS du routeur, Pi-hole, AdGuard Home ou un DNS interne.
4. Fournir le certificat public a ShortApps avec `SHORTAPPS_TLS_CERT` et
   `SHORTAPPS_TLS_KEY`, ou terminer TLS via Caddy/Traefik en local.
5. Renseigner `https://shortapps.example.com` dans ShortApps.

Avantage : l'iPhone voit un HTTPS public valide, mais le trafic reste en local.
Le PC n'a aucun port ouvert vers Internet.

### Piste 2 - VPN mesh

Tailscale, WireGuard ou ZeroTier creent un reseau prive entre le PC et l'iPhone.
Le domaine peut pointer vers l'IP VPN du PC, ou le QR peut utiliser l'URL fournie
par le VPN si elle est en HTTPS valide.

Avantage : pas de port entrant sur la box, chiffrement point-a-point.
Limite : le VPN doit etre actif sur le telephone.

### Piste 3 - Tunnel sortant ou petit VPS relais

Cloudflare Tunnel, ngrok, ou un VPS avec WireGuard permettent au PC d'initier un
tunnel sortant. Le relais expose une URL HTTPS publique et transfere vers le PC.

Avantage : fonctionne meme hors du LAN sans exposer directement le PC.
Limite : latence plus elevee et besoin d'une authentification par appareil plus
forte avant usage quotidien.

### Piste 4 - Autorite de certification privee

Installer une CA privee sur l'iPhone et signer le certificat local ShortApps avec
cette CA peut fonctionner pour un parc tres limite d'appareils personnels.

Avantage : pas de domaine public necessaire.
Limite : configuration manuelle plus fragile et moins elegante pour un produit.

## Certificat TLS fourni a ShortApps

ShortApps V1.6 peut utiliser un certificat public fourni au demarrage avec :

- `SHORTAPPS_TLS_CERT` + `SHORTAPPS_TLS_KEY` pour un certificat PEM ;
- `SHORTAPPS_TLS_PFX` pour un certificat PFX ;
- `SHORTAPPS_TLS_PASSPHRASE` si le certificat est protege.

Sans certificat public fourni, ShortApps conserve son certificat local auto-signe.

## Signature Windows

L'EXE doit etre signe avec un certificat de signature de code reconnu ou via
Microsoft Trusted Signing pour etre plus legitime cote Windows.

Script fourni :

- `scripts/sign-windows.ps1`
- `npm run sign:win`
- `npm run package:win:signed`

Variables supportees :

- `SHORTAPPS_SIGN_PFX`
- `SHORTAPPS_SIGN_PASSWORD`
- `SHORTAPPS_SIGN_CERT_SHA1`
- `SHORTAPPS_SIGN_TIMESTAMP_URL`

La signature ne remplace pas la reputation SmartScreen, mais elle identifie
l'editeur et evite une partie des alertes liees aux executables non signes.

## References techniques

- W3C Secure Contexts : https://www.w3.org/TR/secure-contexts/
- Let's Encrypt challenge types : https://letsencrypt.org/docs/challenge-types/
- Microsoft code signing options : https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
- Microsoft SignTool : https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool
- Cloudflare Tunnel : https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/

## Interface V1.6

L'ecran Parametres reste le centre de l'acces mobile :

- adresse locale active ;
- port ;
- exposition reseau ;
- champ d'URL HTTPS publique ou domaine LAN ;
- QR Code mobile ;
- copie du lien mobile ;
- regeneration du jeton QR.

Les elements non fonctionnels ou purement illustratifs ne doivent pas revenir
dans l'interface principale sans logique metier reelle.
