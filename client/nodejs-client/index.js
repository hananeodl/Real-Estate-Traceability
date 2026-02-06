/**
 * Fabric Escrow Client Application (Node.js)
 * This is equivalent to Web3.js client in Ethereum
 */

const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const fs = require('fs');

class EscrowClient {
    constructor() {
        this.gateway = null;
        this.contract = null;
        this.network = null;
    }

    /**
     * Initialize the Fabric client
     */
    async initialize() {
        try {
            console.log('========================================');
            console.log('Initializing Fabric Client');
            console.log('========================================');

            // Load connection profile
            const ccpPath = path.resolve(__dirname, 'connection-profile.json');
            const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

            // Create wallet
            const walletPath = path.join(__dirname, 'wallet');
            const wallet = await Wallets.newFileSystemWallet(walletPath);

            // Check if identity exists in wallet
            const identity = await wallet.get('appUser');
            if (!identity) {
                console.log('Identity not found in wallet. Please enroll user first.');
                console.log('Run: node enrollUser.js');
                return false;
            }

            // Create gateway
            this.gateway = new Gateway();
            await this.gateway.connect(ccp, {
                wallet,
                identity: 'appUser',
                discovery: { enabled: true, asLocalhost: true }
            });

            // Get network and contract
            this.network = await this.gateway.getNetwork('mychannel');
            this.contract = this.network.getContract('escrow');

            console.log('Client initialized successfully');
            console.log('========================================\n');

            return true;
        } catch (error) {
            console.error(`Failed to initialize client: ${error}`);
            return false;
        }
    }

    /**
     * Close gateway connection
     */
    async disconnect() {
        if (this.gateway) {
            this.gateway.disconnect();
            console.log('Gateway disconnected');
        }
    }

    /**
     * Create a new escrow transaction
     * Equivalent to Escrow constructor in Ethereum
     */
    async createEscrow(escrowID, seller, amount, propertyHash) {
        try {
            console.log(`Creating escrow: ${escrowID}`);

            await this.contract.submitTransaction(
                'CreateEscrow',
                escrowID,
                seller,
                amount.toString(),
                propertyHash
            );

            console.log(`✓ Escrow ${escrowID} created successfully\n`);
            return true;
        } catch (error) {
            console.error(`✗ Failed to create escrow: ${error}\n`);
            return false;
        }
    }

    /**
     * Deposit funds into escrow
     * Equivalent to deposit() in Ethereum
     */
    async depositFunds(escrowID, propertyHash) {
        try {
            console.log(`Depositing funds for escrow: ${escrowID}`);

            await this.contract.submitTransaction(
                'DepositFunds',
                escrowID,
                propertyHash
            );

            console.log(`✓ Funds deposited for escrow ${escrowID}\n`);
            return true;
        } catch (error) {
            console.error(`✗ Failed to deposit funds: ${error}\n`);
            return false;
        }
    }

    /**
     * Set title draft hash
     */
    async setTitleDraftHash(escrowID, titleDraftHash) {
        try {
            console.log(`Setting title draft hash for escrow: ${escrowID}`);

            await this.contract.submitTransaction(
                'SetTitleDraftHash',
                escrowID,
                titleDraftHash
            );

            console.log(`✓ Title draft hash set for escrow ${escrowID}\n`);
            return true;
        } catch (error) {
            console.error(`✗ Failed to set title draft hash: ${error}\n`);
            return false;
        }
    }

    /**
     * Approve title draft
     */
    async approveTitleDraft(escrowID, titleDraftHash, approve) {
        try {
            console.log(`Approving title draft for escrow: ${escrowID}`);

            await this.contract.submitTransaction(
                'ApproveTitleDraft',
                escrowID,
                titleDraftHash,
                approve.toString()
            );

            console.log(`✓ Title draft ${approve ? 'approved' : 'rejected'} for escrow ${escrowID}\n`);
            return true;
        } catch (error) {
            console.error(`✗ Failed to approve title draft: ${error}\n`);
            return false;
        }
    }

    /**
     * Confirm delivery
     */
    async confirmDelivery(escrowID) {
        try {
            console.log(`Confirming delivery for escrow: ${escrowID}`);

            await this.contract.submitTransaction(
                'ConfirmDelivery',
                escrowID
            );

            console.log(`✓ Delivery confirmed for escrow ${escrowID}\n`);
            return true;
        } catch (error) {
            console.error(`✗ Failed to confirm delivery: ${error}\n`);
            return false;
        }
    }

    /**
     * Cancel escrow
     */
    async cancelEscrow(escrowID) {
        try {
            console.log(`Cancelling escrow: ${escrowID}`);

            await this.contract.submitTransaction(
                'CancelEscrow',
                escrowID
            );

            console.log(`✓ Escrow ${escrowID} cancelled\n`);
            return true;
        } catch (error) {
            console.error(`✗ Failed to cancel escrow: ${error}\n`);
            return false;
        }
    }

    /**
     * Query escrow details
     * Equivalent to getter functions in Ethereum
     */
    async queryEscrow(escrowID) {
        try {
            console.log(`Querying escrow: ${escrowID}`);

            const result = await this.contract.evaluateTransaction(
                'QueryEscrow',
                escrowID
            );

            const escrow = JSON.parse(result.toString());
            console.log('✓ Escrow details:');
            console.log(JSON.stringify(escrow, null, 2));
            console.log();

            return escrow;
        } catch (error) {
            console.error(`✗ Failed to query escrow: ${error}\n`);
            return null;
        }
    }

    /**
     * Get escrow history
     */
    async getEscrowHistory(escrowID) {
        try {
            console.log(`Getting history for escrow: ${escrowID}`);

            const result = await this.contract.evaluateTransaction(
                'GetEscrowHistory',
                escrowID
            );

            const history = JSON.parse(result.toString());
            console.log('✓ Escrow history:');
            console.log(JSON.stringify(history, null, 2));
            console.log();

            return history;
        } catch (error) {
            console.error(`✗ Failed to get escrow history: ${error}\n`);
            return null;
        }
    }

    /**
     * Get all escrows
     */
    async getAllEscrows() {
        try {
            console.log('Getting all escrows');

            const result = await this.contract.evaluateTransaction('GetAllEscrows');
            const escrows = JSON.parse(result.toString());

            console.log(`✓ Found ${escrows.length} escrows`);
            console.log(JSON.stringify(escrows, null, 2));
            console.log();

            return escrows;
        } catch (error) {
            console.error(`✗ Failed to get all escrows: ${error}\n`);
            return null;
        }
    }

    /**
     * Get escrows by status
     */
    async getEscrowsByStatus(status) {
        try {
            console.log(`Getting escrows with status: ${status}`);

            const result = await this.contract.evaluateTransaction(
                'GetEscrowsByStatus',
                status
            );

            const escrows = JSON.parse(result.toString());
            console.log(`✓ Found ${escrows.length} escrows with status ${status}`);
            console.log(JSON.stringify(escrows, null, 2));
            console.log();

            return escrows;
        } catch (error) {
            console.error(`✗ Failed to get escrows by status: ${error}\n`);
            return null;
        }
    }
}

/**
 * Main function - Example usage
 */
async function main() {
    const client = new EscrowClient();

    try {
        // Initialize client
        const initialized = await client.initialize();
        if (!initialized) {
            return;
        }

        // Example 1: Create escrow
        await client.createEscrow(
            'ESCROW001',
            'Org2MSP',
            100000.0,
            'property-hash-12345'
        );

        // Example 2: Query escrow
        await client.queryEscrow('ESCROW001');

        // Example 3: Deposit funds (as buyer)
        await client.depositFunds('ESCROW001', 'property-hash-12345');

        // Example 4: Query updated escrow
        await client.queryEscrow('ESCROW001');

        // Example 5: Set title draft hash
        await client.setTitleDraftHash('ESCROW001', 'title-draft-hash-67890');

        // Example 6: Approve title draft (buyer)
        await client.approveTitleDraft('ESCROW001', 'title-draft-hash-67890', true);

        // Example 7: Get escrow history
        await client.getEscrowHistory('ESCROW001');

        // Example 8: Get all escrows
        await client.getAllEscrows();

        console.log('========================================');
        console.log('All operations completed successfully');
        console.log('========================================');

    } catch (error) {
        console.error(`Error: ${error}`);
        process.exit(1);
    } finally {
        // Disconnect
        await client.disconnect();
    }
}

// Run main function if this file is executed directly
if (require.main === module) {
    main();
}

// Export for use in other modules
module.exports = EscrowClient;