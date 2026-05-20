# ShortApps V0.9.2 - Hotfix demarrage

## Objectif

La V0.9.2 corrige le blocage observe au demarrage de l'executable Windows,
notamment lorsque HTTPS local ou le service d'arriere-plan ralentissent la mise
a disposition de l'interface.

## Comportement attendu

- l'ecran de demarrage ne reste pas bloque indefiniment ;
- le serveur HTTP local est disponible rapidement pour la console Windows ;
- HTTPS local est prepare en arriere-plan ;
- si une instance de service utilise deja le port `56321`, l'interface Windows
  attend que le serveur existant reponde ;
- en cas d'echec reel, une page d'erreur explicite est affichee.

## Package

La version Windows V0.9.2 est archivee localement dans :

```text
versioning/V0.9.2/ShortApps-V0.9.2-win32-x64.zip
```

SHA256 :

```text
c8f4cc50ef04c07273ab813574f9ae65610ba43a9273fb63a8a9d33bcf75f87f
```
