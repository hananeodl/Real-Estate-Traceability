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

        // Désactiver la découverte et utiliser localhost
        const connectOptions = {
            wallet: this.wallet,
            identity: userId,
            discovery: {
                enabled: false,  // Désactiver la découverte
                asLocalhost: true
            }
        };

        await this.gateway.connect(ccp, connectOptions);

        // Obtenir le réseau et le contrat
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
    async createEscrow(escrowId, buyer, amount, propertyHash) {
        try {
            console.log(`📝 Creating escrow ${escrowId}...`);
            const result = await this.contract.submitTransaction(
                'CreateEscrow',
                escrowId,
                buyer,
                amount.toString(),
                propertyHash
            );
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
}

module.exports = FabricClient;