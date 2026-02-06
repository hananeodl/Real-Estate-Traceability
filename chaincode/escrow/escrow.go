package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// EscrowContract provides functions for managing escrow transactions
// This is the equivalent of the Escrow.sol smart contract in Ethereum
type EscrowContract struct {
	contractapi.Contract
}

// ============================================================================
// Initialization Function
// ============================================================================

// InitLedger initializes the chaincode with sample data (optional)
func (ec *EscrowContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	fmt.Println("Escrow chaincode initialized successfully")
	return nil
}

// ============================================================================
// Core Escrow Functions
// ============================================================================

// CreateEscrow creates a new escrow transaction
// This is equivalent to the Escrow constructor in Ethereum
// @param escrowID: Unique identifier for the escrow
// @param seller: MSP ID of the seller
// @param amount: Escrow amount
// @param propertyHash: Hash of property details (like title_transfer_hash in Ethereum)
func (ec *EscrowContract) CreateEscrow(ctx contractapi.TransactionContextInterface, escrowID string, seller string, amount float64, propertyHash string) error {
	// Get caller identity (equivalent to msg.sender in Ethereum)
	clientID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return fmt.Errorf("failed to get client identity: %v", err)
	}

	// Check if escrow already exists
	exists, err := ec.EscrowExists(ctx, escrowID)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("escrow %s already exists", escrowID)
	}

	// Validate inputs (equivalent to require() in Solidity)
	if amount <= 0 {
		return fmt.Errorf("amount must be greater than zero")
	}
	if seller == "" || propertyHash == "" {
		return fmt.Errorf("seller and propertyHash are required")
	}

	// Create new escrow
	escrow := Escrow{
		EscrowID:             escrowID,
		Buyer:                "", // Will be set when deposit is made
		Seller:               seller,
		Amount:               amount,
		PropertyHash:         propertyHash,
		TitleDraftHash:       "",
		Status:               StatusCreated,
		BuyerDepositComplete: false,
		BuyerTitleApproval:   false,
		SellerTitleApproval:  true, // Seller automatically approves (like in Ethereum contract)
		FundsLocked:          false,
		CreatedAt:            time.Now(),
		UpdatedAt:            time.Now(),
		TransactionHistory:   []string{fmt.Sprintf("Escrow created by %s", clientID)},
	}

	// Save to world state (equivalent to contract state in Ethereum)
	escrowJSON, err := json.Marshal(escrow)
	if err != nil {
		return err
	}

	err = ctx.GetStub().PutState(escrowID, escrowJSON)
	if err != nil {
		return fmt.Errorf("failed to save escrow: %v", err)
	}

	// Emit event (equivalent to emit in Solidity)
	eventPayload := fmt.Sprintf(`{"escrowID":"%s","seller":"%s","amount":%f}`, escrowID, seller, amount)
	err = ctx.GetStub().SetEvent("EscrowCreated", []byte(eventPayload))
	if err != nil {
		return fmt.Errorf("failed to set event: %v", err)
	}

	return nil
}

// DepositFunds allows buyer to deposit funds into escrow
// This is equivalent to the deposit() function in Ethereum
// @param escrowID: ID of the escrow
// @param propertyHash: Hash must match the original (security check)
func (ec *EscrowContract) DepositFunds(ctx contractapi.TransactionContextInterface, escrowID string, propertyHash string) error {
	// Get caller identity (equivalent to msg.sender)
	clientID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return fmt.Errorf("failed to get client identity: %v", err)
	}

	// Get escrow from world state
	escrow, err := ec.GetEscrow(ctx, escrowID)
	if err != nil {
		return err
	}

	// Validation checks (equivalent to require() statements in Solidity)
	if escrow.Status != StatusCreated {
		return fmt.Errorf("escrow is not in CREATED status, current status: %s", escrow.Status)
	}
	if escrow.FundsLocked {
		return fmt.Errorf("escrow is already locked")
	}
	if clientID == escrow.Seller {
		return fmt.Errorf("seller cannot be the buyer")
	}
	if escrow.PropertyHash != propertyHash {
		return fmt.Errorf("invalid property hash")
	}

	// Update escrow state
	escrow.Buyer = clientID
	escrow.BuyerDepositComplete = true
	escrow.FundsLocked = true
	escrow.Status = StatusFunded
	escrow.UpdatedAt = time.Now()
	escrow.TransactionHistory = append(escrow.TransactionHistory,
		fmt.Sprintf("Funds deposited by buyer %s - Amount: %f", clientID, escrow.Amount))

	// Save updated state
	escrowJSON, err := json.Marshal(escrow)
	if err != nil {
		return err
	}
	err = ctx.GetStub().PutState(escrowID, escrowJSON)
	if err != nil {
		return fmt.Errorf("failed to update escrow: %v", err)
	}

	// Emit event
	eventPayload := fmt.Sprintf(`{"escrowID":"%s","buyer":"%s","amount":%f}`, escrowID, clientID, escrow.Amount)
	err = ctx.GetStub().SetEvent("BuyerDepositComplete", []byte(eventPayload))
	if err != nil {
		return fmt.Errorf("failed to set event: %v", err)
	}

	return nil
}

// SetTitleDraftHash allows oracle/admin to set the title draft hash
// This is equivalent to title_transfer_response() in Ethereum
// @param escrowID: ID of the escrow
// @param titleDraftHash: Hash of the title draft document
func (ec *EscrowContract) SetTitleDraftHash(ctx contractapi.TransactionContextInterface, escrowID string, titleDraftHash string) error {
	// Get caller identity
	clientID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return fmt.Errorf("failed to get client identity: %v", err)
	}

	// Get escrow
	escrow, err := ec.GetEscrow(ctx, escrowID)
	if err != nil {
		return err
	}

	// Validation
	if escrow.Status != StatusFunded {
		return fmt.Errorf("escrow must be funded before setting title draft")
	}

	// Update title draft hash
	escrow.TitleDraftHash = titleDraftHash
	escrow.UpdatedAt = time.Now()
	escrow.TransactionHistory = append(escrow.TransactionHistory,
		fmt.Sprintf("Title draft hash set by %s", clientID))

	// Save state
	escrowJSON, err := json.Marshal(escrow)
	if err != nil {
		return err
	}
	err = ctx.GetStub().PutState(escrowID, escrowJSON)
	if err != nil {
		return fmt.Errorf("failed to update escrow: %v", err)
	}

	// Emit event
	eventPayload := fmt.Sprintf(`{"escrowID":"%s","titleDraftHash":"%s"}`, escrowID, titleDraftHash)
	err = ctx.GetStub().SetEvent("TitleDraftHashSet", []byte(eventPayload))
	if err != nil {
		return fmt.Errorf("failed to set event: %v", err)
	}

	return nil
}

// ApproveTitleDraft allows buyer or seller to approve the title draft
// This is equivalent to title_draft_greenlight() in Ethereum
// @param escrowID: ID of the escrow
// @param titleDraftHash: Hash to verify
// @param approve: true to approve, false to reject
func (ec *EscrowContract) ApproveTitleDraft(ctx contractapi.TransactionContextInterface, escrowID string, titleDraftHash string, approve bool) error {
	// Get caller identity
	clientID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return fmt.Errorf("failed to get client identity: %v", err)
	}

	// Get escrow
	escrow, err := ec.GetEscrow(ctx, escrowID)
	if err != nil {
		return err
	}

	// Validation
	if escrow.Status != StatusFunded {
		return fmt.Errorf("escrow must be funded")
	}
	if escrow.TitleDraftHash == "" {
		return fmt.Errorf("title draft hash not set yet")
	}
	if escrow.TitleDraftHash != titleDraftHash {
		return fmt.Errorf("title draft hash mismatch")
	}
	if clientID != escrow.Buyer && clientID != escrow.Seller {
		return fmt.Errorf("only buyer or seller can approve title draft")
	}

	// Update approval status
	if clientID == escrow.Buyer {
		escrow.BuyerTitleApproval = approve
		escrow.TransactionHistory = append(escrow.TransactionHistory,
			fmt.Sprintf("Buyer approval: %t", approve))
	} else if clientID == escrow.Seller {
		escrow.SellerTitleApproval = approve
		escrow.TransactionHistory = append(escrow.TransactionHistory,
			fmt.Sprintf("Seller approval: %t", approve))
	}

	escrow.UpdatedAt = time.Now()

	// If both parties approved, mark as delivered
	if escrow.BuyerTitleApproval && escrow.SellerTitleApproval && approve {
		escrow.Status = StatusDelivered
		escrow.TransactionHistory = append(escrow.TransactionHistory,
			"Both parties approved title draft - Delivery confirmed")
	}

	// Save state
	escrowJSON, err := json.Marshal(escrow)
	if err != nil {
		return err
	}
	err = ctx.GetStub().PutState(escrowID, escrowJSON)
	if err != nil {
		return fmt.Errorf("failed to update escrow: %v", err)
	}

	// Emit event
	eventPayload := fmt.Sprintf(`{"escrowID":"%s","approver":"%s","approved":%t}`, escrowID, clientID, approve)
	err = ctx.GetStub().SetEvent("TitleDraftApproved", []byte(eventPayload))
	if err != nil {
		return fmt.Errorf("failed to set event: %v", err)
	}

	return nil
}

// ConfirmDelivery allows buyer to confirm delivery/reception
// This triggers the release of funds
// @param escrowID: ID of the escrow
func (ec *EscrowContract) ConfirmDelivery(ctx contractapi.TransactionContextInterface, escrowID string) error {
	// Get caller identity
	clientID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return fmt.Errorf("failed to get client identity: %v", err)
	}

	// Get escrow
	escrow, err := ec.GetEscrow(ctx, escrowID)
	if err != nil {
		return err
	}

	// Validation
	if clientID != escrow.Buyer {
		return fmt.Errorf("only buyer can confirm delivery")
	}
	if escrow.Status != StatusDelivered {
		return fmt.Errorf("delivery must be approved by both parties first")
	}

	// Update status
	escrow.Status = StatusReleased
	escrow.UpdatedAt = time.Now()
	escrow.TransactionHistory = append(escrow.TransactionHistory,
		fmt.Sprintf("Delivery confirmed by buyer %s", clientID))

	// Save state
	escrowJSON, err := json.Marshal(escrow)
	if err != nil {
		return err
	}
	err = ctx.GetStub().PutState(escrowID, escrowJSON)
	if err != nil {
		return fmt.Errorf("failed to update escrow: %v", err)
	}

	// Automatically release funds
	return ec.ReleaseFunds(ctx, escrowID)
}

// ReleaseFunds releases the escrowed funds to the seller
// This is equivalent to disburse_funds() in Ethereum
// @param escrowID: ID of the escrow
func (ec *EscrowContract) ReleaseFunds(ctx contractapi.TransactionContextInterface, escrowID string) error {
	// Get escrow
	escrow, err := ec.GetEscrow(ctx, escrowID)
	if err != nil {
		return err
	}

	// Validation
	if escrow.Status != StatusReleased {
		return fmt.Errorf("escrow must be in RELEASED status")
	}
	if !escrow.BuyerTitleApproval || !escrow.SellerTitleApproval {
		return fmt.Errorf("both parties must approve title draft before releasing funds")
	}

	// Update status
	escrow.Status = StatusClosed
	escrow.CompletedAt = time.Now()
	escrow.UpdatedAt = time.Now()
	escrow.TransactionHistory = append(escrow.TransactionHistory,
		fmt.Sprintf("Funds released to seller %s - Amount: %f", escrow.Seller, escrow.Amount))

	// Save state
	escrowJSON, err := json.Marshal(escrow)
	if err != nil {
		return err
	}
	err = ctx.GetStub().PutState(escrowID, escrowJSON)
	if err != nil {
		return fmt.Errorf("failed to update escrow: %v", err)
	}

	// Emit events
	eventPayload := fmt.Sprintf(`{"escrowID":"%s","seller":"%s","amount":%f}`, escrowID, escrow.Seller, escrow.Amount)
	err = ctx.GetStub().SetEvent("FundsDisbursed", []byte(eventPayload))
	if err != nil {
		return fmt.Errorf("failed to set event: %v", err)
	}

	err = ctx.GetStub().SetEvent("EscrowClosed", []byte(eventPayload))
	if err != nil {
		return fmt.Errorf("failed to set event: %v", err)
	}

	return nil
}

// CancelEscrow cancels the escrow and returns funds to buyer
// This is equivalent to terminate_escrow() in Ethereum
// @param escrowID: ID of the escrow
func (ec *EscrowContract) CancelEscrow(ctx contractapi.TransactionContextInterface, escrowID string) error {
	// Get caller identity
	clientID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return fmt.Errorf("failed to get client identity: %v", err)
	}

	// Get escrow
	escrow, err := ec.GetEscrow(ctx, escrowID)
	if err != nil {
		return err
	}

	// Validation (equivalent to require() in Solidity)
	if escrow.Status == StatusClosed || escrow.Status == StatusCancelled {
		return fmt.Errorf("escrow is already %s", escrow.Status)
	}
	if clientID != escrow.Buyer && clientID != escrow.Seller {
		return fmt.Errorf("only buyer or seller can cancel escrow")
	}

	// Update status
	escrow.Status = StatusCancelled
	escrow.CancelledBy = clientID
	escrow.CompletedAt = time.Now()
	escrow.UpdatedAt = time.Now()
	escrow.TransactionHistory = append(escrow.TransactionHistory,
		fmt.Sprintf("Escrow cancelled by %s - Funds returned to buyer", clientID))

	// Save state
	escrowJSON, err := json.Marshal(escrow)
	if err != nil {
		return err
	}
	err = ctx.GetStub().PutState(escrowID, escrowJSON)
	if err != nil {
		return fmt.Errorf("failed to update escrow: %v", err)
	}

	// Emit event
	eventPayload := fmt.Sprintf(`{"escrowID":"%s","cancelledBy":"%s","buyerRefund":%f}`, escrowID, clientID, escrow.Amount)
	err = ctx.GetStub().SetEvent("EscrowTerminated", []byte(eventPayload))
	if err != nil {
		return fmt.Errorf("failed to set event: %v", err)
	}

	return nil
}

// ============================================================================
// Query Functions
// ============================================================================

// GetEscrow retrieves escrow details
// This is equivalent to the various getter functions in Ethereum
// @param escrowID: ID of the escrow
func (ec *EscrowContract) GetEscrow(ctx contractapi.TransactionContextInterface, escrowID string) (*Escrow, error) {
	escrowJSON, err := ctx.GetStub().GetState(escrowID)
	if err != nil {
		return nil, fmt.Errorf("failed to read escrow: %v", err)
	}
	if escrowJSON == nil {
		return nil, fmt.Errorf("escrow %s does not exist", escrowID)
	}

	var escrow Escrow
	err = json.Unmarshal(escrowJSON, &escrow)
	if err != nil {
		return nil, err
	}

	return &escrow, nil
}

// QueryEscrow - Public wrapper for GetEscrow
func (ec *EscrowContract) QueryEscrow(ctx contractapi.TransactionContextInterface, escrowID string) (*Escrow, error) {
	return ec.GetEscrow(ctx, escrowID)
}

// EscrowExists checks if an escrow exists
// @param escrowID: ID of the escrow
func (ec *EscrowContract) EscrowExists(ctx contractapi.TransactionContextInterface, escrowID string) (bool, error) {
	escrowJSON, err := ctx.GetStub().GetState(escrowID)
	if err != nil {
		return false, fmt.Errorf("failed to read escrow: %v", err)
	}
	return escrowJSON != nil, nil
}

// GetEscrowHistory retrieves the transaction history of an escrow
// @param escrowID: ID of the escrow
func (ec *EscrowContract) GetEscrowHistory(ctx contractapi.TransactionContextInterface, escrowID string) ([]interface{}, error) {
	resultsIterator, err := ctx.GetStub().GetHistoryForKey(escrowID)
	if err != nil {
		return nil, fmt.Errorf("failed to get history: %v", err)
	}
	defer resultsIterator.Close()

	var history []interface{}
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var escrow Escrow
		if len(response.Value) > 0 {
			err = json.Unmarshal(response.Value, &escrow)
			if err != nil {
				return nil, err
			}
		}

		record := map[string]interface{}{
			"txId":      response.TxId,
			"timestamp": response.Timestamp,
			"isDelete":  response.IsDelete,
			"value":     escrow,
		}
		history = append(history, record)
	}

	return history, nil
}

// GetAllEscrows retrieves all escrows (use with caution on large datasets)
func (ec *EscrowContract) GetAllEscrows(ctx contractapi.TransactionContextInterface) ([]*Escrow, error) {
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

// GetEscrowsByStatus retrieves all escrows with a specific status
// This uses CouchDB rich queries (requires CouchDB as state database)
// @param status: Status to filter by (CREATED, FUNDED, DELIVERED, RELEASED, CANCELLED, CLOSED)
func (ec *EscrowContract) GetEscrowsByStatus(ctx contractapi.TransactionContextInterface, status string) ([]*Escrow, error) {
	queryString := fmt.Sprintf(`{"selector":{"status":"%s"}}`, status)
	return ec.getQueryResultForQueryString(ctx, queryString)
}

// GetEscrowsByBuyer retrieves all escrows for a specific buyer
// @param buyer: Buyer MSP ID
func (ec *EscrowContract) GetEscrowsByBuyer(ctx contractapi.TransactionContextInterface, buyer string) ([]*Escrow, error) {
	queryString := fmt.Sprintf(`{"selector":{"buyer":"%s"}}`, buyer)
	return ec.getQueryResultForQueryString(ctx, queryString)
}

// GetEscrowsBySeller retrieves all escrows for a specific seller
// @param seller: Seller MSP ID
func (ec *EscrowContract) GetEscrowsBySeller(ctx contractapi.TransactionContextInterface, seller string) ([]*Escrow, error) {
	queryString := fmt.Sprintf(`{"selector":{"seller":"%s"}}`, seller)
	return ec.getQueryResultForQueryString(ctx, queryString)
}

// ============================================================================
// Helper Functions
// ============================================================================

// getQueryResultForQueryString executes a CouchDB query and returns results
func (ec *EscrowContract) getQueryResultForQueryString(ctx contractapi.TransactionContextInterface, queryString string) ([]*Escrow, error) {
	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
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

// GetParticipants retrieves buyer and seller of an escrow
// This is equivalent to get_participants() in Ethereum
func (ec *EscrowContract) GetParticipants(ctx contractapi.TransactionContextInterface, escrowID string) (map[string]string, error) {
	escrow, err := ec.GetEscrow(ctx, escrowID)
	if err != nil {
		return nil, err
	}

	participants := map[string]string{
		"buyer":  escrow.Buyer,
		"seller": escrow.Seller,
	}

	return participants, nil
}

// IsOpen checks if escrow is still open
// This is equivalent to is_open() in Ethereum
func (ec *EscrowContract) IsOpen(ctx contractapi.TransactionContextInterface, escrowID string) (bool, error) {
	escrow, err := ec.GetEscrow(ctx, escrowID)
	if err != nil {
		return false, err
	}

	return escrow.Status != StatusClosed && escrow.Status != StatusCancelled, nil
}

// IsDepositLocked checks if deposit is locked
// This is equivalent to is_deposit_locked() in Ethereum
func (ec *EscrowContract) IsDepositLocked(ctx contractapi.TransactionContextInterface, escrowID string) (bool, error) {
	escrow, err := ec.GetEscrow(ctx, escrowID)
	if err != nil {
		return false, err
	}

	return escrow.FundsLocked, nil
}
