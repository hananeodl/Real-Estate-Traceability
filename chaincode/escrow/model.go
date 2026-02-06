package main

import "time"

// Escrow represents the main escrow contract structure
// This is equivalent to the Escrow contract state in Ethereum
type Escrow struct {
	EscrowID             string    `json:"escrowID"`              // Unique identifier (like session_id_hash in Ethereum)
	Buyer                string    `json:"buyer"`                 // Buyer MSP ID
	Seller               string    `json:"seller"`                // Seller MSP ID
	Amount               float64   `json:"amount"`                // Escrow amount (equivalent to msg.value in Ethereum)
	PropertyHash         string    `json:"propertyHash"`          // Hash of property details (like title_transfer_hash)
	TitleDraftHash       string    `json:"titleDraftHash"`        // Hash of title draft document
	Status               string    `json:"status"`                // CREATED, FUNDED, DELIVERED, RELEASED, CANCELLED, CLOSED
	BuyerDepositComplete bool      `json:"buyerDepositComplete"`  // Buyer deposit status
	BuyerTitleApproval   bool      `json:"buyerTitleApproval"`    // Buyer approved title draft
	SellerTitleApproval  bool      `json:"sellerTitleApproval"`   // Seller approved title draft
	FundsLocked          bool      `json:"fundsLocked"`           // Funds are locked
	CreatedAt            time.Time `json:"createdAt"`             // Creation timestamp
	UpdatedAt            time.Time `json:"updatedAt"`             // Last update timestamp
	CompletedAt          time.Time `json:"completedAt,omitempty"` // Completion timestamp
	CancelledBy          string    `json:"cancelledBy,omitempty"` // Who cancelled the escrow
	TransactionHistory   []string  `json:"transactionHistory"`    // History of all transactions
}

// EscrowHistory represents a historical record of escrow state changes
type EscrowHistory struct {
	TxID        string    `json:"txId"`        // Transaction ID
	Timestamp   time.Time `json:"timestamp"`   // When the change occurred
	Action      string    `json:"action"`      // Action performed
	PerformedBy string    `json:"performedBy"` // Who performed the action
	EscrowState Escrow    `json:"escrowState"` // State of escrow at this point
}

// Escrow Status Constants
const (
	StatusCreated   = "CREATED"   // Escrow created, waiting for deposit
	StatusFunded    = "FUNDED"    // Buyer deposited funds
	StatusDelivered = "DELIVERED" // Seller marked as delivered
	StatusReleased  = "RELEASED"  // Funds released to seller
	StatusCancelled = "CANCELLED" // Escrow cancelled
	StatusClosed    = "CLOSED"    // Escrow closed
)

// Action Types for History
const (
	ActionCreate          = "CREATE_ESCROW"
	ActionDeposit         = "DEPOSIT_FUNDS"
	ActionConfirmDelivery = "CONFIRM_DELIVERY"
	ActionReleaseFunds    = "RELEASE_FUNDS"
	ActionCancel          = "CANCEL_ESCROW"
	ActionApproveTitle    = "APPROVE_TITLE"
)

// QueryResult structure used for handling query results
type QueryResult struct {
	Key    string `json:"Key"`
	Record *Escrow
}

// PaginatedQueryResult for paginated queries
type PaginatedQueryResult struct {
	Records             []*Escrow `json:"records"`
	FetchedRecordsCount int32     `json:"fetchedRecordsCount"`
	Bookmark            string    `json:"bookmark"`
}
