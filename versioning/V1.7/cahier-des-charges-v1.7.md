# ShortApps V1.7 - Tailscale et mot de passe mobile

## Objectif

La V1.7 remplace l'appairage par QR Code par une authentification plus simple :
un mot de passe configure cote application Windows. L'acces reseau privilegie
devient Tailscale afin d'obtenir une URL HTTPS exploitable sur iOS sans exposer
directement le PC local a Internet.

## Fonctionnement attendu

1. L'utilisateur lance ShortApps sur Windows.
2. L'utilisateur configure un mot de passe mobile dans Parametres.
3. L'utilisateur configure Tailscale Serve pour exposer ShortApps en HTTPS sur
   le nom Tailscale du PC.
4. L'utilisateur renseigne cette URL HTTPS dans ShortApps.
5. Le telephone ouvre `/mobile`, saisit le mot de passe et obtient une session.
6. Les raccourcis et le pave numerique envoient leurs actions au PC uniquement
   avec cette session valide.

## Securite V1.7

- Suppression des jetons QR `pair/code`.
- Plus de registre d'appareils appaires.
- Mot de passe stocke cote serveur sous forme de hash `scrypt` avec sel.
- Sessions mobiles temporaires en memoire serveur.
- `/api/config`, `/api/apps/launch` et `/api/keyboard` refusent les clients
  mobiles non authentifies.
- `/api/apps/scan` et `/api/apps/validate` restent reserves a la console PC.
- La configuration du mot de passe reste reservee a l'interface Windows locale.
- Les interfaces Tailscale `100.64.0.0/10` sont reconnues comme reseau autorise.

## Tailscale

Tailscale devient la solution recommandee pour simplifier le HTTPS iOS :

- pas de certificat a deployer manuellement dans ShortApps ;
- pas d'ouverture de port sur la box ;
- URL HTTPS stable sur le tailnet ;
- connexion directe possible entre le PC et le telephone quand le reseau le
  permet ;
- fallback relais possible via Tailscale si la connexion directe echoue.

L'URL cible a renseigner dans ShortApps doit ressembler a :

```text
https://moodbeast.tailnet-name.ts.net
```

Le service local ShortApps reste disponible sur :

```text
http://127.0.0.1:56321
```

Tailscale Serve se charge de presenter l'URL HTTPS cote telephone et de relayer
vers le serveur local.

## Interface

L'ecran Parametres contient :

- URL mobile HTTPS, prevue pour Tailscale Serve ;
- copie/ouverture du lien mobile ;
- configuration du mot de passe mobile ;
- etat "mot de passe configure" ;
- exposition reseau.

La webapp mobile contient :

- ecran de connexion ;
- message si aucun mot de passe n'est configure ;
- dashboard apres connexion ;
- pave numerique apres connexion.

## References

- Tailscale Serve : https://tailscale.com/kb/1242/tailscale-serve
- Tailscale HTTPS certificates : https://tailscale.com/kb/1153/enabling-https
- W3C Secure Contexts : https://www.w3.org/TR/secure-contexts/
