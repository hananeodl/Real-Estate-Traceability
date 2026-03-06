package main

import (
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

func main() {
	chaincode, err := contractapi.NewChaincode(&EscrowContract{})
	if err != nil {
		fmt.Printf("Error creating escrow chaincode: %v\n", err)
		return
	}

	if err := chaincode.Start(); err != nil {
		fmt.Printf("Error starting escrow chaincode: %v\n", err)
	}
}