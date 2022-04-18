export const config = {
  // Contract Address ======================================== //
  contract_address: '0x23581767a106ae21c074b2276D25e5C3e136a68b',
  // Fiat Conversion Currency ================================ //
  // Available Options: ====================================== //
  // usd, aud, gbp, eur, cad, jpy, cny ======================= //
  currency: 'usd',
  // Message ================================================= //
  // Available Parameters: =================================== //
  // <tokenId> ==================== Token ID of transfered NFT //
  // <ethPrice> ================= Value of transactions in eth //
  // <fiatPrice> =============== Value of transactions in fiat //
  // <txHash> =========================== The transaction hash //
  // <from> ===================================== From address //
  // <to> ========================================= To address //
  message: 'MOONBIRD #<tokenId> was sold for <ethPrice> (<fiatPrice>) from: <from> -- to: <to> -- https://etherscan.io/tx/<txHash> #MOONBIRD #NFT',
  // Prefer ENS over 0x address (Uses more Alchemy requests) = //
  // Available Options: ====================================== //
  // true, false ============================================= //
  ens: true
};