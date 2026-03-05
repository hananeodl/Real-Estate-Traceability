#!/bin/bash
set -x

echo "=========================================="
echo "Deploying Chaincode: escrow (SANS TLS)"
echo "=========================================="

# Configuration des chemins - SANS TLS pour le déploiement
export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=${PWD}/../config
export ORDERER_CA=${PWD}/../crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem
export CORE_PEER_TLS_ENABLED=false
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_MSPCONFIGPATH=${PWD}/../crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051

echo "Step 1: Tidying go modules..."
cd ../../chaincode/escrow
go mod tidy
go mod vendor
cd - > /dev/null

echo "Step 2: Packaging chaincode..."
peer lifecycle chaincode package escrow.tar.gz --path ../../chaincode/escrow --lang golang --label escrow_1.0

echo "Step 3: Installing on Org1..."
peer lifecycle chaincode install escrow.tar.gz

echo "Step 4: Installing on Org2..."
export CORE_PEER_LOCALMSPID="Org2MSP"
export CORE_PEER_MSPCONFIGPATH=${PWD}/../crypto-config/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp
export CORE_PEER_ADDRESS=localhost:9051
peer lifecycle chaincode install escrow.tar.gz

echo "Step 5: Getting package ID..."
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_MSPCONFIGPATH=${PWD}/../crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051
export CC_PACKAGE_ID=$(peer lifecycle chaincode queryinstalled | grep "escrow_1.0" | awk '{print $3}' | sed 's/,//')
echo "Package ID: $CC_PACKAGE_ID"

if [ -z "$CC_PACKAGE_ID" ]; then
    echo "❌ Failed to get package ID"
    exit 1
fi

echo "Step 6: Approving for Org1..."
peer lifecycle chaincode approveformyorg -o localhost:7050 --channelID mychannel --name escrow --version 1.0 --package-id $CC_PACKAGE_ID --sequence 1 --signature-policy "AND('Org1MSP.peer','Org2MSP.peer')"

echo "Step 7: Approving for Org2..."
export CORE_PEER_LOCALMSPID="Org2MSP"
export CORE_PEER_MSPCONFIGPATH=${PWD}/../crypto-config/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp
export CORE_PEER_ADDRESS=localhost:9051
peer lifecycle chaincode approveformyorg -o localhost:7050 --channelID mychannel --name escrow --version 1.0 --package-id $CC_PACKAGE_ID --sequence 1 --signature-policy "AND('Org1MSP.peer','Org2MSP.peer')"

echo "Step 8: Checking commit readiness..."
peer lifecycle chaincode checkcommitreadiness --channelID mychannel --name escrow --version 1.0 --sequence 1 --signature-policy "AND('Org1MSP.peer','Org2MSP.peer')" --output json

echo "Step 9: Committing chaincode..."
peer lifecycle chaincode commit -o localhost:7050 --channelID mychannel --name escrow --peerAddresses localhost:7051 --peerAddresses localhost:9051 --version 1.0 --sequence 1 --signature-policy "AND('Org1MSP.peer','Org2MSP.peer')"

echo "Step 10: Verifying..."
peer lifecycle chaincode querycommitted --channelID mychannel --name escrow

echo "=========================================="
echo "Chaincode deployed successfully!"
echo "=========================================="