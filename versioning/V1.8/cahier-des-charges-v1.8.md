# ShortApps V1.8 - Hub auto-heberge

## Objectif

La V1.8 remplace l'option principale Tailscale par un hub controle par
l'utilisateur. Le domaine `shortapps.tournayre.ovh` pointera vers la VM Debian
publique `82.64.183.247`. Les telephones se connectent au hub en HTTPS, et le
PC distant conserve uniquement une connexion sortante vers ce hub.

## Architecture

1. VM Debian publique :
   - Nginx expose les ports 80 et 443.
   - Certbot recupere et renouvelle le certificat Let's Encrypt.
   - `shortapps-hub` ecoute uniquement sur `127.0.0.1:8080`.
2. PC Windows :
   - ShortApps lance le serveur local.
   - ShortApps ouvre un tunnel WebSocket sortant vers le hub.
   - Le PC s'enregistre avec un ID machine et un secret hub.
3. Telephone :
   - ouvre `https://shortapps.tournayre.ovh`.
   - saisit `ID machine + mot de passe`.
   - utilise la webapp mobile relayee par le hub.

## Authentification

- Le secret hub autorise uniquement l'enregistrement du PC sur le hub.
- Le mot de passe mobile reste configure dans ShortApps cote PC.
- Le hub transmet le mot de passe au PC sur `/api/auth/login`.
- Si le PC valide le mot de passe, le hub cree une session HTTPOnly.
- Les requetes mobile suivantes sont relayees avec le jeton de session PC.

## Securite VM Debian

Le script `hub/setup-debian.sh` doit :

- installer Nginx, Certbot, Node.js, npm, UFW, fail2ban et unattended-upgrades ;
- creer un utilisateur systeme `shortapps-hub` ;
- stocker le secret hub dans `/etc/shortapps-hub.env` en permission `0600` ;
- limiter les ports entrants a SSH, HTTP et HTTPS ;
- activer fail2ban et les mises a jour automatiques ;
- installer un service systemd `shortapps-hub` avec durcissement systemd ;
- utiliser Nginx en reverse proxy WebSocket ;
- appliquer HSTS et un rate limit sur `/hub/login`.

## Endpoints hub

- `GET /` : page de login.
- `POST /hub/login` : login ID machine + mot de passe.
- `GET /hub/logout` : suppression de session.
- `GET /hub/health` : verification locale simple.
- `GET /hub/status` : nombre de machines connectees.
- `GET /mobile` et assets/API : relayes vers le PC authentifie.
- `GET /tunnel/pc` en WebSocket : connexion sortante du PC.

## Contraintes

- Le PC ne doit pas etre expose directement sur Internet.
- Le hub ne doit pas stocker le mot de passe ShortApps.
- Les ports publics de la VM doivent rester limites.
- Le certificat HTTPS doit etre gere automatiquement par Let's Encrypt.
- Le telephone doit pouvoir installer la webapp iOS depuis une URL HTTPS valide.

## References

- Certbot : https://certbot.eff.org/
- Let's Encrypt : https://letsencrypt.org/docs/
- Nginx WebSocket proxying : https://nginx.org/en/docs/http/websocket.html
