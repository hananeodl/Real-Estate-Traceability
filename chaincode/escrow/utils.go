package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// GenerateHash
func GenerateHash(input string) string {
	hash := sha256.Sum256([]byte(input))
	return hex.EncodeToString(hash[:])
}

// GetClientID
func GetClientID(ctx contractapi.TransactionContextInterface) (string, error) {
	id, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return "", fmt.Errorf("cannot get client identity: %v", err)
	}
	return id, nil
}

// EscrowExists
func EscrowExists(ctx contractapi.TransactionContextInterface, escrowID string) (bool, error) {
	data, err := ctx.GetStub().GetState(escrowID)
	if err != nil {
		return false, fmt.Errorf("failed to read from world state: %v", err)
	}
	return data != nil, nil
}
