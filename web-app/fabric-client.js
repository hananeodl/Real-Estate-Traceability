const path = require('path');
const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const fs = require('fs');
const yaml = require('js-yaml');

class FabricClient {
    constructor() {
        this.gateway = null;
        this.contract = null;
        this.network = null;
        this.wallet = null;
        this.currentUser = null;
        this.completedTransactions = [];
    }

    /**
     * Load connection profile for test-network
     */
    async loadConnectionProfile(org = 1) {
        try {
            // Utiliser les fichiers de configuration de test-network
            const configPath = path.resolve(__dirname, 'config', `connection-org${org}.yaml`);

            console.log(`Loading config for Org${org} from: ${configPath}`);

            const fileContents = fs.readFileSync(configPath, 'utf8');
            return yaml.load(fileContents);
        } catch (error) {
            console.error(`Error loading connection profile: ${error}`);
            throw error;
        }
    }

    /**
     * Get CA certificate from PEM string
     */
    getCACertificate(caInfo) {
        if (caInfo.tlsCACerts && caInfo.tlsCACerts.pem) {
            if (Array.isArray(caInfo.tlsCACerts.pem)) {
                return caInfo.tlsCACerts.pem.join('');
            }
            return caInfo.tlsCACerts.pem;
        }
        throw new Error('No TLS CA certificate found in CA configuration');
    }

    /**
     * Enroll a new user with the Certificate Authority
     */
async enrollUser(org, userId, userType) {
    try {
        console.log(`📝 Enrolling ${userId} for Org${org}...`);

        const ccp = await this.loadConnectionProfile(org);

        const walletPath = path.join(__dirname, 'wallet');
        if (!fs.existsSync(walletPath)) {
            fs.mkdirSync(walletPath, { recursive: true });
        }

        this.wallet = await Wallets.newFileSystemWallet(walletPath);

        const identity = await this.wallet.get(userId);
        if (identity) {
            console.log(`User ${userId} already exists in wallet`);
            return true;
        }

        // Get CA information
        const caName = `ca.org${org}.example.com`;
        const caInfo = ccp.certificateAuthorities[caName];

        if (!caInfo) {
            console.error(`CA ${caName} not found in config`);
            return false;
        }

        // Get CA certificate from PEM - format it properly
        let caCert = '';
        if (caInfo.tlsCACerts && caInfo.tlsCACerts.pem) {
            // If it's an array, join it
            if (Array.isArray(caInfo.tlsCACerts.pem)) {
                caCert = caInfo.tlsCACerts.pem.join('');
            } else {
                caCert = caInfo.tlsCACerts.pem;
            }
        }

        // Create CA client - trustedRoots must be a string, not an array
        const ca = new FabricCAServices(caInfo.url, {
            trustedRoots: caCert,  // Pass as string, not array
            verify: false
        }, caInfo.caName);

        try {
            // First enroll admin
            console.log('Enrolling admin...');
            const adminEnrollment = await ca.enroll({
                enrollmentID: 'admin',
                enrollmentSecret: 'adminpw'
            });

            const adminIdentity = {
                credentials: {
                    certificate: adminEnrollment.certificate,
                    privateKey: adminEnrollment.key.toBytes(),
                },
                mspId: `Org${org}MSP`,
                type: 'X.509',
            };
            await this.wallet.put('admin', adminIdentity);

            // Register new user via admin
            console.log(`Registering ${userId}...`);
            const adminProvider = this.wallet.getProviderRegistry().getProvider(adminIdentity.type);
            const adminUser = await adminProvider.getUserContext(adminIdentity, 'admin');

            const secret = await ca.register({
                enrollmentID: userId,
                affiliation: `org${org}.department1`,
                role: 'client',
                attrs: [{ name: 'userType', value: userType, ecert: true }]
            }, adminUser);

            // Enroll new user with the secret
            console.log(`Enrolling ${userId} with generated secret...`);
            const enrollment = await ca.enroll({
                enrollmentID: userId,
                enrollmentSecret: secret
            });

            const userIdentity = {
                credentials: {
                    certificate: enrollment.certificate,
                    privateKey: enrollment.key.toBytes(),
                },
                mspId: `Org${org}MSP`,
                type: 'X.509',
            };
            await this.wallet.put(userId, userIdentity);

            console.log(`✓ User ${userId} enrolled successfully for Org${org}`);
            return true;

        } catch (error) {
            console.error(`✗ Enrollment failed: ${error}`);
            return false;
        }

    } catch (error) {
        console.error(`✗ Failed to enroll user: ${error}`);
        return false;
    }
}

    /**
     * Connect to the network as a specific user
     */
async connect(userId) {
    try {
        console.log(`🔌 Connecting as ${userId}...`);

        const walletPath = path.join(__dirname, 'wallet');
        this.wallet = await Wallets.newFileSystemWallet(walletPath);

        const identity = await this.wallet.get(userId);
        if (!identity) {
            console.log(`User ${userId} not found in wallet`);
            return false;
        }

        const org = identity.mspId === 'Org1MSP' ? 1 : 2;

        const ccp = await this.loadConnectionProfile(org);

        this.gateway = new Gateway();

        // DÉSACTIVER LA DÉCOUVERTE
        const connectOptions = {
            wallet: this.wallet,
            identity: userId,
            discovery: {
                enabled: false,
                asLocalhost: true
            }
        };

        await this.gateway.connect(ccp, connectOptions);

        this.network = await this.gateway.getNetwork('mychannel');
        this.contract = this.network.getContract('escrow');
        this.currentUser = userId;

        console.log(`✓ Connected as ${userId} (Org${org})`);
        return true;

    } catch (error) {
        console.error(`✗ Failed to connect: ${error}`);
        return false;
    }
}

    /**
     * Disconnect from the network
     */
    disconnect() {
        if (this.gateway) {
            this.gateway.disconnect();
            this.currentUser = null;
            console.log('Disconnected from network');
        }
    }

    /**
     * Create a new escrow (Seller only)
     */
async createEscrow(escrowId, buyer, seller, amount, propertyHash) {
    try {
        console.log(`📝 Creating escrow ${escrowId}...`);

        // Utiliser l'admin pour soumettre la transaction
        const adminIdentity = await this.wallet.get('admin');
        if (!adminIdentity) {
            return { success: false, error: 'Admin not found in wallet' };
        }

        const adminCcp = await this.loadConnectionProfile(1); // Forcer Org1

        const adminGateway = new Gateway();
        await adminGateway.connect(adminCcp, {
            wallet: this.wallet,
            identity: 'admin',
            discovery: { enabled: false, asLocalhost: true }
        });

        const adminNetwork = await adminGateway.getNetwork('mychannel');
        const adminContract = adminNetwork.getContract('escrow');

        const result = await adminContract.submitTransaction(
            'CreateEscrow',
            escrowId,
            buyer,
            seller,
            String(amount),
            propertyHash
        );

        await adminGateway.disconnect();

        console.log(`✅ Escrow ${escrowId} created`);
        return { success: true, message: result.toString() };
    } catch (error) {
        console.error(`❌ Failed to create escrow: ${error}`);
        return { success: false, error: error.message };
    }
}
    /**
     * Query an escrow
     */
    async queryEscrow(escrowId) {
        try {
                console.log(`📋 Returning escrow for ${escrowId}`);
            const result = await this.contract.evaluateTransaction('QueryEscrow', escrowId);
            return { success: true, data: JSON.parse(result.toString()) };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all escrows
     */
    async getAllEscrows() {
        try {
            console.log(`📋 Returning escrows`);
            const result = await this.contract.evaluateTransaction('GetAllEscrows');
            return { success: true, data: JSON.parse(result.toString()) };
        } catch (error) {
            console.error(`Query error: ${error}`);
            return { success: false, data: [] };
        }
    }

    /**
     * Deposit funds (Buyer only)
     */
    async depositFunds(escrowId) {
        try {
            console.log(`💰 Depositing funds for escrow ${escrowId}...`);
            const result = await this.contract.submitTransaction('DepositFunds', escrowId);
            return { success: true, message: result.toString() };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get escrows by status
     */
    async getEscrowsByStatus(status) {
        try {
            const result = await this.contract.evaluateTransaction('GetEscrowsByStatus', status);
            return { success: true, data: JSON.parse(result.toString()) };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

// ============================================
// FONCTIONS FINALES
// ============================================

async completeEscrow(escrowId, propertyId, sessionDetails) {
    try {
        console.log(`\n🚀 Finalisation de l'escrow ${escrowId} sur la blockchain...`);

        // Vérifier que le contract est initialisé
        if (!this.contract) {
            throw new Error('Client non connecté à la blockchain');
        }

        // Appeler la fonction du chaincode pour finaliser l'escrow
        const result = await this.contract.submitTransaction(
            'CompleteEscrow',
            escrowId,
            propertyId,
            JSON.stringify({
                buyerId: sessionDetails.buyerId,
                sellerId: sessionDetails.sellerId,
                finalAmount: sessionDetails.amount - (sessionDetails.depositAmount || 0),
                depositAmount: sessionDetails.depositAmount || 0,
                propertyTitle: sessionDetails.propertyTitle
            })
        );

        // Parse the result
        const txResult = JSON.parse(result.toString());

        console.log(`✅ Escrow ${escrowId} finalisé avec succès sur la blockchain`);

        return {
            success: true,
            data: txResult
        };

    } catch (error) {
        console.error(`❌ Erreur de finalisation sur la blockchain: ${error}`);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get escrow details directly from the blockchain
 */
async getEscrowDetails(escrowId) {
    try {
        console.log(`🔍 Récupération des détails pour l'escrow: ${escrowId}`);

        // Vérifier que le contract est initialisé
        if (!this.contract) {
            throw new Error('Client non connecté à la blockchain');
        }

        // Appeler la fonction QueryEscrow du chaincode
        const result = await this.contract.evaluateTransaction(
            'QueryEscrow',
            escrowId
        );

        // Parse the result
        const escrowData = JSON.parse(result.toString());

        console.log(`✅ Détails récupérés pour l'escrow ${escrowId}`);

        return {
            success: true,
            data: {
                id: escrowData.ID || escrowData.id,
                buyer: escrowData.Buyer || escrowData.buyer,
                seller: escrowData.Seller || escrowData.seller,
                amount: escrowData.Amount || escrowData.amount,
                status: escrowData.Status || escrowData.status,
                titleHash: escrowData.TitleHash || escrowData.titleHash,
                depositPaid: escrowData.DepositPaid || false,
                depositReference: escrowData.DepositReference,
                depositConfirmedByBank: escrowData.DepositConfirmedByBank || false,
                finalPaymentMade: escrowData.FinalPaymentMade || false,
                finalPaymentReference: escrowData.FinalPaymentReference,
                createdAt: escrowData.CreatedAt || escrowData.createdAt,
                updatedAt: escrowData.UpdatedAt || escrowData.updatedAt
            }
        };

    } catch (error) {
        console.error(`❌ Erreur lors de la récupération de l'escrow ${escrowId}:`, error);

        if (error.message.includes('does not exist')) {
            return {
                success: false,
                error: `L'escrow ${escrowId} n'existe pas`
            };
        }
        return {
            success: false,
            error: error.message
        };
    }
}


/**
 * Get completed transactions for a user
 */
async getCompletedTransactions(userId) {
    try {
        console.log(`🔍 Récupération des transactions complétées pour ${userId}`);

        // récupérer tous les escrows
        const result = await this.getAllEscrows();

        if (!result.success) {
            return { success: false, data: [], error: result.error };
        }

        // Filtrer ceux qui sont complétés et où l'utilisateur est impliqué
        const completedTx = result.data.filter(escrow =>
            (escrow.Status === 'COMPLETED' || escrow.status === 'COMPLETED') &&
            (escrow.Buyer === userId || escrow.Seller === userId ||
             escrow.buyer === userId || escrow.seller === userId)
        );

        console.log(`✅ ${completedTx.length} transactions complétées trouvées`);

        return {
            success: true,
            data: completedTx
        };

    } catch (error) {
        console.error(`❌ Erreur: ${error}`);
        return {
            success: false,
            data: [],
            error: error.message
        };
    }
}

/**
 * Get transaction details from blockchain
 */
async getTransactionDetails(escrowId) {
    // Cette fonction est un alias de getEscrowDetails
    return this.getEscrowDetails(escrowId);
}

/**
 * Transfer property ownership on the blockchain
 */
async transferProperty(escrowId, propertyId, newOwnerId) {
    try {
        console.log(`📝 Transfert de propriété ${propertyId} à ${newOwnerId}...`);

        if (!this.contract) {
            throw new Error('Client non connecté à la blockchain');
        }

        const result = await this.contract.submitTransaction(
            'TransferProperty',
            escrowId,
            propertyId,
            newOwnerId
        );

        console.log(`✅ Propriété ${propertyId} transférée avec succès`);

        return {
            success: true,
            message: result.toString()
        };

    } catch (error) {
        console.error(`❌ Erreur de transfert: ${error}`);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Archive contract hash in the escrow record
 */
async archiveContract(escrowId, contractHash) {
    try {
        console.log(`📝 Archivage du contrat ${contractHash} pour l'escrow ${escrowId}...`);

        if (!this.contract) {
            throw new Error('Client non connecté à la blockchain');
        }

        const result = await this.contract.submitTransaction(
            'ArchiveContract',
            escrowId,
            contractHash
        );

        console.log(`✅ Contrat archivé avec succès`);

        return {
            success: true,
            message: result.toString()
        };

    } catch (error) {
        console.error(`❌ Erreur d'archivage: ${error}`);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Update escrow status on blockchain
 */
async updateEscrowStatus(escrowId, newStatus) {
    try {
        console.log(`📝 Mise à jour du statut de l'escrow ${escrowId} vers ${newStatus}...`);

        if (!this.contract) {
            throw new Error('Client non connecté à la blockchain');
        }

        const result = await this.contract.submitTransaction(
            'UpdateEscrowStatus',
            escrowId,
            newStatus
        );

        console.log(`✅ Statut mis à jour avec succès`);

        return {
            success: true,
            message: result.toString()
        };

    } catch (error) {
        console.error(`❌ Erreur de mise à jour: ${error}`);
        return {
            success: false,
            error: error.message
        };
    }
}
}

module.exports = FabricClient;