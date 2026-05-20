# ShortApps V1.8

Version orientee hub auto-heberge.

## Contenu

- Ajout d'un hub Node.js pour VM Debian exposee en HTTPS derriere Nginx.
- Ajout du script `hub/setup-debian.sh` pour Certbot, Nginx, UFW, fail2ban,
  unattended-upgrades et service systemd.
- Ajout d'un tunnel WebSocket sortant depuis le PC vers le hub.
- Ajout des parametres PC : URL du hub, ID machine et secret hub.
- Login telephone via `ID machine + mot de passe`.
- Le mot de passe est verifie par le PC distant via le tunnel.
- Le hub relaie `/mobile`, les assets et les APIs ShortApps apres connexion.

## DNS cible

```text
shortapps.tournayre.ovh -> 82.64.183.247
```

## Installation VM

```bash
export SHORTAPPS_DOMAIN=shortapps.tournayre.ovh
export LETSENCRYPT_EMAIL=admin@tournayre.ovh
export SHORTAPPS_HUB_REGISTRATION_SECRET="$(openssl rand -base64 48)"
sudo -E bash hub/setup-debian.sh
```

Le secret genere doit etre recopie dans ShortApps cote PC.

## Securite

- Le hub ecoute en local sur `127.0.0.1:8080`.
- Nginx termine le TLS avec un certificat Let's Encrypt.
- Le PC n'ouvre pas de port entrant.
- Le PC s'enregistre avec un secret hub long.
- La page telephone demande l'ID machine et le mot de passe ShortApps.
- Le hub ne stocke pas le mot de passe machine.

## Package

Archive Windows x64 :

- `ShortApps-V1.8-win32-x64.zip`
- SHA256 : `92e9da7fcf54f0a669a7ab960b696f96761b7beeb47e5c834b07392bf193d81d`
