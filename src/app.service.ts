import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

import twit from 'twit';

import { BigNumber, ethers } from 'ethers';
import { hexToNumberString, hexToString, stripHexPrefix } from 'web3-utils';

import { catchError, firstValueFrom, map, Observable, of, switchMap, timer } from 'rxjs';

import currency from 'currency.js';

import dotenv from 'dotenv';
dotenv.config();

import looksRareABI from './abi/looksRareABI.json';

import { config } from './config';
import fiatSymbols from './fiat-symobols.json';

const alchemyAPIUrl = 'https://eth-mainnet.alchemyapi.io/v2/';
const alchemyAPIKey = process.env.ALCHEMY_API_KEY;

const tokenContractAddress = config.contract_address;
const looksRareContractAddress = '0x59728544b08ab483533076417fbbb2fd0b17ce3a'; // Don't change unless deprecated

const provider = new ethers.providers.JsonRpcProvider(alchemyAPIUrl + alchemyAPIKey);
const looksInterface = new ethers.utils.Interface(looksRareABI);

// This can be an array if you want to filter by multiple topics
// 'Transfer' topic
const topics = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const twitterConfig = {
  consumer_key: process.env.TW_CONSUMER_KEY,
  consumer_secret: process.env.TW_CONSUMER_SECRET,
  access_token: process.env.TW_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TW_ACCESS_TOKEN_SECRET,
};

const twitterClient = new twit(twitterConfig);

interface Response {
  from: any;
  to: any;
  tokenId: string;
  ether: number;
  transactionHash: string;
  looksRareValue: number;
  imageUrl?: string;
}

@Injectable()
export class AppService {
  
  fiatValues: any;

  constructor(
    private readonly http: HttpService
  ) {

    this.getEthToFiat().subscribe((fiat) => this.fiatValues = fiat.ethereum);

    // Listen for Transfer event
    provider.on({ address: tokenContractAddress, topics: [topics] }, (tx) => {
      this.getTransactionDetails(tx).then((res) => {

        // Only tweet transfers with value (Ignore w2w transfers)
        if (res?.ether || res?.looksRareValue) this.tweet(res);
        // If free mint is enabled we can tweet 0 value
        else if (config.includeFreeMint) this.tweet(res);

        // console.log(res);
      });
    });
  }

  async getTransactionDetails(tx: any): Promise<any> {

    let tokenId: string;

    try {

      // Get addresses of seller / buyer from topics
      let from = ethers.utils.defaultAbiCoder.decode(['address'], tx?.topics[1])[0];
      let to = ethers.utils.defaultAbiCoder.decode(['address'], tx?.topics[2])[0];

      // Get tokenId from topics
      tokenId = hexToNumberString(tx?.topics[3]);

      // Get transaction hash
      const { transactionHash } = tx;
      const isMint = BigNumber.from(from).isZero();

      // Get transaction
      const transaction = await provider.getTransaction(transactionHash);
      const { value } = transaction;
      const ether = ethers.utils.formatEther(value.toString());

      // Get transaction receipt
      const receipt: any = await provider.getTransactionReceipt(transactionHash);

      // Get token image
      const imageUrl = await this.getTokenMetadata(tokenId);

      // Check if LooksRare & parse the event & get the value
      let looksRareValue = 0;
      const LR = receipt.logs.map((log: any) => {
        if (log.address.toLowerCase() === looksRareContractAddress.toLowerCase()) {  
          return looksInterface.parseLog(log);
        }
      }).filter((log: any) => log?.name === 'TakerAsk');

      if (LR.length) {
        const weiValue = (LR[0]?.args?.price)?.toString();
        const value = ethers.utils.formatEther(weiValue);
        looksRareValue = parseFloat(value);
      }

      // If ens is configured, get ens addresses
      let ensTo: string;
      let ensFrom: string;
      if (config.ens) {
        ensTo = await provider.lookupAddress(`${to}`);
        ensFrom = await provider.lookupAddress(`${from}`);
      }

      // Set the values for address to & from -- Shorten non ens
      to = config.ens ? (ensTo ? ensTo : this.shortenAddress(to)) : this.shortenAddress(to);
      from = (isMint && config.includeFreeMint) ? 'Mint' : config.ens ? (ensFrom ? ensFrom : this.shortenAddress(from)) : this.shortenAddress(from);

      // Create response object
      const response: Response = {
        from,
        to,
        tokenId,
        ether: parseFloat(ether),
        transactionHash,
        looksRareValue
      };

      // If the image was successfully obtained
      if (imageUrl) response.imageUrl = imageUrl;

      return response;

    } catch (err) {
      console.log(`${tokenId} failed to send`);
      return null;
    }
  }

  shortenAddress(address: string): string {
    const shortAddress = `${address.slice(0, 5)}...${address.slice(address.length - 5, address.length)}`;
    if (address.startsWith('0x')) return shortAddress;
    return address;
  }

  async getTokenMetadata(tokenId: string): Promise<any> {
    const url = alchemyAPIUrl + alchemyAPIKey + '/getNFTMetadata';
    return await firstValueFrom(
      this.http.get(url, {
        params: {
          contractAddress: tokenContractAddress,
          tokenId,
          tokenType: 'erc721'
        }
      }).pipe(
        map((res: any) => {
          return res?.data?.metadata?.image_url || res?.data?.metadata?.image || res?.data?.tokenUri?.gateway;
        }),
        catchError(() => {
          return of(null);
        })
      )
    );
  }

  async tweet(data: any) {

    let tweetText: string;

    // Cash value
    const fiatValue = this.fiatValues[config.currency] * (data.ether ? data.ether : data.looksRareValue);
    const fiat = currency(fiatValue, { symbol: fiatSymbols[config.currency].symbol, precision: 0 });

    const ethValue = data.ether ? data.ether : data.looksRareValue;
    const eth = currency(ethValue, { symbol: 'Ξ', precision: 3 });

    // Replace tokens from config file
    tweetText = config.message.replace(new RegExp('<tokenId>', 'g'), data.tokenId);
    tweetText = tweetText.replace(new RegExp('<ethPrice>', 'g'), eth.format());
    tweetText = tweetText.replace(new RegExp('<txHash>', 'g'), data.transactionHash);
    tweetText = tweetText.replace(new RegExp('<from>', 'g'), data.from);
    tweetText = tweetText.replace(new RegExp('<to>', 'g'), data.to);
    tweetText = tweetText.replace(new RegExp('<fiatPrice>', 'g'), fiat.format());

    // Format our image to base64
    const image = this.transformImage(data.imageUrl);

    let processedImage: string;
    if (image) processedImage = await this.getBase64(image);

    let media_ids: Array<string>;
    if (processedImage) {
      // Upload the item's image to Twitter & retrieve a reference to it
      media_ids = await new Promise((resolve) => {
        twitterClient.post('media/upload', { media_data: processedImage }, (error, media: any) => {
          resolve(error ? null : [media.media_id_string]);
        });
      });
    }

    let tweet: any = { status: tweetText };
    if (media_ids) tweet.media_ids = media_ids;

    // Post the tweet 👇
    // If you need access to this endpoint, you’ll need to apply for Elevated access via the Developer Portal. You can learn more here: https://developer.twitter.com/en/docs/twitter-api/getting-started/about-twitter-api#v2-access-leve
    twitterClient.post('statuses/update', tweet, (error) => {
      if (!error) console.log(`Successfully tweeted: ${tweetText}`);
      else console.error(error);
    });
  }

  async getBase64(url: string) {
    return await firstValueFrom(
      this.http.get(url, { responseType: 'arraybuffer' }).pipe(
        map((res) => Buffer.from(res.data, 'binary').toString('base64')),
        catchError(() => of(null))
      )
    );
  }
  
  getEthToFiat(): Observable<any> {
    const endpoint = `https://api.coingecko.com/api/v3/simple/price`;
    const params = {
      ids: 'ethereum',
      vs_currencies: 'usd,aud,gbp,eur,cad,jpy,cny'
    };
    return timer(0, 300000).pipe(
      switchMap(() => this.http.get(endpoint, {params})),
      map((res: any) => res.data),
      // tap((res) => console.log(res)),
      catchError((err: any) => {
        console.log(err);
        return of({});
      })
    );
  }

  transformImage(value: string): string {
    let val: any = value;
    if (value?.includes('gateway.pinata.cloud')) {
      val = value.replace('gateway.pinata.cloud', 'cloudflare-ipfs.com');
    // } else if (value?.startsWith('data:image')) {
    //   val = `${value}`;
    } else if (value?.startsWith('ipfs://')) {
      val = value.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/');
    }
    return val ? val : null;
  }

}
