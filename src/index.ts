require('dotenv').config()

import { ethers, NonceManager } from 'ethers';
import AISwapABI from './abis/AISwap.json';
import ERC20ABI from './abis/ERC20.json';

// @dev We only need 1 websocket and the rest are JSON RPCs to trigger txs
// COMMON
const MNEMONIC = process.env.MNEMONIC || "";

if (!MNEMONIC) {
    throw new Error("MNEMONIC is not set")
}

const AISWAP_ADDRESS = process.env.AISWAP_ADDRESS || "";

if (!AISWAP_ADDRESS) {
    throw new Error("AISWAP_ADDRESS is not set")
}

// ARBITRUM
const ARBITRUM_JSON_RPC = process.env.ARBITRUM_JSON_RPC || "";

if (!ARBITRUM_JSON_RPC) {
    throw new Error("ARBITRUM_JSON_RPC is not set")
}

// GNOSIS
const GNOSIS_JSON_RPC = process.env.GNOSIS_JSON_RPC || "";

if (!GNOSIS_JSON_RPC) {
    throw new Error("GNOSIS_JSON_RPC is not set")
}

// LINEA
const LINEA_JSON_RPC = process.env.LINEA_JSON_RPC || "";

if (!LINEA_JSON_RPC) {
    throw new Error("LINEA_JSON_RPC is not set")
}

// WEBSOCKET
const WEBSOCKET_FOR_NODE = process.env.WEBSOCKET_FOR_NODE || "";

const web3SockerProvider = new ethers.WebSocketProvider(WEBSOCKET_FOR_NODE);

// CHAIN ID
const CHAIN_ID = process.env.CHAIN_ID || "";

if (!CHAIN_ID) {
    throw new Error("CHAIN_ID is not set")
}

// Configure all JSON RPCs
const arbitrumJSONRPCProvider = new ethers.JsonRpcProvider(ARBITRUM_JSON_RPC);
const gnosisJSONRPCProvider = new ethers.JsonRpcProvider(GNOSIS_JSON_RPC);
const lineaJSONRPCProvider = new ethers.JsonRpcProvider(LINEA_JSON_RPC);

const getUserSigner = (providerValue: any) => {
    const hdNode = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(MNEMONIC || ""), `m/44'/60'/0'/0/0`);
    const wallet = new ethers.Wallet(hdNode.privateKey, providerValue);
    console.log('Wallet Address:', wallet.address);
    const nonceManager = new NonceManager(wallet);
    return nonceManager.signer
}

const getAiswapContractAddressByChainId = () => {
    return new ethers.Contract(AISWAP_ADDRESS, AISwapABI, web3SockerProvider);
}

const getChainJsonRpcProvider = (chainID: number) => {
    switch (chainID) {
        case 42161:
            return arbitrumJSONRPCProvider;
        case 100:
            return gnosisJSONRPCProvider;
        case 59144:
            return lineaJSONRPCProvider;
        default:
            throw new Error("Invalid Chain ID")
    }
}

const main = async () => {
    const contract = getAiswapContractAddressByChainId();

    if (!contract) {
        throw new Error("Contract is not set")
    }

    // @dev event triggered when an auction is created
    const eventFilter = {
        address: AISWAP_ADDRESS as string,
        topics: [ethers.id("AuctionCreated(uint256,address,address,uint256,uint256,uint256,address,uint256,uint256,uint8)")]
    };

    web3SockerProvider.on(eventFilter, async (event) => {
        console.log('Event:', event);

        // Handle the event data here
        const decodedData = contract.interface.parseLog(event);
        console.log('Decoded Data:', decodedData);

        // Access decoded event parameters
        const auctionId = decodedData?.args[0]
        console.log('Auction ID:', auctionId);

        const tokenOutputAddress = decodedData?.args[2]
        console.log('Token Output Address:', tokenOutputAddress);

        const minimumTokenOutputAmount = decodedData?.args[4]
        console.log('Minimum Token Output Amount:', minimumTokenOutputAmount);

        const owner = decodedData?.args[6]
        console.log('Owner:', owner);

        const sourceChain = decodedData?.args[7]
        console.log('Source Chain:', sourceChain);

        const destinationChain = decodedData?.args[8]
        console.log('Destination Chain:', destinationChain);

        const userSignerForSourceChain = getUserSigner(getChainJsonRpcProvider(Number(sourceChain)));

        const tx = await (contract.connect(userSignerForSourceChain) as any).claimAuction(auctionId);

        console.log('Transaction in source chain to claim:', tx);

        await tx.wait();

        console.log('Order Claimed!');

        console.log("About to transfer funds to destination chain...")

        // Sending funds to destination chain
        const userSignerForDestinationChain = getUserSigner(getChainJsonRpcProvider(Number(destinationChain)));
        const destinationChainContract = new ethers.Contract(tokenOutputAddress, ERC20ABI, userSignerForDestinationChain);

        const destinationChainContractWithSigner = destinationChainContract.connect(userSignerForDestinationChain);

        const tx2 = await (destinationChainContractWithSigner as any).transfer(owner, minimumTokenOutputAmount);

        console.log('Transaction 2:', tx2);

        await tx2.wait();

        console.log('Funds transferred to user in destination chain!');
    });

    console.log("Listening for auction created events...")
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
