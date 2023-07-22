require('dotenv').config()

import { ethers, NonceManager } from 'ethers';
import AISwapABI from './abis/AISwap.json';
import ERC20ABI from './abis/ERC20.json';

const WEB_SOCKET_PROVIDER_URL = process.env.WEB_SOCKET_PROVIDER_URL || "";

if (!WEB_SOCKET_PROVIDER_URL) {
    throw new Error("WEB_SOCKET_PROVIDER_URL is not set")
}

const JSON_RPC_PROVIDER_URL = process.env.JSON_RPC_PROVIDER_URL || "";

if (!JSON_RPC_PROVIDER_URL) {
    throw new Error("JSON_RPC_PROVIDER_URL is not set")
}

const DESTINATION_CHAIN_JSON_RPC_PROVIDER_URL = process.env.DESTINATION_CHAIN_JSON_RPC_PROVIDER_URL || "";

if (!DESTINATION_CHAIN_JSON_RPC_PROVIDER_URL) {
    throw new Error("DESTINATION_CHAIN_JSON_RPC_PROVIDER_URL is not set")
}

const MNEMONIC = process.env.MNEMONIC || "";

if (!MNEMONIC) {
    throw new Error("MNEMONIC is not set")
}

const AISWAP_ADDRESS = process.env.AISWAP_ADDRESS || "";

if (!AISWAP_ADDRESS) {
    throw new Error("AISWAP_ADDRESS is not set")
}

const web3SockerProvider = new ethers.WebSocketProvider(WEB_SOCKET_PROVIDER_URL);
const jsonRPCProvider = new ethers.JsonRpcProvider(JSON_RPC_PROVIDER_URL);
const destinationChainJsonRpcProvider = new ethers.JsonRpcProvider(DESTINATION_CHAIN_JSON_RPC_PROVIDER_URL);

const getUserSigner = (providerValue: any) => {
    const hdNode = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(MNEMONIC || ""), `m/44'/60'/0'/0/1`);
    const wallet = new ethers.Wallet(hdNode.privateKey, providerValue);
    console.log('Wallet Address:', wallet.address);
    const nonceManager = new NonceManager(wallet);
    return nonceManager.signer
}

const main = async () => {
    const userSigner = getUserSigner(jsonRPCProvider);

    const contract = new ethers.Contract(AISWAP_ADDRESS, AISwapABI, web3SockerProvider);

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

        const tx = await (contract.connect(userSigner) as any).claimAuction(auctionId);

        console.log('Transaction:', tx);

        await tx.wait();

        console.log('Order Claimed!');

        // obtener destination blockchain

        // hacer transaccion que envie la output amount a la direccion de la otra blockchain
        const destinationChainContract = new ethers.Contract(tokenOutputAddress, ERC20ABI, destinationChainJsonRpcProvider);

        const destinationChainUserSigner = getUserSigner(destinationChainJsonRpcProvider);

        const destinationChainContractWithSigner = destinationChainContract.connect(destinationChainUserSigner);

        const tx2 = await (destinationChainContractWithSigner as any).transfer(owner, minimumTokenOutputAmount);

        console.log('Transaction 2:', tx2);

        await tx2.wait();
    });

    // const address = await userSigner.getAddress();

    console.log("Listening for auction created events...")
}

const claim = async (auctionId: any) => {

}

const settle = async (auctionId: any) => {
}

const transfer = async (auctionId: any) => {
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
