package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// EscrowContract struct
type EscrowContract struct {
	contractapi.Contract
}

// Escrow struct
type Escrow struct {
	ID        string    `json:"id"`
	Buyer     string    `json:"buyer"`
	Seller    string    `json:"seller"`
	Amount    float64   `json:"amount"`
	Status    string    `json:"status"`
	TitleHash string    `json:"titleHash"`
	CreatedAt string    `json:"createdAt"`
	UpdatedAt string    `json:"updatedAt"`
}

// CreateEscrow
func (e *EscrowContract) CreateEscrow(ctx contractapi.TransactionContextInterface,
	id string, buyer string, seller string, amount float64, titleHash string) error {

	// Vérifier si l'escrow existe déjà
	exists, err := e.EscrowExists(ctx, id)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("escrow %s already exists", id)
	}

	// Get transaction timestamp from stub
	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return fmt.Errorf("failed to get transaction timestamp: %v", err)
	}

	// Convert to ISO string for consistency
	timestamp := time.Unix(txTimestamp.Seconds, int64(txTimestamp.Nanos)).Format(time.RFC3339Nano)

	// Créer l'escrow avec le timestamp de la transaction
	escrow := Escrow{
		ID:        id,
		Buyer:     buyer,
		Seller:    seller,
		Amount:    amount,
		Status:    "CREATED",
		TitleHash: titleHash,
		CreatedAt: timestamp,
		UpdatedAt: timestamp,
	}

	escrowJSON, err := json.Marshal(escrow)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(id, escrowJSON)
}

// QueryEscrow - Récupère un escrow
func (e *EscrowContract) QueryEscrow(ctx contractapi.TransactionContextInterface, id string) (*Escrow, error) {
	escrowJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}
	if escrowJSON == nil {
		return nil, fmt.Errorf("escrow %s does not exist", id)
	}

	var escrow Escrow
	err = json.Unmarshal(escrowJSON, &escrow)
	if err != nil {
		return nil, err
	}

	return &escrow, nil
}

// EscrowExists - Vérifie si un escrow existe
func (e *EscrowContract) EscrowExists(ctx contractapi.TransactionContextInterface, id string) (bool, error) {
	escrowJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return false, fmt.Errorf("failed to read from world state: %v", err)
	}
	return escrowJSON != nil, nil
}

// GetAllEscrows - Récupère tous les escrows
func (e *EscrowContract) GetAllEscrows(ctx contractapi.TransactionContextInterface) ([]*Escrow, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var escrows []*Escrow
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var escrow Escrow
		err = json.Unmarshal(queryResponse.Value, &escrow)
		if err != nil {
			return nil, err
		}
		escrows = append(escrows, &escrow)
	}

	return escrows, nil
}