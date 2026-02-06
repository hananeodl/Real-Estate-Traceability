package main

import (
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// Main function - Entry point for the chaincode
func main() {
	// Create new escrow smart contract
	escrowChaincode, err := contractapi.NewChaincode(&EscrowContract{})
	if err != nil {
		fmt.Printf("Error creating escrow chaincode: %v\n", err)
		return
	}

	// Start the chaincode
	if err := escrowChaincode.Start(); err != nil {
		fmt.Printf("Error starting escrow chaincode: %v\n", err)
	}
}
