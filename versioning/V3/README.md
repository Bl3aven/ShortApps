# ShortApps V3

Version construite sur la base V2.

## Contenu

* `ShortApps-V3-win32-x64.zip` : package Windows complet.
* `ShortApps-V3.1-win32-x64.zip` : correctif de demarrage de la V3.
* `cahier-des-charges-v3.md` : corrections et objectifs V3.

## Points principaux

* Acces mobile en HTTPS local sur le port `56322`.
* Interface desktop conservee en HTTP local sur `127.0.0.1:56321`.
* QR Code mobile pointe vers l'URL HTTPS.
* Verification des raccourcis avant lancement.
* Endpoint de verification globale des applications.
* Correction des touches numeriques du pave via activation automatique de NumLock.
* Style du pave numerique revu avec boutons glass/profondeur.
* Retour haptique via `navigator.vibrate()` quand le navigateur le supporte.

## Empreinte

```text
SHA256  e6e5ccc46464a700ed7c8ae5e8b480032a67256640cafbfaef7b613e5d4abf61  ShortApps-V3-win32-x64.zip
SHA256  63b29cd6b7bb8c0d70c0c54205cb1e14a2631c9f503d1e268902d363c20bbcea  ShortApps-V3.1-win32-x64.zip
```

## Correctif V3.1

La fenetre Electron s'ouvre maintenant immediatement avec un ecran de demarrage.
Le serveur HTTP desktop demarre avant la generation HTTPS.
Si HTTPS ou le certificat echoue, l'interface desktop reste accessible et l'application indique l'erreur via `/api/status`.

## Note HTTPS

Le certificat HTTPS est genere localement par l'application. Sur iPhone, il peut etre necessaire d'accepter ou de faire confiance au certificat local avant d'ajouter la webapp a l'ecran d'accueil.
