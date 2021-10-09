import { GoogleSpreadsheet } from "google-spreadsheet";
import * as creds from '../sheet_secret.json';
import * as sheetconfig from '../sheet_config.json';
import ERC20ABI from "../erc20.json"
import { GasLimitService, MultiCallParams, MultiCallService, Web3ProviderConnector } from "@1inch/multicall";
import Web3 from "web3";
import {utils, BigNumber} from "ethers"
import { formatUnits } from "@ethersproject/units";

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

async function getData() {
    var contractAddress = "0x804708de7af615085203fa2b18eae59c5738e2a9"
    var tokenAddress = "0x5B9dbeBbad94b8C6467Af9e8A851Bb120F9601c6"
    var web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545/'));
    var provider = new Web3ProviderConnector(web3);
    const gasLimitService = new GasLimitService(provider, contractAddress);
    const multiCallService = new MultiCallService(provider, contractAddress);
    try{
        const doc = new GoogleSpreadsheet(sheetconfig.testsheet);
        await doc.useServiceAccountAuth(creds);
        await doc.loadInfo(); 
        var sheet = doc.sheetsByIndex[0];
        console.log("Loaded: " + sheet.title);
        console.log("Getting rows");
        var addresses: {[address: string] : {index: number}} = {};
        await sheet.loadCells('A:B');
        for(let row = 1; row < 200; row++){
            var address = sheet.getCell(row, 0).value as string
            if(address != "" && address.length > 0){
                addresses[address] = {index: row}
            }
        }
        const balanceOfGasUsage = 80_000;
        const callDatas = Object.keys(addresses).map((address) => (
             {
                to: tokenAddress,
                data: provider.contractEncodeABI(
                    ERC20ABI,
                    tokenAddress,
                    'balanceOf',
                    [address]
                ),
                gas: balanceOfGasUsage
            }

        ))

        const gasLimit: number = await gasLimitService.calculateGasLimit();

        const balances = await multiCallService.callByGasLimit(callDatas, gasLimit);
        console.log(formatUnits(BigNumber.from(balances[0]), 9).replace(/\./g, ','))
        console.log(formatUnits(BigNumber.from(balances[1]), 9).replace(/\./g, ','))
        console.log(formatUnits(BigNumber.from(balances[3]), 9).replace(/\./g, ','))
        Object.keys(addresses).forEach((address, index) => {
            var sheetindex = addresses[address].index
            if(sheet.getCell(sheetindex, 0).value == address){
                sheet.getCell(sheetindex, 1).value = formatUnits(BigNumber.from(balances[index]), 9).replace(/\./g, ',');
            }
            else{
                throw "Address didnt match, abort!"
            }
        })
        await sheet.saveUpdatedCells()
    }
    catch(error){
        console.log(error)
    }
}

getData().then()