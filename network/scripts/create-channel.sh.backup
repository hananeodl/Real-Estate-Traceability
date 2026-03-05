#!/bin/bash
#
# create-channel.sh
# Create channel and join peers
#

set -e

CHANNEL_NAME="mychannel"
ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

echo "=========================================="
echo "Creating Channel: $CHANNEL_NAME"
echo "=========================================="

# Create channel
docker exec cli peer channel create \
  -o orderer.example.com:7050 \
  -c $CHANNEL_NAME \
  -f ./channel-artifacts/${CHANNEL_NAME}.tx \
  --outputBlock ./channel-artifacts/${CHANNEL_NAME}.block \
  --tls \
  --cafile $ORDERER_CA

if [ "$?" -ne 0 ]; then
  echo "Failed to create channel..."
  exit 1
fi

echo ""
echo "Channel '$CHANNEL_NAME' created successfully!"
echo ""

echo "=========================================="
echo "Joining Peers to Channel"
echo "=========================================="

# Join Org1 peer to channel
echo ""
echo "Joining peer0.org1.example.com to channel..."
docker exec cli peer channel join \
  -b ./channel-artifacts/${CHANNEL_NAME}.block

if [ "$?" -ne 0 ]; then
  echo "Failed to join peer0.org1 to channel..."
  exit 1
fi

# Switch to Org2 peer
export CORE_PEER_LOCALMSPID="Org2MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp
export CORE_PEER_ADDRESS=peer0.org2.example.com:9051

# Join Org2 peer to channel
echo ""
echo "Joining peer0.org2.example.com to channel..."
docker exec -e CORE_PEER_LOCALMSPID=$CORE_PEER_LOCALMSPID \
  -e CORE_PEER_TLS_ROOTCERT_FILE=$CORE_PEER_TLS_ROOTCERT_FILE \
  -e CORE_PEER_MSPCONFIGPATH=$CORE_PEER_MSPCONFIGPATH \
  -e CORE_PEER_ADDRESS=$CORE_PEER_ADDRESS \
  cli peer channel join \
  -b ./channel-artifacts/${CHANNEL_NAME}.block

if [ "$?" -ne 0 ]; then
  echo "Failed to join peer0.org2 to channel..."
  exit 1
fi

echo ""
echo "=========================================="
echo "Updating Anchor Peers"
echo "=========================================="

# Update anchor peer for Org1
echo ""
echo "Updating anchor peer for Org1..."
docker exec cli peer channel update \
  -o orderer.example.com:7050 \
  -c $CHANNEL_NAME \
  -f ./channel-artifacts/Org1MSPanchors.tx \
  --tls \
  --cafile $ORDERER_CA

# Update anchor peer for Org2
echo ""
echo "Updating anchor peer for Org2..."
docker exec -e CORE_PEER_LOCALMSPID=$CORE_PEER_LOCALMSPID \
  -e CORE_PEER_TLS_ROOTCERT_FILE=$CORE_PEER_TLS_ROOTCERT_FILE \
  -e CORE_PEER_MSPCONFIGPATH=$CORE_PEER_MSPCONFIGPATH \
  -e CORE_PEER_ADDRESS=$CORE_PEER_ADDRESS \
  cli peer channel update \
  -o orderer.example.com:7050 \
  -c $CHANNEL_NAME \
  -f ./channel-artifacts/Org2MSPanchors.tx \
  --tls \
  --cafile $ORDERER_CA

echo ""
echo "=========================================="
echo "Channel Setup Complete!"
echo "=========================================="
echo ""
echo "Channel '$CHANNEL_NAME' is ready."
echo "Peers joined and anchor peers updated."
echo ""