const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const FabricClient = require('./fabric-client');

const app = express();
const port = 3000;
const fabricClient = new FabricClient();

// Configuration
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'fabric-escrow-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Base de données simulée
let users = [];
let properties = [];
let sessions = [];

// ============================================
// ROUTES PUBLIQUES
// ============================================

app.get('/', (req, res) => {
    res.render('index', { user: req.session.user });
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
    const { id, name, type, password } = req.body;
    const org = type === 'buyer' ? 1 : 2;

    console.log(`📝 Inscription: ${id} (${type})`);

    const enrolled = await fabricClient.enrollUser(org, id, type);
    if (!enrolled) {
        console.log('❌ Échec enrollment');
        return res.send('Failed to enroll user');
    }

    users.push({ id, name, type, org, password });
    console.log(`✅ Utilisateur inscrit: ${id}`);
    res.redirect('/login');
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    console.log('========================================');
    console.log('🔐 Tentative de connexion');
    console.log('========================================');
    console.log('Données reçues:', req.body);

    const { id, password } = req.body;

    if (!id || !password) {
        return res.render('login', {
            error: 'Veuillez remplir tous les champs',
            id: id || ''
        });
    }

    const user = users.find(u => u.id === id && u.password === password);

    if (user) {
        console.log(`✅ Utilisateur trouvé: ${user.id} (${user.type})`);

        try {
            const connected = await fabricClient.connect(id);

            if (connected) {
                req.session.user = user;
                console.log('🎉 Connexion réussie!');
                res.redirect('/dashboard');
            } else {
                res.render('login', {
                    error: 'Échec de connexion à la blockchain',
                    id: id
                });
            }
        } catch (error) {
            console.error('💥 Erreur:', error);
            res.render('login', {
                error: 'Erreur technique: ' + error.message,
                id: id
            });
        }
    } else {
        res.render('login', {
            error: 'Identifiant ou mot de passe incorrect',
            id: id
        });
    }
});

app.get('/logout', (req, res) => {
    fabricClient.disconnect();
    req.session.destroy();
    res.redirect('/');
});

// ============================================
// DASHBOARD PRINCIPAL
// ============================================

app.get('/dashboard', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const user = req.session.user;

    // Récupérer les escrows de la blockchain
    const result = await fabricClient.getAllEscrows();
    const allEscrows = result.success ? result.data : [];

    const myEscrows = allEscrows.filter(e =>
        user.type === 'buyer' ? e.Buyer === user.id : e.Seller === user.id
    );

    // Propriétés locales
    const myProperties = properties.filter(p => p.sellerId === user.id);
    const availableProperties = properties.filter(p => p.status === 'verified');

    res.render('dashboard', {
        user,
        properties: user.type === 'seller' ? myProperties : availableProperties,
        escrows: myEscrows,
        sessions: sessions.filter(s =>
            user.type === 'seller' ? s.sellerId === user.id : s.buyerId === user.id
        )
    });
});

// ============================================
// ROUTES PROPRIÉTÉS
// ============================================

app.get('/property/add', (req, res) => {
    if (!req.session.user || req.session.user.type !== 'seller') {
        return res.redirect('/login');
    }
    res.render('property', { user: req.session.user, property: null });
});

app.post('/property/add', (req, res) => {
    const { title, description, price, location } = req.body;
    const property = {
        id: `prop_${Date.now()}`,
        title,
        description,
        price: parseFloat(price),
        location,
        sellerId: req.session.user.id,
        sellerName: req.session.user.name,
        status: 'pending_verification',
        offers: [],
        createdAt: new Date()
    };
    properties.push(property);
    console.log(`✅ Propriété créée: ${property.title} par ${req.session.user.id}`);
    res.redirect('/dashboard');
});

app.post('/property/:id/verify', (req, res) => {
    const property = properties.find(p => p.id === req.params.id);
    if (property && property.sellerId === req.session.user.id) {
        property.status = 'verified';
        property.titleDeed = req.body.titleDeed || 'verified';
        console.log(`✅ Propriété vérifiée: ${property.id}`);
    }
    res.redirect('/dashboard');
});

app.post('/property/:id/offer', (req, res) => {
    console.log(`📦 Offre reçue pour propriété: ${req.params.id}`);

    const property = properties.find(p => p.id === req.params.id);
    if (!property) {
        console.log('❌ Propriété non trouvée');
        return res.redirect('/dashboard');
    }

    if (property.status !== 'verified') {
        console.log('❌ Propriété non vérifiée');
        return res.redirect('/dashboard');
    }

    // Vérifier si l'utilisateur a déjà fait une offre
    const existingOffer = property.offers ? property.offers.find(o => o.buyerId === req.session.user.id) : null;
    if (existingOffer) {
        console.log('❌ Offre déjà existante pour cet utilisateur');
        return res.redirect('/dashboard');
    }

    const offerAmount = parseFloat(req.body.amount);
    if (isNaN(offerAmount) || offerAmount <= 0) {
        console.log('❌ Montant invalide');
        return res.redirect('/dashboard');
    }

    const offer = {
        id: `offer_${Date.now()}`,
        propertyId: property.id,
        propertyTitle: property.title,
        buyerId: req.session.user.id,
        buyerName: req.session.user.name,
        amount: offerAmount,
        status: 'pending',
        createdAt: new Date()
    };

    if (!property.offers) {
        property.offers = [];
    }
    property.offers.push(offer);

    req.session.success = `Offre de ${offerAmount} € envoyée avec succès!`;

    console.log(`✅ Offre créée: ${offer.id} par ${req.session.user.id} pour ${offerAmount} €`);
    res.redirect('/dashboard');
});
// ============================================
// ROUTES OFFRES
// ============================================

app.get('/property/:id/offers', (req, res) => {
    if (!req.session.user || req.session.user.type !== 'seller') {
        return res.redirect('/login');
    }

    const property = properties.find(p => p.id === req.params.id);
    if (!property || property.sellerId !== req.session.user.id) {
        return res.redirect('/dashboard');
    }

    res.render('offers', {
        user: req.session.user,
        property: property,
        offers: property.offers || []
    });
});

app.post('/offer/:offerId/accept', async (req, res) => {
    if (!req.session.user || req.session.user.type !== 'seller') {
        return res.redirect('/login');
    }

    console.log(`📦 Acceptation offre: ${req.params.offerId}`);

    const offerId = req.params.offerId;
    let acceptedOffer = null;
    let property = null;

    for (let p of properties) {
        if (p.offers) {
            const offer = p.offers.find(o => o.id === offerId);
            if (offer && p.sellerId === req.session.user.id) {
                acceptedOffer = offer;
                property = p;
                break;
            }
        }
    }

    if (acceptedOffer && property) {
        acceptedOffer.status = 'accepted';

        // Création de la session
           const session = {
                id: `session_${Date.now()}`,
                propertyId: property.id,
                propertyTitle: property.title,
                sellerId: property.sellerId,
                sellerName: property.sellerName,
                buyerId: acceptedOffer.buyerId,
                buyerName: acceptedOffer.buyerName,
                amount: acceptedOffer.amount,
                status: 'offer_accepted',
                depositRequested: false,
                depositPaid: false,
                depositAmount: 0,
                depositDeadline: null,
                depositReference: null, // Référence bancaire
                depositConfirmedByBank: false,
                finalPaymentMade: false,
                finalPaymentReference: null,
                escrowId: null,
                createdAt: new Date()
    };
        sessions.push(session);

        console.log(`✅ Session créée: ${session.id}`);
    } else {
        console.log('❌ Offre non trouvée');
    }

    res.redirect('/dashboard');
});

app.post('/offer/:offerId/reject', (req, res) => {
    if (!req.session.user || req.session.user.type !== 'seller') {
        return res.redirect('/login');
    }

    const offerId = req.params.offerId;

    for (let p of properties) {
        if (p.offers) {
            const offer = p.offers.find(o => o.id === offerId);
            if (offer && p.sellerId === req.session.user.id) {
                offer.status = 'rejected';
                console.log(`❌ Offre rejetée: ${offerId}`);
                break;
            }
        }
    }

    res.redirect('/dashboard');
});

// ============================================
// ROUTES SESSIONS
// ============================================

app.get('/session/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const session = sessions.find(s => s.id === req.params.id);
    if (!session) return res.redirect('/dashboard');

    const user = req.session.user;

    if ((user.type === 'seller' && session.sellerId !== user.id) ||
        (user.type === 'buyer' && session.buyerId !== user.id)) {
        return res.redirect('/dashboard');
    }

    let escrowData = null;
    if (session.escrowId) {
        const result = await fabricClient.queryEscrow(session.escrowId);
        if (result.success) {
            escrowData = result.data;
        }
    }

    res.render('session', { session, escrowData, user });
});

app.post('/session/:id/request-deposit', (req, res) => {
    if (!req.session.user || req.session.user.type !== 'seller') {
        return res.redirect('/login');
    }

    const session = sessions.find(s => s.id === req.params.id);
    if (session && session.sellerId === req.session.user.id) {
        session.depositRequested = true;
        session.depositAmount = parseFloat(req.body.amount);
        session.depositDeadline = req.body.deadline;
        session.status = 'deposit_pending';
        console.log(`💰 Dépôt demandé pour session: ${session.id}`);
    }

    res.redirect(`/session/${req.params.id}`);
});

app.post('/session/:id/pay-deposit', (req, res) => {
    if (!req.session.user || req.session.user.type !== 'buyer') {
        return res.redirect('/login');
    }

    const session = sessions.find(s => s.id === req.params.id);
    if (session && session.buyerId === req.session.user.id && session.depositRequested) {
        session.depositPaid = true;
        session.status = 'deposit_paid';
        console.log(`💰 Dépôt payé pour session: ${session.id}`);
    }

    res.redirect(`/session/${req.params.id}`);
});

// Uploader le contrat de vente (seller)
app.post('/session/:id/upload-contract', (req, res) => {
    if (!req.session.user || req.session.user.type !== 'seller') {
        return res.redirect('/login');
    }

    const session = sessions.find(s => s.id === req.params.id);
    if (session && session.sellerId === req.session.user.id) {
        // Le hash est maintenant généré côté client et envoyé dans req.body.contractHash
        session.contractHash = req.body.contractHash || `contract_${Date.now()}`;
        session.status = 'contract_uploaded';
        console.log(`📄 Contrat uploadé pour session: ${session.id} avec hash: ${session.contractHash}`);
    }

    res.redirect(`/session/${req.params.id}`);
});

app.post('/session/:id/sign-contract', (req, res) => {
    if (!req.session.user || req.session.user.type !== 'buyer') {
        return res.redirect('/login');
    }

    const session = sessions.find(s => s.id === req.params.id);
    if (session && session.buyerId === req.session.user.id && session.contractHash) {
        session.signedContractHash = req.body.signedContractHash || `signed_${Date.now()}`;
        session.status = 'contract_signed';
        console.log(`✍️ Contrat signé pour session: ${session.id}`);
    }

    res.redirect(`/session/${req.params.id}`);
});

app.post('/session/:id/create-escrow', async (req, res) => {
    if (!req.session.user || req.session.user.type !== 'seller') {
        return res.redirect('/login');
    }

    const session = sessions.find(s => s.id === req.params.id);
    if (session && session.sellerId === req.session.user.id) {
        const escrowId = `escrow_${Date.now()}`;
        console.log(`🔗 Création escrow: ${escrowId}`);

        // Le seller est l'utilisateur connecté (seller)
        const result = await fabricClient.createEscrow(
            escrowId,
            session.buyerId,  // buyer
            req.session.user.id, // seller (l'utilisateur connecté)
            session.amount,
            req.body.titleHash || `title_${Date.now()}`
        );

        if (result.success) {
            session.escrowId = escrowId;
            session.status = 'escrow_created';
            console.log(`✅ Escrow créé: ${escrowId}`);
        } else {
            console.log(`❌ Échec création escrow: ${result.error}`);
        }
    }

    res.redirect(`/session/${req.params.id}`);
});

app.post('/session/:id/deposit-final', async (req, res) => {
    if (!req.session.user || req.session.user.type !== 'buyer') {
        return res.redirect('/login');
    }

    const session = sessions.find(s => s.id === req.params.id);
    if (session && session.buyerId === req.session.user.id && session.escrowId) {
        console.log(`💰 Dépôt final pour escrow: ${session.escrowId}`);

        const result = await fabricClient.depositFunds(session.escrowId);
        if (result.success) {
            session.status = 'final_payment_made';
            console.log(`✅ Paiement final effectué`);
        } else {
            console.log(`❌ Échec paiement: ${result.error}`);
        }
    }

    res.redirect(`/session/${req.params.id}`);
});

// Route pour la page de vérification de propriété
app.get('/property/:id/verify-page', (req, res) => {
    if (!req.session.user || req.session.user.type !== 'seller') {
        return res.redirect('/login');
    }

    const property = properties.find(p => p.id === req.params.id);
    if (!property || property.sellerId !== req.session.user.id) {
        return res.redirect('/dashboard');
    }

    res.render('verify-property', {
        user: req.session.user,
        property: property
    });
});

// Route pour traiter la vérification avec document
app.post('/property/:id/verify', (req, res) => {
    const property = properties.find(p => p.id === req.params.id);
    if (property && property.sellerId === req.session.user.id) {
        // Générer un hash de document simulé
        const documentHash = `0x${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

        property.status = 'verified';
        property.titleDeed = req.body.titleDeed || documentHash;
        property.documentHash = documentHash;

        console.log(`✅ Propriété vérifiée: ${property.id} avec hash: ${documentHash}`);
    }
    res.redirect('/dashboard');
});


// Simuler un virement bancaire (dans un cas réel, ce serait une API bancaire)
app.post('/session/:id/bank-transfer', (req, res) => {
    if (!req.session.user || req.session.user.type !== 'buyer') {
        return res.redirect('/login');
    }

    const session = sessions.find(s => s.id === req.params.id);
    if (!session || session.buyerId !== req.session.user.id) {
        return res.redirect('/dashboard');
    }

    // Simuler une confirmation bancaire
    const bankReference = `BNK${Date.now()}`;
    session.depositReference = bankReference;
    session.depositConfirmedByBank = true;
    session.depositPaid = true;
    session.status = 'deposit_paid';

    console.log(`🏦 Virement bancaire confirmé: ${bankReference} pour session ${session.id}`);

    // Mettre à jour le statut dans la blockchain
    // (vous pouvez ajouter un appel à votre chaincode ici)

    res.redirect(`/session/${session.id}`);
});


// ============================================
// DÉMARRAGE SERVEUR
// ============================================

app.listen(port, () => {
    console.log(`✅ Application démarrée sur http://localhost:${port}`);
});