# Cahier des charges corrige - ShortApps V2

Date de gel : 19 mai 2026
Version applicative : 2.0.0
Livrable : `ShortApps-V2-win32-x64.zip`

## 1. Objectif de la V2

ShortApps V2 devient la base fonctionnelle pour la suite du projet.

L'application doit permettre de lancer depuis un telephone des applications installees sur un PC Windows, lorsque le telephone est sur le meme reseau local et autorise par appairage QR Code.

Cette version ajoute aussi un mode pave numerique tactile permettant d'envoyer des touches au PC.

## 2. Architecture retenue

La V2 utilise :

* application Windows : Electron ;
* interface : React + Vite ;
* backend local : Node.js integre ;
* stockage local : fichier JSON ;
* webapp telephone : page responsive servie par le PC ;
* packaging : dossier Windows `ShortApps-win32-x64` archive en ZIP.

Tauri reste une piste possible pour une future version, mais Electron est la base retenue pour la V2 afin d'accelerer les tests.

## 3. Interface Windows

L'application Windows ouvre une interface locale avec les sections suivantes :

* Tableau de bord ;
* Applications ;
* Fonds d'ecran ;
* Pages ;
* Appareil ;
* Parametres.

L'interface Windows sert a configurer les dashboards, les raccourcis, les fonds d'ecran, les pages et les appareils autorises.

La zone d'etat reseau ne doit plus afficher un type de connexion force comme `Wi-Fi 5 GHz`.

Pour la V2, elle affiche uniquement :

* serveur en ligne ;
* serveur hors ligne ;
* nom du PC.

## 4. Serveur local

Le serveur local est demarre avec l'application Windows.

Il expose :

* l'interface desktop ;
* l'interface mobile sur `/mobile` ;
* l'etat serveur via `/api/status` ;
* la configuration via `/api/config` ;
* le scan des applications via `/api/apps/scan` ;
* le lancement des applications via `/api/apps/launch` ;
* le pave numerique via `/api/keyboard`.

L'adresse IP locale du PC est recuperee dynamiquement, avec possibilite d'override par variable d'environnement pour les tests.

## 5. Interface mobile

La webapp mobile doit prendre toute la resolution disponible de l'ecran.

Elle affiche :

* le nom du PC en haut a gauche ;
* `ShortApps` en haut a droite ;
* les raccourcis au centre ;
* les indicateurs de pages en bas.

Le mode paysage reste prioritaire.

Le mode portrait reste disponible, notamment pour le pave numerique.

## 6. Dashboard mobile

Chaque page contient jusqu'a 8 raccourcis.

En paysage :

* 2 lignes ;
* 4 raccourcis par ligne.

En portrait :

* grille adaptee a l'ecran ;
* interface lisible et utilisable sans debordement volontaire.

Les boutons du dashboard doivent avoir un rendu plus tactile :

* profondeur visuelle ;
* ombres ;
* effet d'enfoncement a l'appui ;
* animation courte de lancement ;
* retour haptique si le navigateur du telephone supporte `navigator.vibrate()`.

## 7. Lancement des applications

Lorsqu'un utilisateur appuie sur un raccourci depuis le telephone, ShortApps doit appeler le backend local et lancer l'application cible sur le PC Windows.

En V2, le lancement se fait via PowerShell et `Start-Process`.

Le backend doit verifier que l'executable existe avant de declarer l'action comme lancee.

Les liens web `http://`, `https://` et les cibles `shell:` sont acceptes.

## 8. Scan des applications Windows

L'onglet Applications permet de scanner :

* les raccourcis du menu Demarrer ;
* les raccourcis du Bureau ;
* les entrees du registre Windows ;
* les chemins d'executables associes.

Le scan V2 doit eviter de selectionner comme executable principal les fichiers techniques suivants :

* `uninstall.exe` ;
* `setup.exe` ;
* `install.exe` ;
* `updater.exe` ;
* executables de service, de maintenance ou de crash report.

L'objectif est d'augmenter les chances de lancer la vraie application et non son desinstalleur.

## 9. Personnalisation des raccourcis

Chaque raccourci peut contenir :

* un nom affiche ;
* un chemin executable ;
* des arguments ;
* un repertoire de travail ;
* une couleur ou marque visuelle ;
* un mode icone ou texte.

Regle d'affichage :

* icone seule autorisee ;
* texte central seul autorise ;
* au moins un element visuel principal obligatoire ;
* icone et texte central simultanes dans la zone principale interdits.

Le nom du raccourci peut rester affiche sous l'icone.

## 10. Pages et fonds d'ecran

L'utilisateur peut :

* creer plusieurs pages ;
* organiser les raccourcis ;
* dupliquer ou masquer une page ;
* choisir un fond d'ecran ;
* regler le flou ;
* regler l'assombrissement ;
* voir un apercu mobile.

Les apercus doivent rester contenus dans leurs panneaux et ne pas provoquer de debordement global de la fenetre.

## 11. Appairage et securite locale

L'acces mobile repose sur :

* le reseau local ;
* un QR Code d'appairage ;
* un jeton unique ;
* un code associe ;
* une liste d'appareils autorises ;
* la possibilite de revoquer un appareil.

Un appareil non autorise ne doit pas pouvoir utiliser les actions sensibles.

Les actions sensibles incluent :

* lancement d'applications ;
* envoi de touches clavier.

## 12. Mode pave numerique

Le texte `ShortApps` en haut a droite de la webapp mobile est cliquable.

Un clic bascule entre :

* mode dashboard ;
* mode pave numerique.

Le pave numerique doit envoyer au PC :

* chiffres `0` a `9` ;
* `.` ;
* `/` ;
* `*` ;
* `-` ;
* `+` ;
* `Entrer`.

Le comportement d'appui long doit etre gere :

* debut de pression : envoi `down` ;
* maintien du doigt : touche maintenue cote PC ;
* relachement : envoi `up`.

En V2, l'envoi clavier Windows utilise PowerShell et l'API `user32.dll`.

## 13. Packaging V2

Le livrable V2 est une archive contenant le dossier complet de l'application Electron.

L'utilisateur doit lancer :

```text
ShortApps.exe
```

depuis le dossier extrait.

Il ne faut pas deplacer uniquement le fichier `.exe`, car l'application depend aussi des DLL Electron et du dossier `resources`.

## 14. Limites connues de la V2

La V2 est une base fonctionnelle, pas une version finale.

Points pouvant etre ameliores en V3 :

* detection plus fine des icones natives Windows ;
* gestion reelle et persistante des appareils connectes ;
* suppression des donnees demo restantes ;
* meilleur retour d'erreur visible sur le telephone ;
* eventuelle migration Electron vers Tauri ;
* installeur Windows signe ;
* proxy ou relais securise pour acces hors reseau local.

## 15. Critere de validation V2

La V2 est consideree comme valide si :

* l'application Windows se lance ;
* le serveur local demarre ;
* le telephone accede a `/mobile` depuis le meme reseau ;
* le dashboard mobile est plein ecran ;
* les boutons du dashboard reagissent visuellement ;
* un clic sur une icone appelle le lancement cote PC ;
* le pave numerique envoie les actions clavier cote PC ;
* l'interface ne force plus l'affichage Wi-Fi si le PC est en filaire ;
* le ZIP contient le dossier complet de l'application.
