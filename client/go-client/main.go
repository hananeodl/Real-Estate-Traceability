package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"path/filepath"

	"github.com/hyperledger/fabric-sdk-go/pkg/core/config"
	"github.com/hyperledger/fabric-sdk-go/pkg/gateway"
)

// Client represents a Fabric client application
// This is equivalent to Web3.js client in Ethereum
type Client struct {
	gateway  *gateway.Gateway
	network  *gateway.Network
	contract *gateway.Contract
}

func main() {
	log.Println("========================================")
	log.Println("Fabric Escrow Client Application")
	log.Println("========================================")

	// Initialize client
	client, err := NewClient()
	if err != nil {
		log.Fatalf("Failed to create client: %v", err)
	}
	defer client.Close()

	// Example usage - Create an escrow
	err = client.CreateEscrow("ESCROW001", "Org2MSP", 100000.0, "property-hash-123")
	if err != nil {
		log.Printf("Failed to create escrow: %v", err)
	}

	// Query the escrow
	escrow, err := client.QueryEscrow("ESCROW001")
	if err != nil {
		log.Printf("Failed to query escrow: %v", err)
	} else {
		log.Printf("Escrow details: %s", escrow)
	}

	// Example: Deposit funds
	err = client.DepositFunds("ESCROW001", "property-hash-123")
	if err != nil {
		log.Printf("Failed to deposit funds: %v", err)
	}

	// Query updated escrow
	escrow, err = client.QueryEscrow("ESCROW001")
	if err != nil {
		log.Printf("Failed to query escrow: %v", err)
	} else {
		log.Printf("Updated escrow: %s", escrow)
	}

	log.Println("========================================")
	log.Println("Client operations completed")
	log.Println("========================================")
}

// NewClient creates a new Fabric client
func NewClient() (*Client, error) {
	log.Println("Initializing Fabric client...")

	// Load connection profile
	ccpPath := filepath.Join(".", "config.yaml")

	// Create gateway
	gw, err := gateway.Connect(
		gateway.WithConfig(config.FromFile(filepath.Clean(ccpPath))),
		gateway.WithIdentity(newIdentity()),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to gateway: %w", err)
	}

	// Get network
	network, err := gw.GetNetwork("mychannel")
	if err != nil {
		gw.Close()
		return nil, fmt.Errorf("failed to get network: %w", err)
	}

	// Get contract
	contract := network.GetContract("escrow")

	log.Println("Client initialized successfully")

	return &Client{
		gateway:  gw,
		network:  network,
		contract: contract,
	}, nil
}

// Close closes the gateway connection
func (c *Client) Close() {
	if c.gateway != nil {
		c.gateway.Close()
	}
}

// CreateEscrow creates a new escrow transaction
// This is equivalent to calling the Escrow constructor in Ethereum
func (c *Client) CreateEscrow(escrowID, seller string, amount float64, propertyHash string) error {
	log.Printf("Creating escrow: %s", escrowID)

	_, err := c.contract.SubmitTransaction(
		"CreateEscrow",
		escrowID,
		seller,
		fmt.Sprintf("%f", amount),
		propertyHash,
	)
	if err != nil {
		return fmt.Errorf("failed to submit transaction: %w", err)
	}

	log.Printf("Escrow %s created successfully", escrowID)
	return nil
}

// DepositFunds deposits funds into an escrow
// This is equivalent to calling deposit() in Ethereum
func (c *Client) DepositFunds(escrowID, propertyHash string) error {
	log.Printf("Depositing funds for escrow: %s", escrowID)

	_, err := c.contract.SubmitTransaction(
		"DepositFunds",
		escrowID,
		propertyHash,
	)
	if err != nil {
		return fmt.Errorf("failed to submit transaction: %w", err)
	}

	log.Printf("Funds deposited for escrow %s", escrowID)
	return nil
}

// SetTitleDraftHash sets the title draft hash
func (c *Client) SetTitleDraftHash(escrowID, titleDraftHash string) error {
	log.Printf("Setting title draft hash for escrow: %s", escrowID)

	_, err := c.contract.SubmitTransaction(
		"SetTitleDraftHash",
		escrowID,
		titleDraftHash,
	)
	if err != nil {
		return fmt.Errorf("failed to submit transaction: %w", err)
	}

	log.Printf("Title draft hash set for escrow %s", escrowID)
	return nil
}

// ApproveTitleDraft approves the title draft
func (c *Client) ApproveTitleDraft(escrowID, titleDraftHash string, approve bool) error {
	log.Printf("Approving title draft for escrow: %s", escrowID)

	approveStr := "false"
	if approve {
		approveStr = "true"
	}

	_, err := c.contract.SubmitTransaction(
		"ApproveTitleDraft",
		escrowID,
		titleDraftHash,
		approveStr,
	)
	if err != nil {
		return fmt.Errorf("failed to submit transaction: %w", err)
	}

	log.Printf("Title draft approved for escrow %s", escrowID)
	return nil
}

// ConfirmDelivery confirms delivery
func (c *Client) ConfirmDelivery(escrowID string) error {
	log.Printf("Confirming delivery for escrow: %s", escrowID)

	_, err := c.contract.SubmitTransaction(
		"ConfirmDelivery",
		escrowID,
	)
	if err != nil {
		return fmt.Errorf("failed to submit transaction: %w", err)
	}

	log.Printf("Delivery confirmed for escrow %s", escrowID)
	return nil
}

// CancelEscrow cancels an escrow
func (c *Client) CancelEscrow(escrowID string) error {
	log.Printf("Cancelling escrow: %s", escrowID)

	_, err := c.contract.SubmitTransaction(
		"CancelEscrow",
		escrowID,
	)
	if err != nil {
		return fmt.Errorf("failed to submit transaction: %w", err)
	}

	log.Printf("Escrow %s cancelled", escrowID)
	return nil
}

// QueryEscrow queries escrow details
// This is equivalent to calling getter functions in Ethereum
func (c *Client) QueryEscrow(escrowID string) (string, error) {
	log.Printf("Querying escrow: %s", escrowID)

	result, err := c.contract.EvaluateTransaction("QueryEscrow", escrowID)
	if err != nil {
		return "", fmt.Errorf("failed to evaluate transaction: %w", err)
	}

	return string(result), nil
}

// GetEscrowHistory gets the transaction history
func (c *Client) GetEscrowHistory(escrowID string) (string, error) {
	log.Printf("Getting history for escrow: %s", escrowID)

	result, err := c.contract.EvaluateTransaction("GetEscrowHistory", escrowID)
	if err != nil {
		return "", fmt.Errorf("failed to evaluate transaction: %w", err)
	}

	return string(result), nil
}

// GetAllEscrows gets all escrows
func (c *Client) GetAllEscrows() (string, error) {
	log.Println("Getting all escrows")

	result, err := c.contract.EvaluateTransaction("GetAllEscrows")
	if err != nil {
		return "", fmt.Errorf("failed to evaluate transaction: %w", err)
	}

	return string(result), nil
}

// Helper function to create identity from wallet
func newIdentity() *gateway.X509Identity {
	// Load certificate
	certPath := filepath.Join("wallet", "User1@org1.example.com", "cert.pem")
	cert, err := ioutil.ReadFile(filepath.Clean(certPath))
	if err != nil {
		log.Fatalf("Failed to read certificate: %v", err)
	}

	// Load private key
	keyPath := filepath.Join("wallet", "User1@org1.example.com", "key.pem")
	key, err := ioutil.ReadFile(filepath.Clean(keyPath))
	if err != nil {
		log.Fatalf("Failed to read private key: %v", err)
	}

	return gateway.NewX509Identity("Org1MSP", string(cert), string(key))
}
