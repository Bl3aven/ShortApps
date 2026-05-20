# ShortApps V0.9.2

Hotfix de preproduction pour corriger le blocage au demarrage de l'interface
Windows.

## Corrections

- L'interface Windows n'attend plus la generation HTTPS locale avant de
  s'ouvrir.
- Le serveur HTTP local demarre en priorite, puis HTTPS est initialise en
  arriere-plan.
- Lorsque le service ShortApps est deja lance et occupe le port local, la
  console attend que `/api/status` reponde avant de charger l'interface.
- Si le serveur local ne devient pas disponible, une page d'erreur explicite
  est affichee au lieu de rester bloquee sur l'ecran de demarrage.

## Package

Archive Windows x64 :

- `ShortApps-V0.9.2-win32-x64.zip`
- SHA256 : `c8f4cc50ef04c07273ab813574f9ae65610ba43a9273fb63a8a9d33bcf75f87f`
