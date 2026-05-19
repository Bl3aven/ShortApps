# ShortApps V1.6

Version propre renommee en V1.6 pour repartir sur un versioning plus naturel.

## Contenu

- Interface allegee : suppression de la page "Appareil" tant qu'elle n'a pas de
  registre serveur reel.
- QR Code mobile conserve et deplace dans les Parametres.
- Champ "URL HTTPS publique ou domaine LAN" pour generer un QR compatible avec
  un domaine HTTPS public.
- Support d'un certificat TLS public fourni via variables d'environnement
  (`SHORTAPPS_TLS_CERT` + `SHORTAPPS_TLS_KEY`, ou `SHORTAPPS_TLS_PFX`).
- Scan Windows, validation executables, lancement d'applications, icones
  automatiques, pave numerique et haptique conserves.
- Exposition reseau multi-interfaces conservee.
- Script de signature Windows via `signtool.exe`.

## Package

Archive Windows x64 :

- `ShortApps-V1.6-win32-x64.zip`
- SHA256 : `9bec0fde3f1941b36369caf101f748a2594360d93ff5c345eadb43a227a62d76`

## HTTPS iOS sans exposition directe

Le choix le plus fiable pour ShortApps est :

1. Domaine public dedie, par exemple `shortapps.example.com`.
2. Certificat public obtenu par DNS-01.
3. DNS local qui resout ce domaine vers l'IP privee du PC.
4. URL `https://shortapps.example.com` renseignee dans ShortApps.

Ce mode donne a iOS un HTTPS valide sans ouvrir de port Internet vers le PC.

Alternatives :

- VPN mesh : Tailscale, WireGuard ou ZeroTier.
- Tunnel sortant : Cloudflare Tunnel, ngrok, ou VPS + WireGuard.
- CA privee installee sur l'iPhone pour un usage strictement personnel.

## Signature Windows

La signature de l'EXE necessite un certificat de code signing reconnu ou
Microsoft Trusted Signing. Le script `scripts/sign-windows.ps1` signe l'EXE avec
un PFX ou un certificat present dans le magasin Windows.
