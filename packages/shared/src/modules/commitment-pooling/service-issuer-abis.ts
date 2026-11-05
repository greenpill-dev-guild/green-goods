import { erc20Abi, parseAbi } from "viem";

// Exact public integration surfaces: GnosisVoucherAdapter, ICLCGiftableToken and ICLCSwapPool.
// These interfaces are not published JSON subpaths; do not deep-import generated contract artifacts.
export const TokenABI = [
  ...erc20Abi,
  ...parseAbi([
    "function initialize(string name,string symbol,uint8 decimals,address owner,uint256 expiresAt)",
    "function owner() view returns(address)",
    "function mintTo(address recipient,uint256 amount)",
  ]),
];
export const AdapterABI = parseAbi([
  "function getExecutionResult(bytes32 entitlementId) view returns((bytes32 payloadHash,uint64 sequence,bool success,uint64 acknowledgmentSequence,bytes32 failureHash,bytes32 acknowledgmentMessageId,bytes32 acknowledgmentFailureHash))",
  "function owner() view returns(address)",
  "function paused() view returns(bool)",
  "function guardian() view returns(address)",
  "function CCIP_ROUTER() view returns(address)",
  "function LOCAL_CHAIN_ID() view returns(uint256)",
  "function remoteChainId() view returns(uint256)",
  "function remotePeer() view returns(address)",
  "function remoteChainSelector() view returns(uint64)",
  "function assetAuthorizations(address issuer,address token) view returns(address issuerAuthority,bool enabled)",
  "function configureAsset(address token,address issuerAuthority,bool enabled)",
  "event AssetConfigured(address indexed issuer,address indexed token,address indexed issuerAuthority,bool enabled)",
]);
export const BookingEventsABI = parseAbi([
  "event RedemptionIssuerApproved(bytes32 indexed redemptionId,address indexed issuer,bytes32 indexed payloadHash)",
  "event RedemptionReturnAuthorized(bytes32 indexed redemptionId,address indexed issuer,uint256 cumulativeReturnCeiling)",
]);
export const PoolABI = parseAbi([
  "function getAmountOut(address tokenOut,address tokenIn,uint256 amountIn) returns(uint256 amountOut)",
  "function withdraw(address tokenOut,address tokenIn,uint256 amountIn,address learner,uint256 minAmountOut,uint256 deadline) returns(uint256 amountOut)",
  "event SwapSettlement(address indexed initiator,address indexed tokenIn,address indexed tokenOut,uint256 amountIn,uint256 quotedAmountOut,uint256 nominalAmountOut,uint256 amountOut,uint256 poolFee,uint256 protocolFee)",
]);
