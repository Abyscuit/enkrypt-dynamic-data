import { CHAIN_CONFIGS, NATIVE_ADDRESS } from "@src/configs";
import { NetworkName, Token } from "@src/types";

const CG_BASE = `https://tokens.coingecko.com/`;
const CG_API_BASE = `https://partners.mewapi.io/coingecko/api/v3/`;

const excludedAddresses: Lowercase<string>[] = ["0x0000000000000000000000000000000000001010"];
const cgPlatform: Record<NetworkName, string> = {
  [NetworkName.Ethereum]: "ethereum",
  [NetworkName.Matic]: "polygon-pos",
  [NetworkName.Binance]: "binance-smart-chain",
  [NetworkName.Arbitrum]: "arbitrum-one",
  [NetworkName.Avalanche]: "avalanche",
  [NetworkName.Aurora]: "aurora",
  [NetworkName.Fantom]: "fantom",
  [NetworkName.Gnosis]: "xdai",
  [NetworkName.Klaytn]: "klay-token",
  [NetworkName.Optimism]: "optimistic-ethereum",
  [NetworkName.EthereumClassic]: "ethereum-classic",
  [NetworkName.Moonbeam]: "moonbeam",
  [NetworkName.ZkSync]: "zksync",
  [NetworkName.Base]: "base",
  [NetworkName.MaticZK]: "polygon-zkevm",
  [NetworkName.Rootstock]: "rootstock",
  [NetworkName.Solana]: "solana",
  [NetworkName.Telos]: "telos",
  [NetworkName.Blast]: "blast",
};
export const supportedChains: NetworkName[] = [
  NetworkName.Ethereum,
  NetworkName.Binance,
  NetworkName.Matic,
  NetworkName.Optimism,
  NetworkName.Arbitrum,
  NetworkName.Gnosis,
  NetworkName.Avalanche,
  NetworkName.Fantom,
  NetworkName.Klaytn,
  NetworkName.Aurora,
  NetworkName.EthereumClassic,
  NetworkName.Moonbeam,
  NetworkName.Base,
  NetworkName.MaticZK,
  NetworkName.Rootstock,
  NetworkName.Solana,
  NetworkName.Telos,
  NetworkName.Blast,
];
export const getTrendingTokenId = async (): Promise<Record<string, number>> =>
  fetch(`${CG_API_BASE}search/trending`)
    .then((res) => res.json())
    .then((_json) => {
      const json = _json as {
        coins: {
          item: {
            id: string;
            score: number;
          };
        }[];
      };
      const resp: Record<string, number> = {};
      json.coins.forEach((coin) => {
        resp[coin.item.id] = coin.item.score;
      });
      return resp;
    });

export const getTopTokenIds = async (): Promise<
  Record<
    string,
    {
      rank: number;
      price: number;
    }
  >
> =>
  fetch(
    `${CG_API_BASE}coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false`
  )
    .then((res) => res.json())
    .then((_json) => {
      const json = _json as {
        id: string;
        market_cap_rank: number;
        current_price: number;
      }[];
      const resp: Record<
        string,
        {
          rank: number;
          price: number;
        }
      > = {};
      json.forEach((coin) => {
        resp[coin.id] = {
          rank: coin.market_cap_rank,
          price: coin.current_price,
        };
      });
      return resp;
    });

/**
 * Get tokens from CoinGecko with their CoinGecko ID's and platforms
 * that they're available on
 *
 * Note: CoinGecko cases base58 addresses (eg Solana) but does not case
 * EVM addresses. We lowercase all addresses to make comparisons easier.
 * We don't expect address any collisions.
 *
 * @returns mapping of lowercase address (any platform) -> CoinGecko id
 */
export const getContractAddressesToCG = async (): Promise<
  Record<Lowercase<string>, string>
> =>
  fetch(`${CG_API_BASE}coins/list?include_platform=true`)
    .then((res) => res.json())
    .then((_json) => {
      const json = _json as {
        id: string;
        platforms: Record<string, string>;
      }[];

      // Unroll the response into our mapping
      const resp: Record<Lowercase<string>, string> = {};

      // Extract the map
      json.forEach((coin) => {
        const addresses = Object.values(coin.platforms);
        addresses.forEach((addr) => {
          resp[addr.toLowerCase() as Lowercase<string>] = coin.id;
        });
      });

      return resp;
    });

export const getCoinGeckoTopTokenInfo = async (): Promise<{
  trendingTokens: Record<string, number>,
  topTokens: Record<string, { rank: number; price: number; }>,
  /** Mapping of lowercase address (on any platform) -> CoinGecko id */
  contractsToId: Record<Lowercase<string>, string>,
}> => {
  const [trendingTokens, topTokens, contractAddressMap] = await Promise.all([
    getTrendingTokenId(),
    getTopTokenIds(),
    getContractAddressesToCG(),
  ]);
  return {
    trendingTokens: trendingTokens,
    topTokens: topTokens,
    contractsToId: contractAddressMap,
  }
};

export default async (chainName: NetworkName): Promise<Record<string, Token>> =>
  fetch(`${CG_BASE}${cgPlatform[chainName]}/all.json`)
    .then((res) => res.json())
    .then((_json) => {
      const json = _json as {
        tokens: Token[];
      };
      const resp: Record<Lowercase<string>, Token> = {};
      json.tokens.forEach((token) => {
        if (excludedAddresses.includes(token.address.toLowerCase() as Lowercase<string>)) return;
        // Lowercase the address for matching
        resp[token.address.toLowerCase() as Lowercase<string>] = {
          // Maintain casing of the address so because some networks the
          // address is case sensitive (eg networks that use base58)
          ...token,
          type: CHAIN_CONFIGS[chainName].type,
        };
      });
      resp[NATIVE_ADDRESS] = {
        address: NATIVE_ADDRESS,
        type: CHAIN_CONFIGS[chainName].type,
        decimals: CHAIN_CONFIGS[chainName].decimals,
        logoURI: CHAIN_CONFIGS[chainName].logoURI,
        name: CHAIN_CONFIGS[chainName].name,
        symbol: CHAIN_CONFIGS[chainName].symbol,
        cgId: CHAIN_CONFIGS[chainName].cgId,
      };
      return resp;
    });
