# ShortApps V6

Version propre basee sur la V5.

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

## Package

Archive Windows x64 :

- `ShortApps-V6-win32-x64.zip`
- SHA256 : `9c12c9bc7f48975f8ffd992d4e1cf5b0582ffedc0592898db263abfd55f1cbac`

## Strategie HTTPS iOS

Le meilleur choix basse latence est un domaine avec certificat public qui pointe
vers l'IP LAN du PC. Le telephone utilise donc HTTPS valide sans passer par un
proxy Internet.

Un proxy/VPS sera utile plus tard pour l'acces hors reseau local, mais il ajoute
de la latence et demandera une authentification plus forte.
