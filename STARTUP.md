#  Guide de Démarrage du Projet Fabric Escrow

##  Structure du Projet

```bash
fabric-escrow/
├── chaincode/ # Smart contract Go
├── client/ # Clients Fabric (Go et Node.js)
├── network/ # Configuration réseau Fabric
├── web-app/ # Interface web Express
└── STARTUP.md # Ce fichier
```
---

##  PREMIER DÉMARRAGE (À ZÉRO)

### 1. Prérequis

 Vérifier les versions

```bash
docker --version           # Doit être ≥ 20.10
docker-compose --version   # Doit être ≥ 2.0
go version                 # Doit être ≥ 1.21
node --version            # Doit être ≥ 18

```

### 2. Nettoyage complet de l'environnement

```bash 
# Arrêter et supprimer tous les conteneurs
docker stop $(docker ps -aq) 2>/dev/null
docker rm $(docker ps -aq) 2>/dev/null

# Nettoyer les volumes et réseaux
docker volume prune -f
docker network prune -f

# Supprimer les images de chaincode
docker rmi $(docker images dev-* -q) 2>/dev/null

```

### 3. Démarrer le réseau Fabric
```bash
# Aller dans le répertoire network
cd ~/fabric-escrow/network/docker

# Démarrer les Certificate Authorities
docker-compose -f docker-compose-ca.yaml up -d
echo " Attente 10 secondes pour les CAs..."
sleep 10

# Vérifier que les CAs sont démarrés
docker ps | grep ca

```
 Vous devriez voir: ca_org1, ca_org2, ca_orderer

```bash
# Démarrer les peers et l'orderer
docker-compose -f docker-compose-net.yaml up -d

# Vérifier tous les conteneurs
docker ps

```
 Vous devriez voir 9 conteneurs:
 - 3 CAs (ca_org1, ca_org2, ca_orderer)
 - 2 peers (peer0.org1, peer0.org2)
 - 1 orderer
 - 2 couchdb
 - 1 cli

### 4. Créer le channel et déployer le chaincode
```bash
# Aller dans le répertoire scripts
cd ~/fabric-escrow/network/scripts

# Générer les certificats
./generate-crypto.sh

# Générer le bloc genesis
./generate-genesis.sh

# Créer le channel
./create-channel.sh

# Les peers devraient rejoindre automatiquement le channel
# Vérifier que les peers ont bien rejoint
docker exec cli peer channel list
# Doit afficher: Channels peers has joined: mychannel

# Déployer le chaincode
./deploy-chaincode.sh

```
 Cela peut prendre 2-3 minutes

### 5. Vérifier que le chaincode est déployé
```bash
# Vérifier que le chaincode est installé
docker exec cli peer lifecycle chaincode querycommitted -C mychannel -n escrow
```
 Vous devriez voir:
 Version: 1.0, Sequence: 1, etc.


### 6. Démarrer l'application web
```bash
# Ouvrir un nouveau terminal
cd ~/fabric-escrow/web-app

# Installer les dépendances (si pas déjà fait)
npm install

# Démarrer l'application
npm start
```

L'application est accessible sur http://localhost:3000

### 7. Créer les utilisateurs de test
Ouvrez votre navigateur sur http://localhost:3000

Créer un vendeur (seller) :

- Cliquez sur "Register"

- User ID: seller1

- Full Name: Jean Dupont

- Account Type: Seller

- Password: password1

- Cliquez "Register"

Créer un acheteur (buyer) :

- Ouvrez une fenêtre de navigation privée

- Allez sur http://localhost:3000

- Cliquez sur "Register"

- User ID: buyer1

- Full Name: Marie Martin

- Account Type: Buyer

- Password: password1

- Cliquez "Register"

### 8. Test rapide du scénario
En tant que seller1 :

- Connectez-vous avec seller1/password1

- Cliquez sur "+ Add New Property"

- Ajoutez une propriété (ex: "Appartement Paris", prix: 250000)

- Cliquez sur "Verify Title" pour vérifier la propriété

En tant que buyer1 :

- Connectez-vous avec buyer1/password1

- Vous devriez voir la propriété du seller

- Cliquez sur "Make Offer"


## Guide de Redémarrage Rapide
### Étape 1: Rouvrir WSL2 et Docker Desktop
```bash
# 1. Ouvrir Docker Desktop (manuellement depuis Windows)
# 2. Ouvrir votre terminal WSL2 (Ubuntu)
# 3. Vérifier que Docker fonctionne
docker --version
docker ps
```
### Étape 2: Se repositionner dans le projet
```bash
# Aller dans votre projet
cd ~/fabric-escrow/chaincode/escrow

# Vérifier que vos fichiers sont toujours là
ls -la
# Vous devriez voir: escrow.go, main.go, go.mod, vendor/, etc.

```
### Étape 3: Vérifier la compilation
```bash
# Tester rapidement que tout compile encore
go build -v
# Vous devriez voir "escrow" à la fin sans erreurs

```
### Étape 4: Démarrer le réseau Fabric
```bash
# Aller dans test-network
cd ~/fabric/fabric-samples/test-network

# Démarrer le réseau
./network.sh up

# Créer le channel
./network.sh createChannel
```
### Étape 5: Déployer votre chaincode
```bash
# Copier votre chaincode
cp -r ~/fabric-escrow/chaincode/escrow ../asset-transfer-basic/

# Déployer
./network.sh deployCC -ccn escrow -ccp ../asset-transfer-basic/escrow -ccl go -ccep "AND('Org1MSP.peer','Org2MSP.peer')"

```
### 3. Vérifier le réseau
```bash
# Vérifier que les peers sont connectés au channel
docker exec cli peer channel list
# Doit afficher: mychannel

# Vérifier que le chaincode est accessible
docker exec cli peer lifecycle chaincode querycommitted -C mychannel -n escrow
```

### 4. Démarrer l'application web
```bash
# Nouveau terminal
cd ~/fabric-escrow/web-app
npm start

```

### 5. Accéder à l'application
http://localhost:3000

## ARRÊTER LE PROJET
```bash
# Arrêter l'application web (Ctrl+C dans son terminal)

# Arrêter les conteneurs Fabric
cd ~/fabric-escrow/network/docker
docker-compose -f docker-compose-net.yaml down
docker-compose -f docker-compose-ca.yaml down

# Vérifier qu'aucun conteneur ne tourne
docker ps

```