# ShortApps

Prototype React/Vite de l'interface ShortApps : configuration PC, dashboards mobiles,
raccourcis personnalisables, fonds d'ecran, pages, scan Windows, lancement
d'applications et acces mobile protege par mot de passe.

## Lancer en developpement

```bash
npm install
npm run dev -- --host 0.0.0.0
```

Le serveur Vite affiche une URL locale et une ou plusieurs URL reseau.

Routes principales :

- `/` : interface Windows/desktop de configuration, destinee a etre emballee en `.exe`.
- `/mobile` : webapp telephone plein ecran, sans cadre desktop, avec pages horizontales.

Si le developpement tourne dans WSL ou dans un environnement qui detecte une IP
virtuelle au lieu de l'IP Wi-Fi Windows, forcez l'adresse locale :

```bash
SHORTAPPS_LOCAL_IP=192.168.1.210 npm run dev -- --host 0.0.0.0
```

Sous PowerShell :

```powershell
$env:SHORTAPPS_LOCAL_IP="192.168.1.210"; npm run dev -- --host 0.0.0.0
```

Attention : forcer `SHORTAPPS_LOCAL_IP` change l'adresse affichee dans l'app,
mais ne rend pas automatiquement le serveur WSL accessible sur l'IP Wi-Fi
Windows. Pour tester depuis un telephone, le plus simple est de lancer le projet
directement depuis PowerShell Windows. Sinon, il faut ajouter une redirection de
port Windows et autoriser le port dans le pare-feu.

## Build et serveur local

```bash
npm run build
npm run serve:local
```

La meme variable `SHORTAPPS_LOCAL_IP` peut etre utilisee avec `serve:local`.
Le nom affiche sur le telephone peut aussi etre force avec `SHORTAPPS_PC_NAME`.

`server/local-server.js` sert le build sur le port `56321`, demarre le HTTPS
mobile sur `56322`, expose `/api/status` et `/api/auth/*`, detecte
dynamiquement les IP privees du PC, puis refuse les clients qui ne sont pas sur
un sous-reseau local autorise ou sur le reseau Tailscale autorise.

En version 1.7, le serveur ecoute sur `0.0.0.0` afin de pouvoir repondre sur
toutes les interfaces actives de la machine. L'ecran Parametres permet ensuite
de choisir :

- `Toutes les IP` : toutes les interfaces LAN privees sont annoncees ;
- `Selection` : seules les interfaces cochees sont annoncees et autorisees ;
- l'interface primaire utilisee par l'adresse affichee et le lien mobile.

`/api/status` renvoie aussi `interfaces`, `exposedInterfaces`, `exposedUrls` et
`networkExposure` pour que l'interface puisse afficher par exemple les URLs
`192.168.51.81`, `192.168.0.55` ou `172.17.160.1` si Windows les expose.

Le certificat HTTPS local est genere avec toutes les IP LAN detectees au
demarrage. Si une nouvelle interface apparait apres le lancement de ShortApps,
relancez l'application pour regenerer le certificat avec cette nouvelle IP.

Important pour iOS : le certificat HTTPS local genere par ShortApps est auto-signe.
Il aide au developpement local, mais il n'est pas suffisant pour une webapp iOS
propre sans action manuelle de confiance sur l'iPhone.

Depuis la version 1.7, le chemin recommande est Tailscale :

1. installer Tailscale sur le PC et l'iPhone ;
2. activer Tailscale Serve pour exposer `http://127.0.0.1:56321` en HTTPS sur
   le nom Tailscale du PC ;
3. renseigner l'URL `https://<pc>.<tailnet>.ts.net` dans ShortApps ;
4. definir le mot de passe mobile dans l'ecran Parametres.

Le PC n'a aucun port entrant ouvert sur Internet. Tailscale garde le trafic dans
le reseau prive du tailnet et peut utiliser une connexion directe quand les deux
appareils sont sur le meme reseau.

Si vous possedez deja un certificat public pour ce domaine, ShortApps peut
l'utiliser directement au demarrage :

```powershell
$env:SHORTAPPS_TLS_CERT="C:\certs\shortapps.crt"
$env:SHORTAPPS_TLS_KEY="C:\certs\shortapps.key"
ShortApps.exe
```

Un fichier PFX est aussi supporte avec `SHORTAPPS_TLS_PFX` et, si besoin,
`SHORTAPPS_TLS_PASSPHRASE`.

### Pistes HTTPS sans exposer le PC a Internet

Option recommandee simple : Tailscale + Tailscale Serve. La configuration du
certificat est geree par Tailscale, le PC n'est pas expose directement, et la
latence reste basse quand la connexion est directe.

Option basse latence avancee : domaine public + certificat Let's Encrypt DNS-01
+ DNS local. Le certificat est public et valide pour iOS, mais le domaine resout
vers l'IP privee du PC seulement sur le LAN. Aucun port du PC n'est ouvert sur
Internet.

Option tres robuste : VPN mesh type Tailscale, WireGuard ou ZeroTier. L'iPhone
et le PC sont dans un reseau prive chiffre. Le domaine ou le nom interne pointe
vers l'IP VPN. Aucun port entrant n'est ouvert sur la box, mais l'iPhone doit
avoir le VPN actif.

Option proxy sortant : Cloudflare Tunnel, ngrok, ou VPS avec tunnel WireGuard.
Le PC initie une connexion sortante vers le relais, puis le relais expose une
URL HTTPS publique. Le PC n'est pas directement expose, mais la latence passe
par le relais et il faut renforcer l'authentification avant usage hors LAN.

Option locale controlee : installer une autorite de certification privee sur
l'iPhone et signer le certificat local ShortApps avec cette autorite. C'est
efficace pour un petit nombre d'appareils de confiance, mais moins pratique et
moins propre qu'un certificat public.

`/api/status` renvoie aussi le nom reel de la machine (`pcName`) ; l'en-tete du
telephone dans l'interface utilise cette valeur.

`/api/config` partage la configuration entre l'interface Windows et la webapp
telephone. Les changements de pages, raccourcis, fonds, exposition reseau et URL
mobile HTTPS sont ecrits
dans `data/shortapps-config.json`, puis relus par `/mobile`.

La webapp mobile demande le mot de passe configure dans l'interface Windows.
Apres connexion, le telephone recoit une session locale temporaire stockee dans
le navigateur. `/api/config`, `/api/apps/launch` et `/api/keyboard` refusent les
clients mobiles non authentifies. Les endpoints de scan et de validation des
applications restent reserves a la console Windows pour ne pas exposer la liste
des logiciels installes.

En version 1.7, l'ecran Parametres permet aussi de renseigner une URL mobile
HTTPS, par exemple `https://moodbeast.tailnet-name.ts.net`. Si elle est valide,
le bouton de copie utilise cette URL a la place de l'adresse IP locale.

`/api/apps/scan` est dynamique sur Windows et reserve a l'interface PC. Il scanne :

- les raccourcis `.lnk` du menu Demarrer utilisateur et global ;
- les raccourcis du Bureau utilisateur et global ;
- les entrees du registre de desinstallation Windows ;
- les chemins `.exe`, arguments, dossiers de travail et emplacements d'icones
  quand Windows les fournit.

La version 1.7 extrait aussi les logos Windows disponibles sous forme de
PNG base64 (`iconDataUrl`). L'interface les affiche automatiquement sur le
dashboard et la webapp mobile. Si aucune icone exploitable n'est disponible,
ShortApps conserve le rendu par initiales et degrade.

Dans WSL/Linux, l'endpoint repond `WINDOWS_ONLY` et l'interface conserve les
applications de demonstration.

`/api/apps/launch` tente de lancer l'application demandee depuis la webapp
telephone. Dans WSL/Linux, il repond aussi `WINDOWS_ONLY`. Sur Windows, les
executables `.exe` valides sont lances directement via Node.js pour reduire la
latence ; PowerShell reste utilise comme fallback et pour les cibles `shell:` ou
web.

`/api/keyboard` utilise un worker PowerShell persistant sur Windows afin de
charger `user32.dll` une seule fois et d'envoyer les touches du pave numerique
avec une latence beaucoup plus basse qu'un PowerShell lance a chaque appui.

## Signature Windows

Pour que l'EXE soit reconnu comme plus legitime par Windows, il faut signer
`ShortApps.exe` avec un certificat de signature de code emis par une autorite de
certification reconnue, ou utiliser Microsoft Trusted Signing. Une signature
standard reduit les avertissements et prouve l'editeur ; la reputation
SmartScreen se construit ensuite progressivement avec les telechargements et les
installations.

Script fourni :

```powershell
$env:SHORTAPPS_SIGN_PFX="C:\certs\shortapps-code-signing.pfx"
$env:SHORTAPPS_SIGN_PASSWORD="mot-de-passe"
npm run package:win:signed
```

Si le certificat est deja dans le magasin Windows :

```powershell
$env:SHORTAPPS_SIGN_CERT_SHA1="THUMBPRINT_DU_CERTIFICAT"
npm run package:win:signed
```

Le script utilise `signtool.exe`, fourni par le Windows SDK, et applique un
horodatage SHA-256.

## Package Windows

```bash
npm run package:win
```

Le package Electron Windows est genere dans `release/ShortApps-win32-x64`. Les
archives ZIP de version sont stockees localement dans `versioning/` et publiees
comme assets GitHub Release, pas dans l'historique Git.
