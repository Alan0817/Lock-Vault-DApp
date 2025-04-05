import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-multibaas-plugin';
import { config as dotEnvConfig } from 'dotenv';
import path from 'path';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-verify';


dotEnvConfig();

let deployerPrivateKey = '0x0000000000000000000000000000000000000000000000000000000000000000';
let deploymentEndpoint = '';
let adminApiKey = '';
let web3Key = '';
let rpcUrl = ''; // Required if web3Key is not provided

if (process.env['HARDHAT_NETWORK']) {
  const CONFIG_FILE = path.join(__dirname, `./deployment-config.${process.env['HARDHAT_NETWORK']}`);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  ({
    deploymentConfig: { deploymentEndpoint, deployerPrivateKey, web3Key, adminApiKey, rpcUrl },
    // eslint-disable-next-line @typescript-eslint/no-require-imports
  } = require(CONFIG_FILE));
}

const web3Url = web3Key ? `${deploymentEndpoint}/web3/${web3Key}` : rpcUrl;

const config: HardhatUserConfig = {
  networks: {
    development: {
      url: web3Url,
      accounts: [deployerPrivateKey],
    },
    testing: {
      url: web3Url,
      accounts: [deployerPrivateKey],
    },
    alfajores: {
      accounts: [process.env.PRIVATE_KEY ?? '0x0'],
      url: 'https://alfajores-forno.celo-testnet.org',
    },
    celo: {
      accounts: [process.env.PRIVATE_KEY ?? '0x0'],
      url: 'https://forno.celo.org',
    },
  },
  mbConfig: {
    apiKey: adminApiKey,
    host: deploymentEndpoint,
    allowUpdateAddress: ['development', 'testing'],
    allowUpdateContract: ['development'],
  },
  etherscan: {
    apiKey: {
      alfajores: process.env.CELOSCAN_API_KEY ?? '',
      celo: process.env.CELOSCAN_API_KEY ?? '',
    },
    customChains: [
      {
        chainId: 44_787,
        network: 'alfajores',
        urls: {
          apiURL: 'https://api-alfajores.celoscan.io/api',
          browserURL: 'https://alfajores.celoscan.io',
        },
      },
      {
        chainId: 42_220,
        network: 'celo',
        urls: {
          apiURL: 'https://api.celoscan.io/api',
          browserURL: 'https://celoscan.io/',
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
  solidity: {
    compilers: [
      {
        version: '0.8.24',
        settings: {
          optimizer: {
            enabled: true,
            runs: 99999,
          },
          evmVersion: 'paris', // until PUSH0 opcode is widely supported
        },
      },
    ],
  },
};

export default config;