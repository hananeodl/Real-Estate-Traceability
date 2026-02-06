#!/bin/bash
#
# generate-genesis.sh
# Generate genesis block and channel configuration transaction
# Equivalent to genesis.json in Ethereum
#

set -e

echo "=========================================="
echo "Generating Genesis Block & Channel Tx"
echo "=========================================="

# Set paths
CHANNEL_NAME="mychannel"
CHANNEL_ARTIFACTS_DIR="../channel-artifacts"
CONFIGTX_FILE="../configtx/configtx.yaml"

# Check if configtxgen tool is available
which configtxgen
if [ "$?" -ne 0 ]; then
  echo "configtxgen tool not found. Please ensure Fabric binaries are in PATH"
  exit 1
fi

# Create channel artifacts directory
if [ ! -d "$CHANNEL_ARTIFACTS_DIR" ]; then
  mkdir -p $CHANNEL_ARTIFACTS_DIR
fi

# Set FABRIC_CFG_PATH to configtx directory
export FABRIC_CFG_PATH=$PWD/../configtx

echo ""
echo "Generating genesis block..."
configtxgen -profile TwoOrgsOrdererGenesis \
  -channelID system-channel \
  -outputBlock $CHANNEL_ARTIFACTS_DIR/genesis.block

if [ "$?" -ne 0 ]; then
  echo "Failed to generate genesis block..."
  exit 1
fi

echo ""
echo "Generating channel configuration transaction..."
configtxgen -profile TwoOrgsChannel \
  -outputCreateChannelTx $CHANNEL_ARTIFACTS_DIR/${CHANNEL_NAME}.tx \
  -channelID $CHANNEL_NAME

if [ "$?" -ne 0 ]; then
  echo "Failed to generate channel configuration transaction..."
  exit 1
fi

echo ""
echo "Generating anchor peer update for Org1MSP..."
configtxgen -profile TwoOrgsChannel \
  -outputAnchorPeersUpdate $CHANNEL_ARTIFACTS_DIR/Org1MSPanchors.tx \
  -channelID $CHANNEL_NAME \
  -asOrg Org1MSP

if [ "$?" -ne 0 ]; then
  echo "Failed to generate anchor peer update for Org1MSP..."
  exit 1
fi

echo ""
echo "Generating anchor peer update for Org2MSP..."
configtxgen -profile TwoOrgsChannel \
  -outputAnchorPeersUpdate $CHANNEL_ARTIFACTS_DIR/Org2MSPanchors.tx \
  -channelID $CHANNEL_NAME \
  -asOrg Org2MSP

if [ "$?" -ne 0 ]; then
  echo "Failed to generate anchor peer update for Org2MSP..."
  exit 1
fi

echo ""
echo "=========================================="
echo "Genesis Block & Channel Tx Generated"
echo "=========================================="
echo ""
echo "Generated files:"
echo "  - genesis.block (Orderer genesis block)"
echo "  - ${CHANNEL_NAME}.tx (Channel creation transaction)"
echo "  - Org1MSPanchors.tx (Org1 anchor peer update)"
echo "  - Org2MSPanchors.tx (Org2 anchor peer update)"
echo ""
echo "Location: $CHANNEL_ARTIFACTS_DIR"
echo ""