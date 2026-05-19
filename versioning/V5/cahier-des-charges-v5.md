# Cahier des charges corrige - ShortApps V5

Date de gel : 19 mai 2026
Version applicative : 5.0.0
Livrable : `ShortApps-V5-win32-x64.zip`

## 1. Objectif de la V5

La V5 conserve la V4 comme base multi-reseau et ajoute deux axes prioritaires :

* reduire fortement la latence des actions depuis le telephone ;
* recuperer automatiquement les logos des applications Windows lorsque c'est
  possible.

## 2. Latence faible

Le pave numerique ne doit plus demarrer un processus PowerShell a chaque touche.

La V5 introduit un worker PowerShell persistant :

* chargement de `user32.dll` une seule fois ;
* reception des commandes clavier via stdin ;
* queue de commandes cote Node.js ;
* fallback PowerShell ponctuel si le worker echoue ;
* activation automatique de NumLock conservee.

Les actions attendues sont :

* `down` ;
* `up` ;
* `press`.

Le lancement d'une application `.exe` valide est egalement optimise :

* lancement direct via `child_process.spawn()` ;
* fallback PowerShell uniquement si le lancement direct echoue ;
* conservation de PowerShell pour les cibles `http(s)://` et `shell:`.

## 3. Webapp mobile plus reactive

La webapp mobile envoie les commandes avec :

* `cache: no-store` ;
* `keepalive: true` ;
* lancement des raccourcis au `pointerup` plutot qu'au `click`.

L'interface conserve le retour visuel immediat et le retour haptique lorsque le
navigateur le supporte.

## 4. Recuperation automatique des logos

Le scan Windows extrait maintenant une image PNG de l'icone associee a
l'application :

* icone definie dans le raccourci `.lnk` ;
* icone extraite de l'executable cible ;
* icone issue de `DisplayIcon` dans le registre Windows ;
* cache d'icones pendant le scan pour eviter les extractions redondantes.

Chaque application detectee peut contenir :

* `iconPath` ;
* `iconSource` ;
* `iconDataUrl`.

`iconDataUrl` est une image PNG encodee en base64, directement utilisable par
l'interface desktop et la webapp mobile.

## 5. Affichage des logos

Si une application possede `iconDataUrl` et utilise le mode visuel `Icône`,
l'interface affiche le logo Windows extrait automatiquement.

Si aucune icone n'est disponible, ShortApps conserve le rendu precedent avec les
initiales et le degrade de couleur.

Le mode `Texte central` reste prioritaire et n'affiche pas le logo, conformement
a la regle :

* logo seul autorise ;
* texte seul autorise ;
* logo + texte central dans la zone principale interdit.

## 6. Validation V5

La V5 est valide si :

* le build et le lint passent ;
* le package Windows contient le worker clavier persistant ;
* le scan Windows renvoie `iconDataUrl` quand une icone est exploitable ;
* les icones extraites s'affichent sur le dashboard et sur la webapp mobile ;
* les chiffres du pave numerique passent par le worker persistant ;
* les `.exe` valides sont lances directement sans PowerShell quand possible ;
* les fonctions V4 restent presentes : multi-IP, selection de reseaux, HTTPS et
  QR Code.
