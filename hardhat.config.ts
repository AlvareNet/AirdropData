import { HardhatUserConfig } from "hardhat/types";
import "@nomiclabs/hardhat-waffle";
const config: HardhatUserConfig = {
  solidity: {
    compilers: [{ version: "0.6.8", settings: {} }],
  },
};
export default config;

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.4",
};
