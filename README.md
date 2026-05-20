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
un sous-reseau local autorise ou sur un tunnel hub authentifie.

En version 1.8, le serveur ecoute sur `0.0.0.0` afin de pouvoir repondre sur
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

Depuis la version 1.8, le chemin recommande est le hub ShortApps auto-heberge :

1. pointer `shortapps.tournayre.ovh` vers la VM Debian publique ;
2. lancer `hub/setup-debian.sh` sur la VM pour installer Nginx, Certbot,
   UFW, fail2ban, unattended-upgrades et le service `shortapps-hub` ;
3. configurer dans ShortApps l'URL `https://shortapps.tournayre.ovh`,
   l'ID machine et le secret hub ;
4. definir le mot de passe mobile dans l'ecran Parametres ;
5. ouvrir `https://shortapps.tournayre.ovh` depuis le telephone, saisir
   l'ID machine et le mot de passe.

Le PC n'a aucun port entrant ouvert sur Internet. Il ouvre uniquement une
connexion WebSocket sortante vers la VM. Le hub relaie ensuite le navigateur du
telephone vers le PC distant via ce tunnel.

Installer le hub sur Debian :

```bash
export SHORTAPPS_DOMAIN=shortapps.tournayre.ovh
export LETSENCRYPT_EMAIL=admin@tournayre.ovh
export SHORTAPPS_HUB_REGISTRATION_SECRET="$(openssl rand -base64 48)"
sudo -E bash hub/setup-debian.sh
```

Conservez `SHORTAPPS_HUB_REGISTRATION_SECRET` : ce meme secret doit etre saisi
dans ShortApps cote PC pour autoriser l'enregistrement de la machine sur le hub.
Le mot de passe mobile, lui, reste verifie par le PC via `/api/auth/login` et
n'est pas stocke par le hub.

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

Option recommandee controlee : VM Debian + Nginx + Let's Encrypt + tunnel
WebSocket sortant. La VM est publique, verrouillee, et controle les flux. Le PC
reste prive et ne fait qu'initier une connexion sortante.

Option simple alternative : Tailscale + Tailscale Serve. La configuration du
certificat est geree par Tailscale, le PC n'est pas expose directement, mais le
trafic depend du tailnet.

Option basse latence avancee : domaine public + certificat Let's Encrypt DNS-01
+ DNS local. Le certificat est public et valide pour iOS, mais le domaine resout
vers l'IP privee du PC seulement sur le LAN. Aucun port du PC n'est ouvert sur
Internet.

Option tres robuste : VPN mesh type Tailscale, WireGuard ou ZeroTier. L'iPhone
et le PC sont dans un reseau prive chiffre. Le domaine ou le nom interne pointe
vers l'IP VPN. Aucun port entrant n'est ouvert sur la box, mais l'iPhone doit
avoir le VPN actif.

Option proxy sortant tiers : Cloudflare Tunnel ou ngrok. Le PC initie une
connexion sortante vers le relais, puis le relais expose une URL HTTPS publique.
Le PC n'est pas directement expose, mais le flux sort de votre infrastructure.

Option locale controlee : installer une autorite de certification privee sur
l'iPhone et signer le certificat local ShortApps avec cette autorite. C'est
efficace pour un petit nombre d'appareils de confiance, mais moins pratique et
moins propre qu'un certificat public.

## Hub distant

Le hub est compose de deux pieces :

- `hub/server.js` sur la VM Debian : ecoute seulement en local sur
  `127.0.0.1:8080`, derriere Nginx en HTTPS ;
- `server/hub-client.js` cote PC : ouvre un WebSocket sortant vers
  `/tunnel/pc` avec l'ID machine et le secret hub.

Flux d'authentification :

1. Le PC se connecte au hub avec son ID machine et le secret hub.
2. Le telephone ouvre `https://shortapps.tournayre.ovh`.
3. Le hub affiche une page de login avec `ID machine` et `mot de passe`.
4. Le hub transmet le mot de passe au PC via le tunnel sur `/api/auth/login`.
5. Si le PC accepte, le hub cree une session HTTPOnly et relaie `/mobile`,
   `/assets/*`, `/api/config`, `/api/apps/launch` et `/api/keyboard`.

Le secret hub autorise seulement l'enregistrement du PC sur le relais. Le mot
de passe utilisateur reste cote PC et le hub ne conserve que la session
temporaire necessaire au relayage.

Le script `hub/setup-debian.sh` installe :

- Nginx en frontal HTTPS ;
- Certbot avec challenge webroot Let's Encrypt ;
- service systemd `shortapps-hub` execute par un utilisateur systeme dedie ;
- UFW avec ports entrants limites a SSH, HTTP et HTTPS ;
- fail2ban et unattended-upgrades ;
- en-tetes de securite Nginx, HSTS, rate limit sur `/hub/login`.

`/api/status` renvoie aussi le nom reel de la machine (`pcName`) ; l'en-tete du
telephone dans l'interface utilise cette valeur.

`/api/config` partage la configuration entre l'interface Windows et la webapp
telephone. Les changements de pages, raccourcis, fonds, exposition reseau et URL
mobile HTTPS/hub sont ecrits
dans `data/shortapps-config.json`, puis relus par `/mobile`.

La webapp mobile demande le mot de passe configure dans l'interface Windows.
Apres connexion, le telephone recoit une session locale temporaire stockee dans
le navigateur. `/api/config`, `/api/apps/launch` et `/api/keyboard` refusent les
clients mobiles non authentifies. Les endpoints de scan et de validation des
applications restent reserves a la console Windows pour ne pas exposer la liste
des logiciels installes.

En version 1.8, l'ecran Parametres permet aussi de configurer le hub distant :
URL HTTPS du hub, ID machine et secret de connexion hub. Quand le hub est actif,
le bouton de copie utilise l'URL hub avec l'ID machine en preselection.

`/api/apps/scan` est dynamique sur Windows et reserve a l'interface PC. Il scanne :

- les raccourcis `.lnk` du menu Demarrer utilisateur et global ;
- les raccourcis du Bureau utilisateur et global ;
- les entrees du registre de desinstallation Windows ;
- les chemins `.exe`, arguments, dossiers de travail et emplacements d'icones
  quand Windows les fournit.

La version 1.8 extrait aussi les logos Windows disponibles sous forme de
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
