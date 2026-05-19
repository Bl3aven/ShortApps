# Cahier des charges complet — ShortApps

## 1. Objectif du projet

Développer une application locale Windows nommée **ShortApps**.

L’objectif est de permettre à un utilisateur de lancer des applications installées sur son PC Windows depuis un téléphone connecté au même réseau local.

Le projet doit s’inspirer du fonctionnement de **Choclift**, mais être pensé pour Windows, avec une interface moderne, professionnelle et élégante, proche de l’univers Apple.

L’application devra fonctionner sous forme d’un exécutable local Windows ouvrant une fenêtre graphique.

---

## 2. Principe général

L’utilisateur lance l’application :

```text
ShortApps.exe
```

Une fenêtre graphique s’ouvre sur le PC.

Depuis cette fenêtre, l’utilisateur peut :

* configurer les applications disponibles sur téléphone ;
* organiser les raccourcis dans plusieurs pages ;
* personnaliser les fonds d’écran ;
* gérer les appareils autorisés ;
* modifier les paramètres réseau et généraux ;
* visualiser l’aperçu de l’interface téléphone.

Le téléphone accède ensuite à une page web hébergée localement par le PC.

Cette page web affiche une interface mobile permettant :

* de lancer des applications sur le PC ;
* de naviguer entre plusieurs dashboards ;
* d’utiliser un mode clavier numérique externe.

---

## 3. Style graphique attendu

L’application doit avoir un style :

* moderne ;
* professionnel ;
* sobre ;
* inspiré Apple ;
* fluide ;
* élégant ;
* clair ;
* premium.

L’interface devra utiliser :

* des coins arrondis ;
* des effets de transparence légers ;
* un design type glassmorphism ;
* des ombres douces ;
* une typographie propre ;
* des animations discrètes ;
* une interface claire et lisible.

Le rendu attendu correspond aux maquettes validées précédemment.

---

## 4. Technologie recommandée

La solution technique est laissée au choix du développeur, mais elle devra permettre d’obtenir un rendu proche des maquettes.

Solution recommandée :

* **Tauri + React** pour l’application Windows ;
* **React** pour l’interface graphique ;
* **CSS moderne** pour le style Apple/glassmorphism ;
* **backend local** intégré à l’application ;
* **serveur web local** pour servir l’interface téléphone ;
* **SQLite** ou fichier de configuration local pour stocker les données.

Tauri est recommandé car il permet d’obtenir une application Windows légère, moderne et performante.

Electron peut être envisagé si cela simplifie fortement le développement, mais il sera plus lourd.

---

## 5. Interface Windows

L’application PC devra comporter une interface avec une barre latérale de navigation.

Les onglets principaux seront :

* **Tableau de bord**
* **Applications**
* **Fonds d’écran**
* **Pages**
* **Appareil**
* **Paramètres**

En bas de la barre latérale, l’application devra afficher l’état de connexion du PC :

* statut connecté ;
* nom du PC ;
* réseau utilisé ;
* éventuellement le type de connexion : Wi-Fi ou Ethernet.

---

# 6. Tableau de bord

L’onglet **Tableau de bord** est l’écran principal de configuration.

Il devra permettre de :

* visualiser les applications actuellement affichées sur le téléphone ;
* organiser les applications visibles ;
* voir un aperçu du téléphone ;
* choisir rapidement une page du dashboard ;
* sélectionner un fond d’écran ;
* vérifier l’état du serveur local.

L’aperçu du téléphone devra afficher principalement le rendu en **mode paysage**, car c’est le mode principal d’utilisation de ShortApps.

Un aperçu secondaire en **mode portrait** pourra également être conservé.

---

# 7. Interface téléphone — Mode dashboard

## 7.1 Affichage principal

Sur le téléphone, l’interface doit ressembler à un écran d’accueil moderne.

Elle devra afficher :

* en haut à gauche : le nom du PC ;
* en haut à droite : le nom ou logo **ShortApps** ;
* au centre : les raccourcis d’applications ;
* en bas : des petites bulles indiquant la page active.

Le nom du PC devra être récupéré dynamiquement depuis Windows.

Exemple :

```text
DESKTOP-MATHYS
```

Le nom de l’application devra être affiché en haut à droite :

```text
ShortApps
```

---

## 7.2 Mode paysage prioritaire

L’interface téléphone devra être principalement pensée pour une utilisation en **mode paysage**.

Le mode paysage est le mode principal.

Le mode portrait pourra être conservé comme mode secondaire, notamment pour certaines vues comme le clavier numérique.

---

## 7.3 Organisation des applications

Chaque page du dashboard devra afficher au maximum :

* **8 applications** ;
* organisées en **2 lignes** ;
* avec **4 applications par ligne**.

Exemple :

```text
[ App 1 ] [ App 2 ] [ App 3 ] [ App 4 ]
[ App 5 ] [ App 6 ] [ App 7 ] [ App 8 ]
```

Chaque raccourci devra être affiché sous forme d’icône avec un nom en dessous.

---

## 7.4 Navigation entre les pages

L’utilisateur pourra créer plusieurs pages de dashboard.

Depuis le téléphone, il devra pouvoir passer d’une page à l’autre avec un glissement horizontal du doigt, comme sur l’écran d’accueil d’un smartphone.

Des petites bulles centrées en bas de l’écran permettront de visualiser rapidement :

* le nombre total de pages ;
* la page actuellement affichée.

---

# 8. Gestion des applications

## 8.1 Onglet Applications

L’onglet **Applications** permettra de gérer les applications disponibles sur le téléphone.

Il devra proposer :

* une barre de recherche ;
* une liste des applications détectées ;
* des filtres ;
* une zone de configuration du raccourci sélectionné ;
* une zone de drag & drop vers le dashboard ;
* un aperçu du rendu téléphone.

---

## 8.2 Scan des applications Windows

ShortApps devra pouvoir scanner automatiquement les applications présentes sur le PC.

Le scan devra chercher :

* les applications installées ;
* les raccourcis du menu Démarrer ;
* les raccourcis présents sur le Bureau ;
* les exécutables détectables ;
* les icônes associées ;
* les chemins d’installation.

L’objectif est de permettre à l’utilisateur d’ajouter rapidement une application au dashboard sans devoir chercher manuellement son fichier `.exe`.

---

## 8.3 Drag & Drop

Si techniquement possible, l’utilisateur devra pouvoir glisser-déposer une application détectée directement vers le dashboard.

Le drag & drop devra permettre :

* d’ajouter une application à une page ;
* de déplacer une application ;
* de réorganiser les icônes ;
* de déplacer un raccourci d’une page à une autre ;
* de créer rapidement un raccourci à partir d’une application détectée.

---

## 8.4 Personnalisation des raccourcis

Depuis l’application PC, l’utilisateur devra pouvoir cliquer directement sur une icône du dashboard afin de la configurer.

Pour chaque raccourci, il devra pouvoir modifier :

* le nom affiché ;
* l’icône ;
* le logo ;
* le texte central ;
* l’exécutable cible ;
* la page où le raccourci apparaît ;
* la position dans la page.

---

## 8.5 Règle d’affichage d’un raccourci

Lors de la création d’un raccourci, il faudra obligatoirement avoir au moins un élément visuel principal.

Deux modes seront possibles :

1. affichage d’un **logo ou d’une icône** ;
2. affichage d’un **texte central**.

Les règles sont :

* logo seul autorisé ;
* texte seul autorisé ;
* au moins l’un des deux obligatoire ;
* logo + texte central ensemble interdits dans la zone principale.

Le nom du raccourci pourra toutefois rester affiché sous l’icône.

---

## 8.6 Lancement des applications

Lorsqu’un utilisateur clique sur une application depuis son téléphone, ShortApps devra lancer l’exécutable correspondant sur le PC Windows.

Le lancement devra être :

* rapide ;
* local ;
* limité aux appareils autorisés ;
* journalisé si nécessaire.

Un appareil non autorisé ne devra jamais pouvoir lancer d’application.

---

# 9. Gestion des fonds d’écran

## 9.1 Onglet Fonds d’écran

L’onglet **Fonds d’écran** devra permettre de gérer l’arrière-plan affiché sur l’interface téléphone.

L’utilisateur devra pouvoir :

* choisir un fond parmi une sélection proposée ;
* importer un fond personnalisé ;
* visualiser le fond sélectionné ;
* appliquer le fond au dashboard ;
* voir un aperçu téléphone en direct.

---

## 9.2 Options visuelles

Pour chaque fond d’écran, ShortApps devra pouvoir proposer des réglages comme :

* intensité du flou ;
* assombrissement ;
* centrage ;
* remplissage ;
* adaptation à l’écran.

L’objectif est de garantir une bonne lisibilité des icônes, même avec un fond chargé.

---

# 10. Gestion des pages

## 10.1 Onglet Pages

L’onglet **Pages** devra permettre de gérer les différents dashboards affichés sur le téléphone.

L’utilisateur devra pouvoir :

* créer une nouvelle page ;
* supprimer une page ;
* renommer une page ;
* dupliquer une page ;
* masquer une page ;
* réorganiser les pages ;
* choisir la page par défaut au démarrage ;
* voir les applications présentes sur chaque page.

---

## 10.2 Structure des pages

Chaque page devra contenir jusqu’à 8 raccourcis.

Chaque page devra avoir :

* un nom ;
* un ordre ;
* une disposition ;
* une liste de raccourcis ;
* un état visible/masqué ;
* éventuellement un fond spécifique ou commun.

---

# 11. Sécurité réseau local

ShortApps devra fonctionner uniquement sur le **réseau local** dans la première version.

Le téléphone devra être connecté au même réseau local que le PC pour accéder à l’interface.

Si le téléphone n’est pas sur le même réseau, il ne pourra simplement pas se connecter au PC.

Une future version pourra intégrer un proxy ou relais distant permettant un accès depuis un autre réseau.

---

# 12. Récupération dynamique de l’IP et du hostname

ShortApps devra récupérer automatiquement les informations réseau et système du PC.

L’utilisateur ne devra pas avoir à saisir manuellement ces valeurs.

L’application devra récupérer dynamiquement :

* le hostname du PC ;
* l’adresse IP locale ;
* l’interface réseau active ;
* le port utilisé par le serveur local ;
* l’URL locale d’accès.

Exemple :

```text
Hostname : DESKTOP-MATHYS
IP locale : 192.168.1.24
Port : 56321
URL : http://192.168.1.24:56321
```

Ces informations devront être utilisées pour :

* afficher le nom du PC sur le téléphone ;
* générer le QR Code ;
* afficher les informations réseau dans les paramètres ;
* permettre au téléphone de se connecter à la bonne adresse locale.

Si plusieurs interfaces réseau sont disponibles, ShortApps devra sélectionner automatiquement l’interface principale connectée au réseau local.

Une option avancée pourra permettre de choisir manuellement l’interface réseau.

---

# 13. Appairage des appareils par QR Code

## 13.1 Principe

L’accès depuis un téléphone devra nécessiter un appairage initial par QR Code.

Depuis l’application PC, l’utilisateur pourra générer un QR Code permettant d’autoriser un nouvel appareil.

Le QR Code devra contenir un jeton ou code unique permettant :

* d’identifier le téléphone ;
* d’autoriser sa première connexion ;
* de l’enregistrer comme appareil approuvé ;
* de mémoriser l’appareil pour les futures connexions.

---

## 13.2 Contenu logique du QR Code

Le QR Code devra être généré dynamiquement à partir des informations actuelles du PC.

Il devra contenir au minimum :

* le hostname du PC ;
* l’IP locale ;
* le port ;
* un jeton d’appairage ;
* un identifiant temporaire ;
* un mode local uniquement ;
* éventuellement une date d’expiration.

Exemple logique :

```json
{
  "host": "DESKTOP-MATHYS",
  "ip": "192.168.1.24",
  "port": 56321,
  "pairing_token": "SHA-4821",
  "mode": "local_only"
}
```

---

## 13.3 Mémorisation de l’appareil

Une fois le QR Code scanné, le téléphone devra être enregistré comme appareil autorisé.

Lors des futures connexions, le téléphone ne devra pas avoir besoin de rescanner le QR Code, tant qu’il n’a pas été révoqué.

---

# 14. Gestion des appareils

## 14.1 Onglet Appareil

L’onglet **Appareil** devra permettre de gérer les téléphones et périphériques autorisés.

L’utilisateur devra pouvoir :

* voir la liste des appareils autorisés ;
* voir les appareils hors ligne ;
* voir les appareils révoqués ;
* consulter leur nom ;
* consulter leur IP locale ;
* consulter leur navigateur ;
* consulter leur date de première connexion ;
* consulter leur dernière connexion ;
* révoquer un appareil ;
* supprimer un appareil ;
* générer un nouveau QR Code ;
* copier le lien d’accès local.

---

## 14.2 Révocation

Un appareil révoqué ne devra plus pouvoir :

* accéder au dashboard ;
* lancer une application ;
* utiliser le clavier numérique ;
* envoyer une commande au PC.

Même si l’appareil possède encore l’ancien lien ou l’ancien QR Code, l’accès devra être refusé.

---

# 15. Authentification

Aucun mot de passe classique n’est requis dans la première version.

La sécurité reposera sur :

* le réseau local uniquement ;
* l’appairage par QR Code ;
* la mémorisation des appareils autorisés ;
* la possibilité de révoquer un appareil.

Un système de mot de passe ou de code PIN pourra être envisagé plus tard, mais il n’est pas requis pour la première version.

---

# 16. Paramètres

## 16.1 Onglet Paramètres

L’onglet **Paramètres** devra regrouper les réglages généraux de l’application.

Il devra contenir plusieurs sections :

* Général ;
* Réseau ;
* Sécurité ;
* Démarrage ;
* Mises à jour ;
* À propos.

---

## 16.2 Paramètres généraux

La section générale devra permettre de modifier :

* le nom du PC affiché si surcharge manuelle souhaitée ;
* la langue ;
* le thème clair/sombre ;
* le lancement automatique au démarrage de Windows ;
* la réduction dans la zone de notification ;
* les préférences d’affichage.

---

## 16.3 Paramètres réseau

La section réseau devra afficher les informations récupérées automatiquement :

* hostname ;
* adresse IP locale ;
* port du serveur local ;
* URL locale d’accès ;
* statut du serveur ;
* réseau détecté ;
* nombre d’appareils connectés ;
* état de l’accès distant/proxy.

L’accès distant devra être indiqué comme une fonctionnalité future.

---

## 16.4 Paramètres de sécurité

La section sécurité devra permettre de gérer :

* les appareils autorisés ;
* les appareils révoqués ;
* les jetons actifs ;
* la durée de validité des QR Codes ;
* les confirmations éventuelles avant lancement d’une application sensible.

---

# 17. Mode clavier numérique externe

## 17.1 Activation du mode clavier

Sur l’interface téléphone, le logo ou texte **ShortApps** affiché en haut à droite devra être cliquable.

Lorsque l’utilisateur clique sur **ShortApps**, l’interface devra basculer du mode dashboard vers un mode **clavier numérique externe**.

Un nouveau clic sur **ShortApps**, ou un bouton de retour, devra permettre de revenir au dashboard d’applications.

---

## 17.2 Objectif du mode clavier numérique

Le téléphone devra pouvoir servir de pavé numérique tactile externe pour le PC.

Ce mode devra permettre d’envoyer des entrées clavier au PC Windows.

Il devra afficher :

* les chiffres `0` à `9` ;
* les opérateurs `/`, `*`, `-`, `+` ;
* la touche `.` ;
* la touche `Entrer`.

---

## 17.3 Disposition validée

La disposition validée correspond à l’aperçu généré précédemment.

En mode portrait :

* les 3 colonnes de chiffres doivent prendre toute la largeur utile de l’écran ;
* les chiffres doivent être grands ;
* les touches doivent être espacées ;
* les opérateurs doivent être placés au-dessus des chiffres ;
* `.` , `0` et `Entrer` doivent être placés en bas ;
* la touche `Entrer` peut être plus large pour utiliser l’espace disponible.

Disposition logique :

```text
[  /  ] [  *  ] [  -  ] [  +  ]

[  7  ] [  8  ] [  9  ]
[  4  ] [  5  ] [  6  ]
[  1  ] [  2  ] [  3  ]

[  .  ] [  0  ] [      Entrer      ]
```

Les chiffres doivent rester l’élément central et dominant de l’interface.

---

## 17.4 Comportement des touches

Lorsqu’une touche est pressée sur le téléphone, ShortApps devra envoyer la touche correspondante au PC.

Exemples :

```text
Appui sur 7      → envoie 7 au PC
Appui sur +      → envoie + au PC
Appui sur .      → envoie . au PC
Appui sur Entrer → envoie Entrée au PC
```

Le comportement devra être fluide, immédiat et adapté à une utilisation tactile.

---

## 17.5 Appui long sur une touche

Le clavier numérique devra gérer l’appui long.

Si l’utilisateur reste appuyé sur une touche précise depuis l’écran du téléphone, ShortApps devra considérer que la touche reste maintenue côté PC.

Autrement dit :

* au début de l’appui, la touche est envoyée comme pressée ;
* tant que l’utilisateur garde le doigt appuyé, la touche ne doit pas être relâchée ;
* lorsque l’utilisateur retire le doigt, la touche est relâchée.

Ce comportement devra s’appliquer notamment aux chiffres.

Exemple :

```text
L’utilisateur maintient la touche 8 sur le téléphone
→ ShortApps maintient la touche 8 appuyée côté PC

L’utilisateur relâche la touche 8
→ ShortApps relâche la touche 8 côté PC
```

Ce fonctionnement est important pour permettre un comportement proche d’un vrai clavier physique.

---

## 17.6 Sécurité du mode clavier

Le mode clavier numérique devra respecter les mêmes règles de sécurité que le lancement d’applications.

Il devra être accessible uniquement :

* sur le réseau local ;
* depuis un appareil autorisé ;
* après appairage par QR Code ;
* tant que l’appareil n’a pas été révoqué.

Un appareil non autorisé ne devra jamais pouvoir envoyer des touches au PC.

---

# 18. Stockage local

ShortApps devra stocker localement ses données de configuration.

Les données à conserver sont notamment :

* les applications configurées ;
* les chemins des exécutables ;
* les icônes personnalisées ;
* les pages ;
* l’ordre des raccourcis ;
* les fonds d’écran ;
* les appareils autorisés ;
* les appareils révoqués ;
* les paramètres réseau ;
* les préférences utilisateur.

Le stockage pourra être réalisé avec :

* SQLite ;
* ou un fichier JSON structuré pour une première version.

SQLite est préférable si l’application doit évoluer proprement.

---

# 19. Comportement attendu complet

L’utilisateur lance **ShortApps.exe** sur son PC Windows.

L’application récupère automatiquement :

* le hostname ;
* l’adresse IP locale ;
* l’interface réseau active ;
* le port local.

L’application ouvre une fenêtre graphique moderne avec un style professionnel inspiré Apple.

Depuis l’application PC, l’utilisateur peut :

* scanner les applications Windows ;
* glisser-déposer des applications dans un dashboard ;
* personnaliser les raccourcis ;
* créer plusieurs pages ;
* choisir un fond d’écran ;
* générer un QR Code d’appairage ;
* gérer les appareils autorisés ;
* modifier les paramètres.

Le téléphone scanne un QR Code généré depuis ShortApps.

Si le téléphone est sur le même réseau local et que le QR Code est valide, il est enregistré comme appareil autorisé.

Le téléphone peut ensuite accéder à l’interface web locale hébergée par le PC.

Depuis cette interface, l’utilisateur peut :

* voir le dashboard d’applications ;
* faire défiler les pages au doigt ;
* lancer des applications Windows ;
* basculer vers le mode clavier numérique en cliquant sur **ShortApps** ;
* utiliser le téléphone comme pavé numérique tactile.

Si l’utilisateur maintient une touche du clavier numérique appuyée, ShortApps devra maintenir la touche appuyée côté PC jusqu’au relâchement.

---

# 20. Évolutions futures possibles

Les fonctionnalités suivantes ne sont pas obligatoires pour la première version, mais devront être pensées comme évolutions possibles :

* proxy distant pour accès hors réseau local ;
* clavier complet ;
* pavé multimédia ;
* contrôle du volume ;
* contrôle souris ou touchpad ;
* macros personnalisées ;
* profils par appareil ;
* profils par application ;
* thèmes personnalisés ;
* sauvegarde/export de configuration ;
* synchronisation entre plusieurs PC ;
* système de permissions par appareil.
