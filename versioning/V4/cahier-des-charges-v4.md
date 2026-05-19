# Cahier des charges corrige - ShortApps V4

Date de gel : 19 mai 2026
Version applicative : 4.0.0
Livrable : `ShortApps-V4-win32-x64.zip`

## 1. Objectif de la V4

La V4 conserve la V3.1 comme base stable et corrige le point bloquant de
l'exposition reseau lorsque le PC possede plusieurs interfaces actives.

L'application doit pouvoir :

* detecter toutes les interfaces LAN privees du PC ;
* exposer la webapp mobile sur toutes les IP locales disponibles ;
* permettre de limiter l'acces a une selection d'interfaces reseau ;
* choisir l'interface primaire utilisee par le QR Code ;
* afficher les URLs utilisables pour chaque reseau.

## 2. Detection multi-reseau

Le backend detecte dynamiquement les interfaces IPv4 privees non internes :

* `192.168.x.x` ;
* `10.x.x.x` ;
* `172.16.x.x` a `172.31.x.x`.

Chaque interface expose :

* un identifiant stable ;
* son nom Windows ;
* son type probable : Ethernet, Wi-Fi, Virtuel, Bluetooth ou Reseau ;
* son adresse IPv4 ;
* son masque ou CIDR ;
* son URL HTTP ;
* son URL HTTPS.

## 3. Mode d'exposition

Deux modes sont disponibles depuis les parametres :

* `Toutes les IP` : toutes les interfaces LAN privees detectees sont annoncees
  et autorisees ;
* `Selection` : seules les interfaces choisies sont annoncees et autorisees.

Le serveur continue d'ecouter sur `0.0.0.0` pour rester accessible sur les
interfaces actives, mais le filtrage applicatif bloque les clients qui ne sont
pas sur les sous-reseaux autorises.

## 4. Interface primaire et QR Code

L'utilisateur peut choisir une interface primaire.

Cette interface primaire sert a generer :

* l'adresse locale affichee ;
* l'URL mobile principale ;
* le lien du QR Code d'appairage.

Exemple :

* telephone sur le Wi-Fi `192.168.0.x` : choisir l'interface `192.168.0.55` ;
* telephone sur le reseau Ethernet `192.168.51.x` : choisir l'interface
  `192.168.51.81`.

## 5. HTTPS multi-IP

Le certificat HTTPS local est genere avec toutes les IP LAN detectees au
demarrage.

Cela permet d'utiliser le meme serveur HTTPS sur plusieurs URLs locales :

```text
https://192.168.0.55:56322/mobile
https://192.168.51.81:56322/mobile
https://172.17.160.1:56322/mobile
```

Limite connue : si une nouvelle interface apparait apres le demarrage, il peut
etre necessaire de relancer ShortApps pour regenerer le certificat avec cette
nouvelle IP.

## 6. API statut V4

`GET /api/status` renvoie maintenant :

* `interfaces` : toutes les interfaces LAN privees detectees ;
* `exposedInterfaces` : les interfaces annoncees et autorisees ;
* `exposedUrls` : les URLs utilisables ;
* `networkExposure` : mode actif, interfaces selectionnees et interface
  primaire ;
* `listenHost` : `0.0.0.0`.

## 7. Securite locale

La securite reste locale :

* acces limite aux sous-reseaux LAN autorises ;
* appareil appaire via QR Code ;
* parametres `pair` et `code` verifies pour `/mobile` et `/api/config` ;
* possibilite de revoquer les appareils.

Un client connecte a un reseau non selectionne recoit `LOCAL_NETWORK_ONLY`.

## 8. Validation V4

La V4 est valide si :

* l'application Windows demarre ;
* l'interface desktop reste disponible sur `127.0.0.1:56321` ;
* `/api/status` liste plusieurs interfaces quand Windows en expose plusieurs ;
* le QR Code utilise l'interface primaire choisie ;
* la webapp mobile est disponible en HTTPS sur les IP exposees ;
* le mode `Selection` limite bien les reseaux autorises ;
* les fonctions V3 restent presentes : validation des raccourcis, lancement
  des applications, pave numerique, HTTPS et haptique quand supporte.
