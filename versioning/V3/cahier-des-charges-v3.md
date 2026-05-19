# Cahier des charges corrige - ShortApps V3

Date de gel : 19 mai 2026
Version applicative : 3.0.0
Livrable : `ShortApps-V3-win32-x64.zip`

## 1. Objectif de la V3

La V3 conserve la V2 comme base fonctionnelle et ajoute une couche de fiabilisation.

Les priorites de cette version sont :

* rendre l'acces mobile compatible avec une installation webapp via HTTPS ;
* verifier les raccourcis avant lancement ;
* eviter les executables incorrects ou suspects ;
* corriger les chiffres du pave numerique ;
* ameliorer le style et le retour tactile du pave numerique.

## 2. HTTPS local

L'application demarre deux serveurs locaux :

* interface desktop Electron : `http://127.0.0.1:56321` ;
* interface mobile HTTPS : `https://<ip-locale-du-pc>:56322`.

Le QR Code d'appairage doit pointer vers l'adresse HTTPS.

L'API `/api/status` expose :

* `localUrl` en HTTPS ;
* `httpUrl` pour le serveur desktop local ;
* `httpsUrl` pour le telephone ;
* `port` ;
* `httpsPort` ;
* `httpsAvailable`.

Le certificat HTTPS est genere localement.

Limite connue : sur iPhone, un certificat local auto-signe peut devoir etre accepte ou installe comme certificat de confiance. Une future version pourra prevoir un relais/proxy securise ou un domaine avec certificat public.

## 3. Webapp mobile

La webapp mobile est servie en plein ecran.

Un manifest webapp est present pour favoriser l'ajout a l'ecran d'accueil.

Le manifest ne force pas de `start_url` fixe afin de conserver l'URL d'appairage scannee avec ses parametres `pair` et `code`.

## 4. Verification des raccourcis

La V3 ajoute une verification serveur des cibles d'applications.

Un raccourci est considere valide si :

* il pointe vers une URL `http://` ou `https://` ;
* il pointe vers une cible `shell:` ;
* il pointe vers un fichier `.exe` existant sur Windows.

Un raccourci est considere invalide si :

* aucune cible n'est renseignee ;
* le fichier n'existe pas ;
* la cible n'est pas un `.exe` ;
* la cible ressemble a un desinstalleur, installeur, updater, service ou outil de maintenance.

## 5. Endpoint de validation

La V3 expose :

```text
POST /api/apps/validate
```

Cet endpoint peut verifier :

* une application ;
* une liste d'applications.

L'onglet Applications propose un bouton `Verifier`.

L'interface signale les raccourcis invalides pour eviter les coquilles avant de les utiliser depuis le telephone.

## 6. Lancement des applications

Avant chaque lancement, le backend valide la cible.

Si la cible est invalide, le lancement est bloque et une reponse d'erreur est renvoyee.

Sur Windows, le lancement utilise toujours PowerShell et `Start-Process`.

## 7. Scan Windows

Le scan Windows conserve les sources V2 :

* menu Demarrer ;
* Bureau ;
* registre Windows.

La V3 renforce le filtrage pour eviter :

* `uninstall.exe` ;
* `setup.exe` ;
* `install.exe` ;
* `update.exe` ;
* `updater.exe` ;
* executables de maintenance, crash report, service ou bootstrap.

## 8. Pave numerique

Le pave numerique conserve les touches :

* `0` a `9` ;
* `.` ;
* `/` ;
* `*` ;
* `-` ;
* `+` ;
* `Entrer`.

Correction V3 :

* les chiffres utilisent toujours les touches du pave numerique Windows ;
* le backend active automatiquement NumLock avant d'envoyer un chiffre ou le point decimal ;
* l'appui long conserve le fonctionnement `down` puis `up`.

## 9. Style du pave numerique

Les boutons du pave numerique doivent avoir un rendu plus moderne :

* glassmorphism ;
* profondeur ;
* ombre douce ;
* reflet interne ;
* animation d'enfoncement ;
* bouton `Entrer` plus accentue.

## 10. Retour haptique

La V3 appelle `navigator.vibrate()` sur les pressions tactiles lorsque le navigateur le supporte.

Limite connue : iOS Safari ne prend generalement pas en charge l'API Vibration. Sur iPhone, le retour haptique peut donc rester indisponible malgre l'implementation. Dans ce cas, l'application conserve un retour visuel par animation.

## 11. Validation V3

La V3 est valide si :

* l'application Windows se lance ;
* l'interface desktop reste accessible localement ;
* l'interface mobile est disponible en HTTPS ;
* le QR Code fournit une URL HTTPS ;
* les raccourcis sont verifies avant lancement ;
* les chiffres du pave numerique fonctionnent avec NumLock force ;
* le style du pave numerique est modernise ;
* le package Windows contient les nouveaux modules serveur.
