# Hyperledger Fabric Escrow Network - Architecture

## System Architecture Overview

This document provides a comprehensive explanation of how the Ethereum escrow system was migrated to Hyperledger Fabric, including the technical architecture and design decisions.



## High-Level Architecture

![High level architecture.png](High%20level%20architecture.png)



##  Ethereum to Fabric Migration Mapping

### 1. Identity & Access Management

| **Ethereum**                      | **Fabric**                           |
|-----------------------------------|--------------------------------------|
| **Ethereum Accounts**             | **MSP Identities**                   |
| Private key (secp256k1)           | X.509 certificate + private key      |
| Address (20 bytes)                | MSP ID + Distinguished Name          |
| Keystore file                     | Certificate + Key PEM files          |
| No organization structure         | Hierarchical MSP structure           |

**Example:**
```
Ethereum:
- Account: 0x8a23c7C42333ed6be5a68c24031cd7A737fbcBE8
- Private Key: secp256k1 curve

Fabric:
- MSP ID: Org1MSP
- Identity: CN=User1@org1.example.com
- Certificate: X.509 v3
- Key: ECDSA P-256
```

### 2. Consensus Mechanism

| **Ethereum (PoA Clique)**         | **Fabric (Raft + Endorsement)**     |
|-----------------------------------|--------------------------------------|
| Proof of Authority                | Crash Fault Tolerant Raft           |
| Single-phase consensus            | Multi-phase transaction flow         |
| 2 validator nodes                 | Ordering service + endorsing peers   |
| Block time: ~15 seconds           | Block time: ~2 seconds               |
| Immediate finality                | Immediate finality after commit      |

**Fabric Transaction Flow:**
```
1. Client proposes transaction
2. Endorsing peers simulate & endorse
3. Client collects endorsements
4. Client submits to orderer
5. Orderer orders transactions into blocks
6. Peers validate & commit blocks
```

### 3. Smart Contract / Chaincode

| **Ethereum Smart Contract**       | **Fabric Chaincode**                |
|-----------------------------------|--------------------------------------|
| **Language:** Solidity            | **Language:** Go, JavaScript, Java   |
| Compiled to EVM bytecode          | Compiled to native binary            |
| Deployed on blockchain            | Installed on peers, instantiated     |
| Single deployment                 | Install + Approve + Commit           |
| Gas fees for execution            | No transaction fees                  |
| Public by default                 | Private by channel                   |

**Code Comparison:**

**Ethereum (Solidity):**
```solidity
contract Escrow {
    address payable buyer;
    address payable seller;
    uint funds;
    
    constructor(address payable _seller) {
        seller = _seller;
    }
    
    function deposit() public payable {
        require(msg.sender != seller);
        buyer = msg.sender;
        funds = msg.value;
    }
}
```

**Fabric (Go):**
```go
type EscrowContract struct {
    contractapi.Contract
}

func (ec *EscrowContract) CreateEscrow(ctx contractapi.TransactionContextInterface, 
    escrowID string, seller string, amount float64) error {
    
    escrow := Escrow{
        EscrowID: escrowID,
        Seller:   seller,
        Amount:   amount,
    }
    
    escrowJSON, _ := json.Marshal(escrow)
    return ctx.GetStub().PutState(escrowID, escrowJSON)
}

func (ec *EscrowContract) DepositFunds(ctx contractapi.TransactionContextInterface, 
    escrowID string) error {
    
    clientID, _ := ctx.GetClientIdentity().GetID()
    escrow, _ := ec.GetEscrow(ctx, escrowID)
    
    if clientID == escrow.Seller {
        return fmt.Errorf("seller cannot be buyer")
    }
    
    escrow.Buyer = clientID
    escrow.FundsLocked = true
    
    escrowJSON, _ := json.Marshal(escrow)
    return ctx.GetStub().PutState(escrowID, escrowJSON)
}
```

### 4. State Storage

| **Ethereum**                      | **Fabric**                          |
|-----------------------------------|--------------------------------------|
| **Database:** LevelDB             | **Database:** LevelDB or CouchDB     |
| Key-value store                   | Key-value + rich queries (CouchDB)   |
| Merkle Patricia Trie              | Merkle tree for block validation     |
| World state + transaction log     | World state + blockchain             |
| Single global state               | Channel-specific state               |

**State Management:**

**Ethereum:**
```solidity
mapping(bytes32 => address) escrow_contracts;

function get_escrow(bytes32 _session_id_hash) 
    public view returns (address) {
    return escrow_contracts[_session_id_hash];
}
```

**Fabric:**
```go
// Write state
escrowJSON, _ := json.Marshal(escrow)
ctx.GetStub().PutState(escrowID, escrowJSON)

// Read state
escrowJSON, _ := ctx.GetStub().GetState(escrowID)
json.Unmarshal(escrowJSON, &escrow)

// Rich query (CouchDB only)
queryString := `{"selector":{"status":"FUNDED"}}`
ctx.GetStub().GetQueryResult(queryString)
```

### 5. Transaction & Event Handling

| **Ethereum**                      | **Fabric**                          |
|-----------------------------------|--------------------------------------|
| **Events:** emit keyword          | **Events:** SetEvent()              |
| Indexed parameters                | JSON event payload                   |
| Event logs in transaction receipt | Event blocks on channel              |
| Web3.js event listeners           | Fabric SDK event hub                 |

**Event Comparison:**

**Ethereum:**
```solidity
event buyer_deposit_complete();
event funds_disbursed();

function deposit() public payable {
    // ... logic
    emit buyer_deposit_complete();
}
```

**Fabric:**
```go
eventPayload := fmt.Sprintf(`{"escrowID":"%s","buyer":"%s"}`, escrowID, buyer)
ctx.GetStub().SetEvent("BuyerDepositComplete", []byte(eventPayload))
```

**Client Event Listener (Node.js):**
```javascript
const listener = async (event) => {
    if (event.eventName === 'BuyerDepositComplete') {
        const payload = JSON.parse(event.payload.toString());
        console.log(`Deposit complete for escrow: ${payload.escrowID}`);
    }
};

contract.addContractListener(listener);
```

### 6. Access Control

| **Ethereum**                      | **Fabric**                          |
|-----------------------------------|--------------------------------------|
| **Modifiers:** require()          | **Validation:** Error returns       |
| msg.sender checks                 | GetClientIdentity()                  |
| Role-based (custom)               | MSP-based + attribute-based          |
| Public by default                 | Private by channel                   |

**Access Control Examples:**

**Ethereum:**
```solidity
modifier onlyBuyer() {
    require(msg.sender == buyer, "Only buyer can call this");
    _;
}

function confirmDelivery() public onlyBuyer {
    // ... logic
}
```

**Fabric:**
```go
func (ec *EscrowContract) ConfirmDelivery(ctx contractapi.TransactionContextInterface, 
    escrowID string) error {
    
    clientID, _ := ctx.GetClientIdentity().GetID()
    escrow, _ := ec.GetEscrow(ctx, escrowID)
    
    if clientID != escrow.Buyer {
        return fmt.Errorf("only buyer can confirm delivery")
    }
    
    // ... logic
    return nil
}
```

**Attribute-Based Access Control (ABAC):**
```go
// Check if caller has specific attribute
hasRole, found, _ := ctx.GetClientIdentity().GetAttributeValue("role")
if !found || hasRole != "buyer" {
    return fmt.Errorf("unauthorized")
}
```

---

##  Security Architecture

### 1. Network Security

**Ethereum:**
- PoA consensus with trusted validators
- Node-to-node P2P encryption (optional)
- Single network, public by default

**Fabric:**
- TLS encryption for all communications
- Mutual TLS authentication
- Channel-based privacy
- MSP-based identity management

### 2. Data Privacy

**Ethereum:**
- All data visible to all nodes
- Private transactions via additional tools (Quorum, etc.)
- Limited privacy features

**Fabric:**
- Channel provides data isolation
- Private data collections (PDC)
- Endorsement policy controls access
- Only authorized members see data

**Private Data Collections Example:**
```go
// Define collection config
{
    "name": "collectionEscrowPrivate",
    "policy": "OR('Org1MSP.member', 'Org2MSP.member')",
    "requiredPeerCount": 1,
    "maxPeerCount": 2,
    "blockToLive": 100,
    "memberOnlyRead": true
}

// Store private data
ctx.GetStub().PutPrivateData("collectionEscrowPrivate", key, value)
```

### 3. Endorsement Policy

Defines which organizations must approve a transaction:

**Simple Majority:**
```yaml
endorsementPolicy: "OR('Org1MSP.peer', 'Org2MSP.peer')"
```

**All Must Approve:**
```yaml
endorsementPolicy: "AND('Org1MSP.peer', 'Org2MSP.peer')"
```

**Complex Policy:**
```yaml
endorsementPolicy: "OR(AND('Org1MSP.peer', 'Org2MSP.peer'), AND('Org3MSP.peer', 'Org4MSP.peer'))"
```

---

##  Performance Comparison

| **Metric**                | **Ethereum (PoA)**  | **Fabric**          |
|---------------------------|---------------------|---------------------|
| **Transactions/sec**      | ~100-300            | ~1,000-20,000       |
| **Block time**            | ~15 seconds         | ~2 seconds          |
| **Finality**              | Immediate           | Immediate           |
| **Scalability**           | Limited             | High (channels)     |
| **Query performance**     | Moderate            | Fast (CouchDB)      |

### Transaction Throughput

**Ethereum:** Limited by block gas limit and block time
**Fabric:** Configurable batch size and timeout:

```yaml
# configtx.yaml
Orderer:
    BatchTimeout: 2s
    BatchSize:
        MaxMessageCount: 500
        AbsoluteMaxBytes: 99 MB
        PreferredMaxBytes: 512 KB
```

---

##  Operational Differences

### Deployment Process

**Ethereum:**
1. Compile contract
2. Deploy via transaction
3. Get contract address
4. Interact via Web3

**Fabric:**
1. Package chaincode
2. Install on peers
3. Approve for each org
4. Commit to channel
5. Invoke via SDK

### Upgrading

**Ethereum:**
- Deploy new contract
- Migrate state manually
- Update client references
- Cannot modify existing contract

**Fabric:**
- Package new version
- Install on peers
- Approve new definition
- Commit with incremented sequence
- Maintains state automatically

### Monitoring

**Ethereum:**
- Block explorer
- Node logs
- Web3 event listeners
- Custom indexing

**Fabric:**
- Prometheus metrics
- Peer logs
- Event hub
- CouchDB queries
- Hyperledger Explorer

---

## Design Decisions & Rationale

### 1. Why CouchDB over LevelDB?

**Decision:** Use CouchDB as state database

**Rationale:**
- Rich query support (JSON queries)
- Better for complex escrow queries
- Enables searching by status, buyer, seller
- Easier debugging via Fauxton UI

**Trade-off:** Slightly lower performance than LevelDB

### 2. Why Raft over Kafka?

**Decision:** Use Raft ordering service

**Rationale:**
- Simpler setup and maintenance
- Crash fault tolerant (CFT)
- Better for permissioned networks
- No external Kafka/Zookeeper dependencies

**Trade-off:** Not Byzantine fault tolerant (BFT)

### 3. Channel Strategy

**Decision:** Single channel for all escrow transactions

**Rationale:**
- All participants need visibility
- Simpler network topology
- Easier to manage
- Suitable for escrow use case

**Alternative:** Separate channels per escrow (higher complexity)

### 4. Endorsement Policy

**Decision:** Require endorsement from both Org1 and Org2

**Rationale:**
- Both buyer and seller must validate
- Prevents unilateral actions
- Mimics Ethereum require() checks
- Ensures transaction integrity

---

## Business Logic Preservation

### Escrow State Machine

Both Ethereum and Fabric implementations follow the same state flow:

```
CREATED → FUNDED → DELIVERED → RELEASED → CLOSED
   │                                          ↑
   └──────────────── CANCELLED ──────────────┘
```

### Core Functions Mapping

| **Ethereum Function**         | **Fabric Function**          |
|-------------------------------|------------------------------|
| `constructor()`               | `CreateEscrow()`             |
| `deposit()`                   | `DepositFunds()`             |
| `title_transfer_response()`   | `SetTitleDraftHash()`        |
| `title_draft_greenlight()`    | `ApproveTitleDraft()`        |
| `disburse_funds()`            | `ReleaseFunds()`             |
| `terminate_escrow()`          | `CancelEscrow()`             |
| `get_participants()`          | `GetParticipants()`          |
| `is_open()`                   | `IsOpen()`                   |
| `is_deposit_locked()`         | `IsDepositLocked()`          |

### Business Rules Preserved

- Funds locked until buyer confirmation  
- Seller cannot withdraw before confirmation  
- Escrow can be cancelled (funds returned)  
- Both parties must approve title transfer  
- Complete transaction audit trail  

---

##  Advantages of Fabric Implementation

### 1. **Enterprise Features**
- Modular architecture
- Pluggable consensus
- Private data collections
- Attribute-based access control

### 2. **Performance**
- Higher throughput (1000+ TPS)
- Lower latency (~2 second finality)
- Parallel transaction execution
- Optimized for permissioned networks

### 3. **Privacy**
- Channel-based isolation
- Private data collections
- Only consortium sees data
- Regulatory compliance friendly

### 4. **Scalability**
- Multiple channels for isolation
- Horizontal peer scaling
- State database optimization
- Efficient query capabilities

### 5. **Flexibility**
- Multiple programming languages
- Pluggable components
- Custom endorsement policies
- Easy integration with existing systems


##  Further Reading

- [Hyperledger Fabric Documentation](https://hyperledger-fabric.readthedocs.io/)
- [Fabric Chaincode for Developers](https://hyperledger-fabric.readthedocs.io/en/release-2.5/chaincode.html)
- [Fabric SDK Documentation](https://hyperledger.github.io/fabric-sdk-node/)
- [Ethereum to Fabric Migration Guide](https://www.hyperledger.org/blog)



**This architecture successfully migrates the Ethereum escrow system to Hyperledger Fabric while preserving all business logic and adding enterprise-grade features.**
