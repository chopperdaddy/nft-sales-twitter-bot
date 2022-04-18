<h1>Twitter NFT sales bot</h1>

## Description

Tweets real-time NFT sales for ERC721 Smart contracts

In order to use this you’ll need to apply for Elevated access via the Twitter Developer Portal. You can learn more [here](https://developer.twitter.com/en/docs/twitter-api/getting-started/about-twitter-api#v2-access-leve).

## Installation

```bash
$ npm install
```

1. Create `.env` file & add contents from `example.env` -- Add your API credentials.
2. Edit the `src/config.ts` file to add your smart contract & customize the tweet parameters.
3. Edit `src/app.service.ts` to customize for your use (Experienced users only & not a requirement).
4. Build & Deploy `npm run build`
5. Feel free to reach out on twitter

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Created by

- Author - [Chopper](https://twitter.com/chopper__dad)

## License

Created using [Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.
Nest is [MIT licensed](LICENSE).
