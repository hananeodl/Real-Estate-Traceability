# Hyperledger Fabric Prototype for Real Estate Transaction Registration and Traceability

## prepared by :

**Hanane OUDAALI**

**Saida ALABA**

## 1. Project Overview

This project focuses on the design and implementation of a secure escrow system using blockchain technology. The main objective is to guarantee trust between buyers and sellers during digital transactions by removing the need for a centralized intermediary.

An escrow system is a financial arrangement where a third party temporarily holds assets or funds until all transaction conditions are fulfilled. In traditional systems, escrow services are handled by financial institutions or trusted organizations. However, these systems may introduce risks such as fraud, lack of transparency, or dependency on centralized authorities.

Blockchain technology offers a decentralized and transparent alternative. In this project, blockchain is used to automate escrow operations through smart contracts. These smart contracts define the transaction rules and automatically execute payments once all participants agree on the transaction outcome.

Initially, the escrow solution was developed using the Ethereum blockchain. Ethereum allows developers to create decentralized applications (DApps) using smart contracts written in Solidity. The system supports transaction validation, deposit management, and automated payment release.

The second objective of the project is to migrate the escrow system from Ethereum to Hyperledger Fabric. Unlike Ethereum, which is a public blockchain, Hyperledger Fabric is a permissioned blockchain platform designed for enterprise environments. This migration aims to improve privacy, scalability, and performance while maintaining the escrow logic.

## 2. Current Progress and Work Completed
### 2.1 Ethereum Escrow System Analysis

The first stage of the project involved analyzing the existing Ethereum-based escrow implementation. The system is composed of multiple smart contracts that manage transaction sessions between buyers and sellers.

The primary smart contracts include:

- EscrowFactory Contract

    This contract is responsible for creating and managing escrow sessions. Each session is uniquely identified using a session hash and linked to a specific escrow contract instance.


- Escrow Contract

    This contract handles the main business logic, including:

  - Buyer deposit management
  - Seller transfer request handling
  - Oracle integration for external validation
  - Multi-party approval before payment release
  - Escrow termination management
  

  The Ethereum system follows a decentralized execution model using the Ethereum Virtual Machine (EVM). Transactions are validated using the Proof-of-Stake consensus mechanism, ensuring network integrity.

The escrow workflow includes the following steps:

1. The seller creates an escrow session.

2. The buyer deposits funds into the escrow contract.

3. The oracle verifies external conditions such as document transfer.

4. Both buyer and seller approve the transaction.

5. Funds are automatically transferred to the seller.

This stage allowed a deep understanding of smart contract architecture, transaction flows, and blockchain validation processes.

### 2.2 Hyperledger Fabric System Design

After analyzing Ethereum, the project moved to designing an equivalent system using Hyperledger Fabric.

The Fabric-based escrow system introduces several new architectural components:

- Organizations

  The network is divided into multiple organizations representing participants such as buyers, sellers, and validators.


- Peers

  Peers maintain the ledger and execute chaincode (Fabric smart contracts).


- Orderer Service

  The orderer is responsible for transaction ordering and block creation.


- Certificate Authority (CA)

  Fabric uses a CA to provide digital identities to all network participants, improving security and access control.


- Channels

  Channels allow private communication between specific organizations, ensuring data confidentiality.

### 2.3 Chaincode Development

The escrow logic is currently being rewritten as Fabric chaincode using the Go programming language.

The chaincode implements core functionalities such as:

- Escrow session creation

- Buyer deposit registration

- Transfer request processing

- Multi-party approval validation

- Payment simulation using ledger state

- Escrow termination handling

Additionally, supporting modules were developed:

- Model definitions for escrow structures

- Utility functions for ledger interactions

- Main chaincode entry point for transaction routing

### 2.4 Network Architecture Preparation

The Fabric network setup is being prepared using Docker containers. The network includes:

- One orderer node

- Multiple peer nodes

- Certificate authority services

- Channel configuration

Docker Compose is used to orchestrate network components and ensure communication between services.

## 3. Challenges and Issues Encountered
### 3.1 Environment Compatibility

One of the main challenges encountered during the project was related to system compatibility. Hyperledger Fabric requires a Linux environment, while development was initially performed on Windows.

To resolve this issue, Windows Subsystem for Linux (WSL2) was used to create a Linux-based development environment. However, integration between WSL2 and Docker Desktop introduced several performance and configuration difficulties.

### 3.2 Docker Integration Problems

Fabric relies heavily on Docker containers to simulate blockchain networks. The synchronization between WSL2 and Docker caused slow container startup times and occasional connection issues.

These challenges significantly increased the deployment time of the network.

### 3.3 Technology Migration Complexity

Migrating from Ethereum to Fabric is not a direct code translation process. The two platforms follow different architectural models:

- Ethereum uses a global state and public validation

- Fabric uses endorsement policies and permission-based access

This required redesigning the escrow logic rather than simply rewriting code.

### 3.4 Oracle Implementation Differences

Ethereum supports external oracles for off-chain data verification. In Fabric, equivalent functionality must be implemented using external service integration or event-based mechanisms, requiring additional architectural design.

## 4. Learning Outcomes

This project provided valuable experience in blockchain architecture and distributed system design. It helped develop strong knowledge in:

- Smart contract development

- Blockchain consensus mechanisms

- Enterprise blockchain architecture

- Docker container orchestration

- Security and identity management in distributed networks

The comparison between Ethereum and Hyperledger Fabric provided insight into selecting blockchain technologies based on business requirements.

## 5. Future Work

The remaining work includes:

- Completing Fabric network deployment

- Testing escrow chaincode operations

- Implementing external payment integration

- Creating API interfaces for client applications

- Performance comparison between Ethereum and Fabric implementations

## 6. Conclusion

This project demonstrates how blockchain technology can be applied to improve trust in digital transactions. The Ethereum implementation validated the feasibility of decentralized escrow services, while Hyperledger Fabric provides a more suitable solution for enterprise-level applications requiring privacy and scalability.

Despite technical challenges, the migration process contributed to a deeper understanding of blockchain ecosystems and distributed system architectures.