#!/bin/bash

export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=${PWD}/../config  # Changé de configtx à config

# IP des conteneurs
ORDERER_IP="172.18.0.4"
PEER1_IP="172.18.0.8"
PEER2_IP="172.18.0.9"

export ORDERER_CA=${PWD}/../crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem
export ORDERER_ADDRESS=$ORDERER_IP:7050

echo "=========================================="
echo "Creating Channel: mychannel"
echo "=========================================="
echo "Orderer IP: $ORDERER_IP"
echo "Peer1 IP: $PEER1_IP"
echo "Peer2 IP: $PEER2_IP"
echo ""

# Créer le channel
peer channel create -o $ORDERER_ADDRESS -c mychannel -f ../channel-artifacts/channel.tx --tls --cafile $ORDERER_CA

# Joindre peer0.org1
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/../crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/../crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=$PEER1_IP:7051
peer channel join -b mychannel.block

# Joindre peer0.org2
export CORE_PEER_LOCALMSPID="Org2MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/../crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/../crypto-config/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp
export CORE_PEER_ADDRESS=$PEER2_IP:9051
peer channel join -b mychannel.block

echo ""
echo "=========================================="
echo "Channel created successfully!"
echo "=========================================="