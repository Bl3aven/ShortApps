# ShortApps V5

Version construite sur la base V4.

## Contenu

* `ShortApps-V5-win32-x64.zip` : package Windows complet.
* `cahier-des-charges-v5.md` : cahier des charges corrige correspondant a cette version.

## Points principaux

* Worker PowerShell persistant pour les touches du pave numerique.
* Lancement direct des executables Windows valides via Node.js.
* Fallback PowerShell conserve pour `shell:`, URL et erreurs de lancement direct.
* Requetes mobiles `no-store` et `keepalive`.
* Extraction automatique des logos Windows en PNG base64 pendant le scan.
* Affichage des logos detectes dans le dashboard et la webapp mobile.
* Conservation du fallback visuel par initiales si aucun logo n'est disponible.

## Empreinte

```text
SHA256  01f84e54374fd40f25cbb036ef6c379c1adc08d5191ffb4a04fa7023bad5ee31  ShortApps-V5-win32-x64.zip
```
