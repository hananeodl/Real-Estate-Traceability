#!/bin/bash
#
# deploy-chaincode.sh
# Package, install, approve, and commit chaincode
# Equivalent to deploying smart contracts in Ethereum
#

set -e

CHANNEL_NAME="mychannel"
CHAINCODE_NAME="escrow"
CHAINCODE_VERSION="1.0"
CHAINCODE_SEQUENCE=1
CHAINCODE_PATH="/opt/gopath/src/github.com/chaincode/escrow"
ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

echo "=========================================="
echo "Deploying Chaincode: $CHAINCODE_NAME"
echo "=========================================="

# Package chaincode
echo ""
echo "Step 1: Packaging chaincode..."
docker exec cli peer lifecycle chaincode package ${CHAINCODE_NAME}.tar.gz \
  --path ${CHAINCODE_PATH} \
  --lang golang \
  --label ${CHAINCODE_NAME}_${CHAINCODE_VERSION}

if [ "$?" -ne 0 ]; then
  echo "Failed to package chaincode..."
  exit 1
fi

echo "Chaincode packaged successfully!"

# Install chaincode on Org1 peer
echo ""
echo "Step 2: Installing chaincode on peer0.org1..."
docker exec cli peer lifecycle chaincode install ${CHAINCODE_NAME}.tar.gz

if [ "$?" -ne 0 ]; then
  echo "Failed to install chaincode on peer0.org1..."
  exit 1
fi

# Get package ID for Org1
PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled | grep ${CHAINCODE_NAME}_${CHAINCODE_VERSION} | awk '{print $3}' | sed 's/,$//')
echo "Package ID: $PACKAGE_ID"

# Install chaincode on Org2 peer
echo ""
echo "Step 3: Installing chaincode on peer0.org2..."
docker exec \
  -e CORE_PEER_LOCALMSPID=Org2MSP \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt \
  -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp \
  -e CORE_PEER_ADDRESS=peer0.org2.example.com:9051 \
  cli peer lifecycle chaincode install ${CHAINCODE_NAME}.tar.gz

if [ "$?" -ne 0 ]; then
  echo "Failed to install chaincode on peer0.org2..."
  exit 1
fi

# Approve chaincode for Org1
echo ""
echo "Step 4: Approving chaincode for Org1..."
docker exec cli peer lifecycle chaincode approveformyorg \
  -o orderer.example.com:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --channelID $CHANNEL_NAME \
  --name $CHAINCODE_NAME \
  --version $CHAINCODE_VERSION \
  --package-id $PACKAGE_ID \
  --sequence $CHAINCODE_SEQUENCE \
  --tls \
  --cafile $ORDERER_CA

if [ "$?" -ne 0 ]; then
  echo "Failed to approve chaincode for Org1..."
  exit 1
fi

# Approve chaincode for Org2
echo ""
echo "Step 5: Approving chaincode for Org2..."
docker exec \
  -e CORE_PEER_LOCALMSPID=Org2MSP \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt \
  -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp \
  -e CORE_PEER_ADDRESS=peer0.org2.example.com:9051 \
  cli peer lifecycle chaincode approveformyorg \
  -o orderer.example.com:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --channelID $CHANNEL_NAME \
  --name $CHAINCODE_NAME \
  --version $CHAINCODE_VERSION \
  --package-id $PACKAGE_ID \
  --sequence $CHAINCODE_SEQUENCE \
  --tls \
  --cafile $ORDERER_CA

if [ "$?" -ne 0 ]; then
  echo "Failed to approve chaincode for Org2..."
  exit 1
fi

# Check commit readiness
echo ""
echo "Step 6: Checking commit readiness..."
docker exec cli peer lifecycle chaincode checkcommitreadiness \
  --channelID $CHANNEL_NAME \
  --name $CHAINCODE_NAME \
  --version $CHAINCODE_VERSION \
  --sequence $CHAINCODE_SEQUENCE \
  --tls \
  --cafile $ORDERER_CA \
  --output json

# Commit chaincode definition
echo ""
echo "Step 7: Committing chaincode definition..."
docker exec cli peer lifecycle chaincode commit \
  -o orderer.example.com:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --channelID $CHANNEL_NAME \
  --name $CHAINCODE_NAME \
  --version $CHAINCODE_VERSION \
  --sequence $CHAINCODE_SEQUENCE \
  --tls \
  --cafile $ORDERER_CA \
  --peerAddresses peer0.org1.example.com:7051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
  --peerAddresses peer0.org2.example.com:9051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt

if [ "$?" -ne 0 ]; then
  echo "Failed to commit chaincode..."
  exit 1
fi

# Query committed chaincode
echo ""
echo "Step 8: Verifying committed chaincode..."
docker exec cli peer lifecycle chaincode querycommitted \
  --channelID $CHANNEL_NAME \
  --name $CHAINCODE_NAME \
  --tls \
  --cafile $ORDERER_CA

echo ""
echo "=========================================="
echo "Chaincode Deployed Successfully!"
echo "=========================================="
echo ""
echo "Chaincode Name: $CHAINCODE_NAME"
echo "Version: $CHAINCODE_VERSION"
echo "Sequence: $CHAINCODE_SEQUENCE"
echo "Package ID: $PACKAGE_ID"
echo ""
echo "You can now invoke and query the chaincode."
echo ""