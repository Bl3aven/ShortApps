# ShortApps

Prototype React/Vite de l'interface ShortApps : configuration PC, dashboards mobiles,
raccourcis personnalisables, fonds d'ecran, pages, appareils autorises et appairage QR Code.

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
mobile sur `56322`, expose `/api/status` et `/api/pairing`, detecte
dynamiquement les IP privees du PC, puis refuse les clients qui ne sont pas sur
un sous-reseau local autorise.

Depuis la V4, le serveur ecoute sur `0.0.0.0` afin de pouvoir repondre sur
toutes les interfaces actives de la machine. L'ecran Parametres permet ensuite
de choisir :

- `Toutes les IP` : toutes les interfaces LAN privees sont annoncees ;
- `Selection` : seules les interfaces cochees sont annoncees et autorisees ;
- l'interface primaire utilisee par l'adresse affichee et le QR Code.

`/api/status` renvoie aussi `interfaces`, `exposedInterfaces`, `exposedUrls` et
`networkExposure` pour que l'interface puisse afficher par exemple les URLs
`192.168.51.81`, `192.168.0.55` ou `172.17.160.1` si Windows les expose.

Le certificat HTTPS local est genere avec toutes les IP LAN detectees au
demarrage. Si une nouvelle interface apparait apres le lancement de ShortApps,
relancez l'application pour regenerer le certificat avec cette nouvelle IP.

`/api/status` renvoie aussi le nom reel de la machine (`pcName`) ; l'en-tete du
telephone dans l'interface utilise cette valeur.

`/api/config` partage la configuration entre l'interface Windows et la webapp
telephone. Les changements de pages, raccourcis, fonds et appareils sont ecrits
dans `data/shortapps-config.json`, puis relus par `/mobile`.

Le QR Code d'appairage pointe vers `/mobile?pair=...&code=...` afin que le
telephone ouvre directement la webapp locale en plein ecran.
Quand une paire active est enregistree dans la configuration, le serveur local
verifie aussi ces parametres avant de servir `/mobile` et `/api/config` a un
client non-localhost.

`/api/apps/scan` est dynamique sur Windows. Il scanne :

- les raccourcis `.lnk` du menu Demarrer utilisateur et global ;
- les raccourcis du Bureau utilisateur et global ;
- les entrees du registre de desinstallation Windows ;
- les chemins `.exe`, arguments, dossiers de travail et emplacements d'icones
  quand Windows les fournit.

Dans WSL/Linux, l'endpoint repond `WINDOWS_ONLY` et l'interface conserve les
applications de demonstration.

`/api/apps/launch` tente de lancer l'application demandee depuis la webapp
telephone. Dans WSL/Linux, il repond aussi `WINDOWS_ONLY`; sur Windows, il passe
par PowerShell `Start-Process`.

## Package Windows

```bash
npm run package:win
```

Le package Electron Windows est genere dans `release/ShortApps-win32-x64`. Les
archives ZIP de version sont stockees localement dans `versioning/` et publiees
comme assets GitHub Release, pas dans l'historique Git.
