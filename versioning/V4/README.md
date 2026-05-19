# ShortApps V4

Version construite sur la base V3.1.

## Contenu

* `ShortApps-V4-win32-x64.zip` : package Windows complet.
* `cahier-des-charges-v4.md` : cahier des charges corrige correspondant a cette version.

## Points principaux

* Detection dynamique de toutes les interfaces LAN privees du PC.
* Exposition de la webapp mobile sur toutes les IP locales disponibles.
* Mode `Selection` pour limiter l'acces a un ou plusieurs reseaux.
* Choix de l'interface primaire utilisee par le QR Code.
* Certificat HTTPS genere avec toutes les IP locales detectees au demarrage.
* `/api/status` enrichi avec `interfaces`, `exposedInterfaces`, `exposedUrls` et `networkExposure`.

## Note HTTPS

Le certificat HTTPS reste local et auto-signe. Sur iPhone, il peut etre necessaire
d'accepter ou d'installer le certificat comme certificat de confiance avant
d'ajouter la webapp a l'ecran d'accueil.

## Empreinte

```text
SHA256  dfc98c7e4fe2562862d78d5e7a5ee1997517146dd0ed046b003ec8763b77abd3  ShortApps-V4-win32-x64.zip
```
