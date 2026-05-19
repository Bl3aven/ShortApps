# ShortApps V1.7

Version orientee Tailscale et mot de passe mobile.

## Contenu

- Suppression de l'appairage QR Code et des jetons `pair/code`.
- Ajout d'un mot de passe mobile configure depuis l'interface Windows.
- Ajout d'un ecran de connexion dans la webapp mobile.
- Protection de `/api/config`, `/api/apps/launch` et `/api/keyboard` par session.
- Reservation du scan et de la validation des applications a la console Windows.
- Detection des interfaces Tailscale en `100.64.0.0/10`.
- Champ URL mobile destine a l'URL HTTPS Tailscale Serve.
- Conservation du scan Windows, des icones automatiques, du pave numerique et
  du retour haptique.

## Package

Archive Windows x64 :

- `ShortApps-V1.7-win32-x64.zip`
- SHA256 : `78b83541c4c02ca477deeb323d3cd41c600c75f87f6d9261787194ac2f72760c`

## Mode recommande

1. Installer Tailscale sur le PC et l'iPhone.
2. Configurer Tailscale Serve pour exposer le serveur ShortApps local en HTTPS.
3. Copier l'URL `https://<pc>.<tailnet>.ts.net` dans ShortApps.
4. Definir le mot de passe mobile depuis Parametres.
5. Ouvrir l'URL depuis l'iPhone et saisir le mot de passe.

Ce mode evite de deployer ou renouveler manuellement des certificats tout en
evitant l'exposition directe du PC sur Internet.
