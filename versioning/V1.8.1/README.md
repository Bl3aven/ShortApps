# ShortApps V1.8.1

Version corrective de la V1.8 orientee hub auto-heberge.

## Contenu

- Ajout d'un bouton explicite `Activer et enregistrer` dans les parametres du
  hub distant.
- Ajout du bouton `Desactiver le hub`.
- Validation des champs obligatoires avant activation : URL HTTPS, ID machine
  et secret hub.
- Relecture immediate de la configuration par le client hub apres
  enregistrement backend.
- Rafraichissement regulier de l'etat du hub dans l'interface Windows.
- Durcissement du script Debian : fail2ban force sur backend systemd et
  retrait d'une contrainte systemd incompatible avec Node.js.

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

Le secret genere doit etre recopie dans ShortApps cote PC, dans
`Parametres > Hub distant`, puis valide avec `Activer et enregistrer`.

## Package

Archive Windows x64 :

- `ShortApps-V1.8.1-win32-x64.zip`
- SHA256 : `b1f788967a10cfe716d2e16a895b8419362912cb54cc3a50759db451d45e36fb`
