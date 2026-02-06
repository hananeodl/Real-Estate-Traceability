#!/bin/bash
#
# generate-crypto.sh
# Generate cryptographic materials for all organizations
# Equivalent to creating Ethereum accounts/keystores
#

set -e

echo "=========================================="
echo "Generating Crypto Materials"
echo "=========================================="

# Set paths
CRYPTO_CONFIG_DIR="../crypto-config"
CRYPTO_CONFIG_FILE="../crypto-config/crypto-config.yaml"

# Check if cryptogen tool is available
which cryptogen
if [ "$?" -ne 0 ]; then
  echo "cryptogen tool not found. Please ensure Fabric binaries are in PATH"
  exit 1
fi

# Remove existing crypto material
if [ -d "$CRYPTO_CONFIG_DIR" ]; then
  echo "Removing existing crypto material..."
  rm -rf $CRYPTO_CONFIG_DIR/ordererOrganizations
  rm -rf $CRYPTO_CONFIG_DIR/peerOrganizations
fi

# Generate crypto material
echo "Generating crypto material using cryptogen..."
cryptogen generate --config=$CRYPTO_CONFIG_FILE --output=$CRYPTO_CONFIG_DIR

if [ "$?" -ne 0 ]; then
  echo "Failed to generate crypto material..."
  exit 1
fi

echo ""
echo "=========================================="
echo "Crypto Material Generated Successfully"
echo "=========================================="
echo ""
echo "Generated certificates for:"
echo "  - Orderer Organization"
echo "  - Org1 (Buyer) - 1 peer, 1 user, 1 admin"
echo "  - Org2 (Seller) - 1 peer, 1 user, 1 admin"
echo ""
echo "Location: $CRYPTO_CONFIG_DIR"
echo ""